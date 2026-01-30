import { GameState, Phase, Player, ActionType, Role, PendingAction, LogEntry } from '../types';
import { INITIAL_COINS, ROLES_DECK } from '../constants';

// --- Helpers ---
/** A player with 0 influence (no cards) is DEAD. Dead players cannot act, block, challenge, or be counted in response checks. */
const isAlive = (player: Player): boolean => player.cards.length > 0;

/** Alive player ids who must respond (pass or challenge) during CHALLENGE_WINDOW — excludes action initiator. */
const getPendingResponders = (state: GameState): string[] => {
  if (!state.pendingAction) return [];
  return state.players
    .filter((p) => isAlive(p) && p.id !== state.pendingAction!.sourceId)
    .map((p) => p.id);
};

const shuffle = <T>(array: T[]): T[] => {
  return [...array].sort(() => Math.random() - 0.5);
};

/** When challenge fails: challenged player reveals role, returns it to deck, draws one new card. */
const replaceCard = (state: GameState, playerId: string, revealedRole: Role): GameState => {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || !player.cards.includes(revealedRole)) return state;
  const cardIndex = player.cards.indexOf(revealedRole);
  const newCards = [...player.cards];
  const [removed] = newCards.splice(cardIndex, 1);
  const newDeck = shuffle([...state.deck, removed]);
  const drawn = newDeck.pop()!;
  const updatedPlayers = state.players.map((p) =>
    p.id === playerId ? { ...p, cards: [...newCards, drawn] } : p
  );
  return { ...state, players: updatedPlayers, deck: newDeck };
};

const nextTurn = (state: GameState): GameState => {
  let nextIndex = (state.turnIndex + 1) % state.players.length;
  while (!isAlive(state.players[nextIndex])) {
    nextIndex = (nextIndex + 1) % state.players.length;
  }
  return {
    ...state,
    turnIndex: nextIndex,
    phase: Phase.ACTION_SELECTION,
    pendingAction: null,
    victimId: null,
    exchangePlayerId: null,
    exchangeDrawnCards: undefined,
    deferredExchangeSourceId: null,
    deferredLoseCardVictimId: null,
    passedResponderIds: undefined,
  };
};

const checkWinCondition = (state: GameState): GameState => {
  const alivePlayers = state.players.filter(isAlive);
  if (alivePlayers.length === 1) {
    const entry: LogEntry = { type: 'game_over', winnerId: alivePlayers[0].id };
    return {
      ...state,
      phase: Phase.GAME_OVER,
      winnerId: alivePlayers[0].id,
      logs: [...state.logs, entry],
    };
  }
  return state;
};

const killPlayerCard = (player: Player, cardIndex: number): Player => {
  const newCards = [...player.cards];
  const lostCard = newCards.splice(cardIndex, 1)[0];
  const newLost = [...player.lostCards, lostCard];
  return {
    ...player,
    cards: newCards,
    lostCards: newLost,
    isAlive: newCards.length > 0,
  };
};

// --- Command Handlers ---

export const initializeGame = (
  roomId: string,
  playerNames: string[],
  hostPlayerId: string
): GameState => {
  const deck = shuffle([...ROLES_DECK]);
  const players: Player[] = playerNames.map((name, i) => ({
    id: `p${i + 1}`,
    name,
    coins: INITIAL_COINS,
    cards: [deck.pop()!, deck.pop()!],
    isAlive: true,
    lostCards: [],
  }));
  const effectiveHostId = hostPlayerId.startsWith('p') ? hostPlayerId : 'p1';
  return {
    roomId,
    hostPlayerId: effectiveHostId,
    phase: Phase.ACTION_SELECTION,
    players,
    turnIndex: 0,
    deck,
    pendingAction: null,
    logs: [{ type: 'game_start' }],
    winnerId: null,
    victimId: null,
  };
};

/** Set phase to CHALLENGE_WINDOW with pending action and empty passed list. Ensures game-over if only one alive. */
const enterChallengeWindow = (state: GameState, pending: PendingAction): GameState => {
  const afterWinCheck = checkWinCondition(state);
  if (afterWinCheck.phase === Phase.GAME_OVER) return afterWinCheck;
  return {
    ...afterWinCheck,
    phase: Phase.CHALLENGE_WINDOW,
    pendingAction: pending,
    passedResponderIds: [],
  };
};

export const applyAction = (
  state: GameState,
  action: { type: string; payload: any }
): GameState => {
  if (state.phase === Phase.GAME_OVER) return state;

  const currentPlayer = state.players[state.turnIndex];
  if (!currentPlayer || !isAlive(currentPlayer)) return state;

  switch (action.type) {
    case 'SUBMIT_ACTION': {
      const { actionType, targetId } = action.payload;

      if (actionType === ActionType.INCOME) {
        const updatedPlayers = state.players.map((p) =>
          p.id === currentPlayer.id ? { ...p, coins: p.coins + 1 } : p
        );
        return nextTurn({
          ...state,
          players: updatedPlayers,
          logs: [...state.logs, { type: 'income', actorId: currentPlayer.id }],
        });
      }

      if (actionType === ActionType.COUP) {
        if (currentPlayer.coins < 7 || !targetId) return state;
        const target = state.players.find((p) => p.id === targetId);
        if (!target || !isAlive(target)) return state;
        const updatedPlayers = state.players.map((p) =>
          p.id === currentPlayer.id ? { ...p, coins: p.coins - 7 } : p
        );
        return {
          ...state,
          players: updatedPlayers,
          phase: Phase.LOSE_CARD,
          victimId: targetId,
          logs: [...state.logs, { type: 'coup', actorId: currentPlayer.id, targetId }],
        };
      }

      if (actionType === ActionType.ASSASSINATE) {
        if (currentPlayer.coins < 3 || !targetId) return state;
        const assassinateTarget = state.players.find((p) => p.id === targetId);
        if (!assassinateTarget || !isAlive(assassinateTarget)) return state;
        const updatedPlayers = state.players.map((p) =>
          p.id === currentPlayer.id ? { ...p, coins: p.coins - 3 } : p
        );
        const pending: PendingAction = { type: ActionType.ASSASSINATE, sourceId: currentPlayer.id, targetId };
        return enterChallengeWindow(
          { ...state, players: updatedPlayers, logs: [...state.logs, { type: 'action_attempt', actionType: ActionType.ASSASSINATE, actorId: currentPlayer.id, targetId }] },
          pending
        );
      }

      if (actionType === ActionType.STEAL) {
        if (!targetId || targetId === currentPlayer.id) return state;
        const stealTarget = state.players.find((p) => p.id === targetId);
        if (!stealTarget || !isAlive(stealTarget)) return state;
        const pending: PendingAction = { type: ActionType.STEAL, sourceId: currentPlayer.id, targetId };
        return enterChallengeWindow(
          { ...state, logs: [...state.logs, { type: 'action_attempt', actionType: ActionType.STEAL, actorId: currentPlayer.id, targetId }] },
          pending
        );
      }

      if (actionType === ActionType.EXCHANGE) {
        const pending: PendingAction = { type: ActionType.EXCHANGE, sourceId: currentPlayer.id };
        return enterChallengeWindow(
          { ...state, logs: [...state.logs, { type: 'action_attempt', actionType: ActionType.EXCHANGE, actorId: currentPlayer.id }] },
          pending
        );
      }

      // Tax, Foreign Aid
      const pending: PendingAction = {
        type: actionType,
        sourceId: currentPlayer.id,
        targetId,
      };
      return enterChallengeWindow(
        { ...state, logs: [...state.logs, { type: 'action_attempt', actionType, actorId: currentPlayer.id, targetId }] },
        pending
      );
    }

    case 'PASS': {
      const passerId = action.payload?.playerId as string | undefined;

      if (state.phase === Phase.CHALLENGE_WINDOW && state.pendingAction) {
        const pa = state.pendingAction;
        const pendingResponders = getPendingResponders(state);
        if (pendingResponders.length === 0) return state;
        if (!passerId) return state;
        const passer = state.players.find((p) => p.id === passerId);
        if (!passer || !isAlive(passer)) return state;
        if (!pendingResponders.includes(passerId)) return state;

        const passedResponderIds = state.passedResponderIds ?? [];
        if (passedResponderIds.includes(passerId)) return state;
        const newPassed = [...passedResponderIds, passerId];
        if (newPassed.length < pendingResponders.length) {
          return { ...state, passedResponderIds: newPassed };
        }

        // All alive (except source) have passed — apply action
        const source = state.players.find((p) => p.id === pa.sourceId)!;

        if (pa.type === ActionType.TAX) {
          const updatedPlayers = state.players.map((p) =>
            p.id === pa.sourceId ? { ...p, coins: p.coins + 3 } : p
          );
          return nextTurn({
            ...state,
            players: updatedPlayers,
            passedResponderIds: undefined,
            pendingAction: null,
            logs: [...state.logs, { type: 'tax_success', actorId: pa.sourceId }],
          });
        }

        if (pa.type === ActionType.FOREIGN_AID) {
          const updatedPlayers = state.players.map((p) =>
            p.id === pa.sourceId ? { ...p, coins: p.coins + 2 } : p
          );
          return nextTurn({
            ...state,
            players: updatedPlayers,
            passedResponderIds: undefined,
            pendingAction: null,
            logs: [...state.logs, { type: 'foreign_aid_success', actorId: pa.sourceId }],
          });
        }

        if (pa.type === ActionType.ASSASSINATE && pa.targetId) {
          return {
            ...state,
            phase: Phase.LOSE_CARD,
            victimId: pa.targetId,
            passedResponderIds: undefined,
            pendingAction: null,
            logs: [...state.logs, { type: 'assassinate_victim', targetId: pa.targetId }],
          };
        }

        if (pa.type === ActionType.STEAL && pa.targetId) {
          const target = state.players.find((p) => p.id === pa.targetId)!;
          const amount = Math.min(2, Math.max(0, target.coins)); // steal at most 2, never more than target has
          const updatedPlayers = state.players.map((p) => {
            if (p.id === pa.sourceId) return { ...p, coins: p.coins + amount };
            if (p.id === pa.targetId) return { ...p, coins: p.coins - amount };
            return p;
          });
          return nextTurn({
            ...state,
            players: updatedPlayers,
            passedResponderIds: undefined,
            pendingAction: null,
            logs: [...state.logs, { type: 'steal_success', actorId: pa.sourceId, targetId: pa.targetId, amount }],
          });
        }

        if (pa.type === ActionType.EXCHANGE) {
          const deck = [...state.deck];
          const drawn: Role[] = [];
          while (deck.length > 0 && drawn.length < 2) drawn.push(deck.pop()!);
          const newHand = [...source.cards, ...drawn];
          const updatedPlayers = state.players.map((p) =>
            p.id === pa.sourceId ? { ...p, cards: newHand } : p
          );
          return {
            ...state,
            players: updatedPlayers,
            deck,
            phase: Phase.EXCHANGE_SELECT,
            exchangePlayerId: pa.sourceId,
            passedResponderIds: undefined,
            pendingAction: null,
            logs: [...state.logs, { type: 'exchange_start', actorId: pa.sourceId }],
          };
        }
      }

      if (state.phase === Phase.BLOCK_RESPONSE && state.pendingAction?.blockedBy) {
        const pa = state.pendingAction;
        const blockResponders = state.players.filter((p) => isAlive(p) && p.id !== pa.blockedBy).map((p) => p.id);
        if (blockResponders.length === 0) return state;
        if (!passerId) return state;
        const passer = state.players.find((p) => p.id === passerId);
        if (!passer || !isAlive(passer)) return state;
        if (passerId === pa.blockedBy) return state; // blocker cannot pass on their own block
        if (!blockResponders.includes(passerId)) return state;
        const passedResponderIds = state.passedResponderIds ?? [];
        if (passedResponderIds.includes(passerId)) return state;
        const newPassed = [...passedResponderIds, passerId];
        if (newPassed.length < blockResponders.length) {
          return { ...state, passedResponderIds: newPassed };
        }
        return nextTurn({
          ...state,
          passedResponderIds: undefined,
          pendingAction: null,
          logs: [...state.logs, { type: 'block_accepted' }],
        });
      }
      return state;
    }

    case 'BLOCK': {
      if (state.phase !== Phase.CHALLENGE_WINDOW || !state.pendingAction) return state;
      const blockerId = action.payload.playerId;
      const blockRole = action.payload.role as Role | undefined;
      const blocker = state.players.find((p) => p.id === blockerId);
      if (!blocker || !isAlive(blocker)) return state;
      const pa = state.pendingAction;

      if (pa.type === ActionType.FOREIGN_AID) {
        return {
          ...state,
          phase: Phase.BLOCK_RESPONSE,
          pendingAction: { ...pa, blockedBy: blockerId, blockedByRole: Role.DUKE },
          passedResponderIds: [],
          logs: [...state.logs, { type: 'block', blockerId, role: Role.DUKE }],
        };
      }
      if (pa.type === ActionType.ASSASSINATE && (blockRole === Role.CONTESSA || !blockRole)) {
        return {
          ...state,
          phase: Phase.BLOCK_RESPONSE,
          pendingAction: { ...pa, blockedBy: blockerId, blockedByRole: Role.CONTESSA },
          passedResponderIds: [],
          logs: [...state.logs, { type: 'block', blockerId, role: Role.CONTESSA }],
        };
      }
      if (pa.type === ActionType.STEAL && (blockRole === Role.CAPTAIN || blockRole === Role.AMBASSADOR)) {
        return {
          ...state,
          phase: Phase.BLOCK_RESPONSE,
          pendingAction: { ...pa, blockedBy: blockerId, blockedByRole: blockRole },
          passedResponderIds: [],
          logs: [...state.logs, { type: 'block', blockerId, role: blockRole }],
        };
      }
      return state;
    }

    case 'CHALLENGE': {
      const challengerId = action.payload.playerId;
      const challenger = state.players.find((p) => p.id === challengerId);
      if (!challenger || !isAlive(challenger)) return state;

      // --- CHALLENGE_WINDOW: challenging the action claim — resolve immediately ---
      if (state.phase === Phase.CHALLENGE_WINDOW && state.pendingAction) {
        const pa = state.pendingAction;
        const actor = state.players.find((p) => p.id === pa.sourceId)!;

        if (pa.type === ActionType.TAX) {
          const claimedRole = Role.DUKE;
          const challengedId = pa.sourceId;
          const startedLog: LogEntry = { type: 'challenge_started', challengerId, challengedId, claimedRole };
          const hasDuke = actor.cards.includes(Role.DUKE);
          if (hasDuke) {
            const afterReplace = replaceCard(state, pa.sourceId, Role.DUKE);
            const updatedPlayers = afterReplace.players.map((p) =>
              p.id === pa.sourceId ? { ...p, coins: p.coins + 3 } : p
            );
            return {
              ...afterReplace,
              players: updatedPlayers,
              phase: Phase.LOSE_CARD,
              victimId: challengerId,
              pendingAction: null,
              passedResponderIds: undefined,
              logs: [...afterReplace.logs, startedLog, { type: 'challenge_fail', challengerId, challengedId, claimedRole, loserId: challengerId }, { type: 'tax_success', actorId: pa.sourceId }],
            };
          }
          return {
            ...state,
            phase: Phase.LOSE_CARD,
            victimId: pa.sourceId,
            pendingAction: null,
            passedResponderIds: undefined,
            logs: [...state.logs, startedLog, { type: 'challenge_success', challengerId, challengedId, claimedRole }],
          };
        }

        if (pa.type === ActionType.ASSASSINATE) {
          const claimedRole = Role.ASSASSIN;
          const challengedId = pa.sourceId;
          const startedLog: LogEntry = { type: 'challenge_started', challengerId, challengedId, claimedRole };
          const hasAssassin = actor.cards.includes(Role.ASSASSIN);
          if (hasAssassin) {
            const afterReplace = replaceCard(state, pa.sourceId, Role.ASSASSIN);
            return {
              ...afterReplace,
              phase: Phase.LOSE_CARD,
              victimId: challengerId,
              deferredLoseCardVictimId: pa.targetId ?? null,
              pendingAction: null,
              passedResponderIds: undefined,
              logs: [...afterReplace.logs, startedLog, { type: 'challenge_fail', challengerId, challengedId, claimedRole, loserId: challengerId }],
            };
          }
          return {
            ...state,
            phase: Phase.LOSE_CARD,
            victimId: pa.sourceId,
            pendingAction: null,
            passedResponderIds: undefined,
            logs: [...state.logs, startedLog, { type: 'challenge_success', challengerId, challengedId, claimedRole }],
          };
        }

        if (pa.type === ActionType.STEAL) {
          const claimedRole = Role.CAPTAIN;
          const challengedId = pa.sourceId;
          const startedLog: LogEntry = { type: 'challenge_started', challengerId, challengedId, claimedRole };
          const hasCaptain = actor.cards.includes(Role.CAPTAIN);
          if (hasCaptain) {
            const afterReplace = replaceCard(state, pa.sourceId, Role.CAPTAIN);
            return {
              ...afterReplace,
              phase: Phase.LOSE_CARD,
              victimId: challengerId,
              pendingAction: null,
              passedResponderIds: undefined,
              logs: [...afterReplace.logs, startedLog, { type: 'challenge_fail', challengerId, challengedId, claimedRole, loserId: challengerId }],
            };
          }
          return {
            ...state,
            phase: Phase.LOSE_CARD,
            victimId: pa.sourceId,
            pendingAction: null,
            passedResponderIds: undefined,
            logs: [...state.logs, startedLog, { type: 'challenge_success', challengerId, challengedId, claimedRole }],
          };
        }

        if (pa.type === ActionType.EXCHANGE) {
          const claimedRole = Role.AMBASSADOR;
          const challengedId = pa.sourceId;
          const startedLog: LogEntry = { type: 'challenge_started', challengerId, challengedId, claimedRole };
          const hasAmbassador = actor.cards.includes(Role.AMBASSADOR);
          if (hasAmbassador) {
            const afterReplace = replaceCard(state, pa.sourceId, Role.AMBASSADOR);
            return {
              ...afterReplace,
              phase: Phase.LOSE_CARD,
              victimId: challengerId,
              deferredExchangeSourceId: pa.sourceId,
              pendingAction: null,
              passedResponderIds: undefined,
              logs: [...afterReplace.logs, startedLog, { type: 'challenge_fail', challengerId, challengedId, claimedRole, loserId: challengerId }],
            };
          }
          return {
            ...state,
            phase: Phase.LOSE_CARD,
            victimId: pa.sourceId,
            pendingAction: null,
            passedResponderIds: undefined,
            logs: [...state.logs, startedLog, { type: 'challenge_success', challengerId, challengedId, claimedRole }],
          };
        }
      }

      // --- BLOCK_RESPONSE: challenging the blocker — resolve immediately ---
      if (state.phase === Phase.BLOCK_RESPONSE && state.pendingAction?.blockedBy) {
        const pa = state.pendingAction;
        const blocker = state.players.find((p) => p.id === pa.blockedBy)!;
        const claimedRole = pa.blockedByRole ?? Role.DUKE;
        const challengedId = pa.blockedBy!;
        const startedLog: LogEntry = { type: 'challenge_started', challengerId, challengedId, claimedRole };

        const hasRole = blocker.cards.includes(claimedRole);

        if (hasRole) {
          const afterReplace = replaceCard(state, pa.blockedBy!, claimedRole);
          return {
            ...afterReplace,
            phase: Phase.LOSE_CARD,
            victimId: pa.sourceId,
            pendingAction: null,
            logs: [...afterReplace.logs, startedLog, { type: 'challenge_fail', challengerId, challengedId, claimedRole, loserId: pa.sourceId }],
          };
        }

        // Block fails; blocker loses 1 for lying, then original action effect applies
        let updatedPlayers = [...state.players];
        if (pa.type === ActionType.FOREIGN_AID) {
          updatedPlayers = updatedPlayers.map((p) =>
            p.id === pa.sourceId ? { ...p, coins: p.coins + 2 } : p
          );
        }
        if (pa.type === ActionType.STEAL && pa.targetId) {
          const target = state.players.find((p) => p.id === pa.targetId)!;
          const amount = Math.min(2, Math.max(0, target.coins)); // steal at most 2, never more than target has
          updatedPlayers = updatedPlayers.map((p) => {
            if (p.id === pa.sourceId) return { ...p, coins: p.coins + amount };
            if (p.id === pa.targetId) return { ...p, coins: p.coins - amount };
            return p;
          });
        }
        // ASSASSINATE: blocker loses 1 now; target must lose 1 next (deferred) — only if they'll still have a card to lose
        if (pa.type === ActionType.ASSASSINATE) {
          const assassinateTargetId = pa.targetId ?? pa.blockedBy!;
          const blocker = state.players.find((p) => p.id === pa.blockedBy)!;
          const isSamePerson = pa.blockedBy === assassinateTargetId;
          const willHaveCardAfterFirstLoss = isSamePerson ? blocker.cards.length > 1 : true;
          return {
            ...state,
            players: updatedPlayers,
            phase: Phase.LOSE_CARD,
            victimId: pa.blockedBy!,
            deferredLoseCardVictimId: willHaveCardAfterFirstLoss ? assassinateTargetId : null,
            pendingAction: null,
            logs: [...state.logs, startedLog, { type: 'challenge_success', challengerId, challengedId, claimedRole }],
          };
        }
        return {
          ...state,
          players: updatedPlayers,
          phase: Phase.LOSE_CARD,
          victimId: pa.blockedBy!,
          pendingAction: null,
          logs: [...state.logs, startedLog, { type: 'challenge_success', challengerId, challengedId, claimedRole }],
        };
      }

      return state;
    }

    case 'EXCHANGE_RETURN': {
      if (state.phase !== Phase.EXCHANGE_SELECT || state.exchangePlayerId !== action.payload.playerId)
        return state;
      const { cardIndices } = action.payload as { cardIndices: [number, number] };
      const [i, j] = cardIndices;
      const player = state.players.find((p) => p.id === state.exchangePlayerId)!;
      const returned = [player.cards[i], player.cards[j]];
      const newCards = player.cards.filter((_, idx) => idx !== i && idx !== j);
      const newDeck = shuffle([...state.deck, ...returned]);
      const updatedPlayers = state.players.map((p) =>
        p.id === state.exchangePlayerId ? { ...p, cards: newCards } : p
      );
      return nextTurn({
        ...state,
        players: updatedPlayers,
        deck: newDeck,
        exchangePlayerId: null,
        exchangeDrawnCards: undefined,
        logs: [...state.logs, { type: 'exchange_done', actorId: state.exchangePlayerId! }],
      });
    }

    case 'LOSE_CARD': {
      const { playerId, cardIndex } = action.payload;
      if (state.victimId !== playerId) return state;

      const player = state.players.find((p) => p.id === playerId);
      if (!player) return state;

      const updatedPlayer = killPlayerCard(player, cardIndex);
      const updatedPlayers = state.players.map((p) => (p.id === playerId ? updatedPlayer : p));

      let newState: GameState = {
        ...state,
        players: updatedPlayers,
        phase: Phase.ACTION_SELECTION,
        victimId: null,
      };

      const finalState = checkWinCondition(newState);
      if (finalState.phase === Phase.GAME_OVER) return finalState;

      // Deferred lose card: blocker lost 1 for lying; now target loses 1 (e.g. assassinate) — chain LOSE_CARD only if they have a card to lose
      if (finalState.deferredLoseCardVictimId) {
        const nextVictimId = finalState.deferredLoseCardVictimId;
        const nextVictim = finalState.players.find((p) => p.id === nextVictimId);
        if (!nextVictim || nextVictim.cards.length === 0) {
          const cleared = { ...finalState, deferredLoseCardVictimId: null };
          const afterWinCheck = checkWinCondition(cleared);
          if (afterWinCheck.phase === Phase.GAME_OVER) return afterWinCheck;
          return nextTurn(cleared);
        }
        return {
          ...finalState,
          victimId: nextVictimId,
          deferredLoseCardVictimId: null,
          phase: Phase.LOSE_CARD,
        };
      }

      // Deferred exchange: after challenger lost card on Exchange challenge fail, do exchange now
      if (finalState.deferredExchangeSourceId) {
        const source = finalState.players.find((p) => p.id === finalState.deferredExchangeSourceId)!;
        const deck = [...finalState.deck];
        const drawn: Role[] = [];
        while (deck.length > 0 && drawn.length < 2) drawn.push(deck.pop()!);
        const newHand = [...source.cards, ...drawn];
        const updated = finalState.players.map((p) =>
          p.id === finalState.deferredExchangeSourceId ? { ...p, cards: newHand } : p
        );
        return {
          ...finalState,
          players: updated,
          deck,
          phase: Phase.EXCHANGE_SELECT,
          exchangePlayerId: finalState.deferredExchangeSourceId ?? undefined,
          deferredExchangeSourceId: undefined,
          pendingAction: null,
          victimId: null,
          logs: [...finalState.logs, { type: 'exchange_start', actorId: finalState.deferredExchangeSourceId! }],
        };
      }

      return nextTurn(finalState);
    }

    default:
      return state;
  }
};
