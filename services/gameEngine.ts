import { GameState, Phase, Player, ActionType, Role, PendingAction, LogEntry } from '../types';
import { INITIAL_COINS, ROLES_DECK } from '../constants';

// --- Helpers ---
const shuffle = <T>(array: T[]): T[] => {
  return [...array].sort(() => Math.random() - 0.5);
};

const nextTurn = (state: GameState): GameState => {
  let nextIndex = (state.turnIndex + 1) % state.players.length;
  while (!state.players[nextIndex].isAlive) {
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
  };
};

const checkWinCondition = (state: GameState): GameState => {
  const alivePlayers = state.players.filter((p) => p.isAlive);
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

export const applyAction = (
  state: GameState,
  action: { type: string; payload: any }
): GameState => {
  if (state.phase === Phase.GAME_OVER) return state;

  const currentPlayer = state.players[state.turnIndex];

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
        if (currentPlayer.coins < 7) return state;
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
        const updatedPlayers = state.players.map((p) =>
          p.id === currentPlayer.id ? { ...p, coins: p.coins - 3 } : p
        );
        const pending: PendingAction = { type: ActionType.ASSASSINATE, sourceId: currentPlayer.id, targetId };
        return {
          ...state,
          players: updatedPlayers,
          phase: Phase.CHALLENGE_WINDOW,
          pendingAction: pending,
          logs: [...state.logs, { type: 'action_attempt', actionType: ActionType.ASSASSINATE, actorId: currentPlayer.id, targetId }],
        };
      }

      if (actionType === ActionType.STEAL) {
        if (!targetId || targetId === currentPlayer.id) return state;
        const pending: PendingAction = { type: ActionType.STEAL, sourceId: currentPlayer.id, targetId };
        return {
          ...state,
          phase: Phase.CHALLENGE_WINDOW,
          pendingAction: pending,
          logs: [...state.logs, { type: 'action_attempt', actionType: ActionType.STEAL, actorId: currentPlayer.id, targetId }],
        };
      }

      if (actionType === ActionType.EXCHANGE) {
        const pending: PendingAction = { type: ActionType.EXCHANGE, sourceId: currentPlayer.id };
        return {
          ...state,
          phase: Phase.CHALLENGE_WINDOW,
          pendingAction: pending,
          logs: [...state.logs, { type: 'action_attempt', actionType: ActionType.EXCHANGE, actorId: currentPlayer.id }],
        };
      }

      // Tax, Foreign Aid
      const pending: PendingAction = {
        type: actionType,
        sourceId: currentPlayer.id,
        targetId,
      };
      return {
        ...state,
        phase: Phase.CHALLENGE_WINDOW,
        pendingAction: pending,
        logs: [...state.logs, { type: 'action_attempt', actionType, actorId: currentPlayer.id, targetId }],
      };
    }

    case 'PASS': {
      if (state.phase === Phase.CHALLENGE_WINDOW && state.pendingAction) {
        const pa = state.pendingAction;
        const source = state.players.find((p) => p.id === pa.sourceId)!;

        if (pa.type === ActionType.TAX) {
          const updatedPlayers = state.players.map((p) =>
            p.id === pa.sourceId ? { ...p, coins: p.coins + 3 } : p
          );
          return nextTurn({ ...state, players: updatedPlayers, logs: [...state.logs, { type: 'tax_success', actorId: pa.sourceId }] });
        }

        if (pa.type === ActionType.FOREIGN_AID) {
          const updatedPlayers = state.players.map((p) =>
            p.id === pa.sourceId ? { ...p, coins: p.coins + 2 } : p
          );
          return nextTurn({ ...state, players: updatedPlayers, logs: [...state.logs, { type: 'foreign_aid_success', actorId: pa.sourceId }] });
        }

        if (pa.type === ActionType.ASSASSINATE && pa.targetId) {
          return {
            ...state,
            phase: Phase.LOSE_CARD,
            victimId: pa.targetId,
            logs: [...state.logs, { type: 'assassinate_victim', targetId: pa.targetId! }],
          };
        }

        if (pa.type === ActionType.STEAL && pa.targetId) {
          const target = state.players.find((p) => p.id === pa.targetId)!;
          const amount = Math.min(2, target.coins);
          const updatedPlayers = state.players.map((p) => {
            if (p.id === pa.sourceId) return { ...p, coins: p.coins + amount };
            if (p.id === pa.targetId) return { ...p, coins: p.coins - amount };
            return p;
          });
          return nextTurn({
            ...state,
            players: updatedPlayers,
            logs: [...state.logs, { type: 'steal_success', actorId: pa.sourceId, targetId: pa.targetId!, amount }],
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
            pendingAction: null,
            logs: [...state.logs, { type: 'exchange_start', actorId: pa.sourceId }],
          };
        }
      }

      if (state.phase === Phase.BLOCK_RESPONSE) {
        return nextTurn({ ...state, logs: [...state.logs, { type: 'block_accepted' }] });
      }
      return state;
    }

    case 'BLOCK': {
      if (state.phase !== Phase.CHALLENGE_WINDOW || !state.pendingAction) return state;
      const blockerId = action.payload.playerId;
      const blockRole = action.payload.role as Role | undefined;
      const blocker = state.players.find((p) => p.id === blockerId);
      const pa = state.pendingAction;

      if (pa.type === ActionType.FOREIGN_AID) {
        return {
          ...state,
          phase: Phase.BLOCK_RESPONSE,
          pendingAction: { ...pa, blockedBy: blockerId, blockedByRole: Role.DUKE },
          logs: [...state.logs, { type: 'block', blockerId, role: Role.DUKE }],
        };
      }
      if (pa.type === ActionType.ASSASSINATE && (blockRole === Role.CONTESSA || !blockRole)) {
        return {
          ...state,
          phase: Phase.BLOCK_RESPONSE,
          pendingAction: { ...pa, blockedBy: blockerId, blockedByRole: Role.CONTESSA },
          logs: [...state.logs, { type: 'block', blockerId, role: Role.CONTESSA }],
        };
      }
      if (pa.type === ActionType.STEAL && (blockRole === Role.CAPTAIN || blockRole === Role.AMBASSADOR)) {
        return {
          ...state,
          phase: Phase.BLOCK_RESPONSE,
          pendingAction: { ...pa, blockedBy: blockerId, blockedByRole: blockRole },
          logs: [...state.logs, { type: 'block', blockerId, role: blockRole }],
        };
      }
      return state;
    }

    case 'CHALLENGE': {
      const challengerId = action.payload.playerId;
      const challenger = state.players.find((p) => p.id === challengerId);

      // --- CHALLENGE_WINDOW: challenging the action claim ---
      if (state.phase === Phase.CHALLENGE_WINDOW && state.pendingAction) {
        const pa = state.pendingAction;
        const actor = state.players.find((p) => p.id === pa.sourceId)!;

        if (pa.type === ActionType.TAX) {
          const hasDuke = actor.cards.includes(Role.DUKE);
          if (hasDuke) {
            const updatedPlayers = state.players.map((p) =>
              p.id === actor.id ? { ...p, coins: p.coins + 3 } : p
            );
            return {
              ...state,
              players: updatedPlayers,
              phase: Phase.LOSE_CARD,
              victimId: challengerId,
              logs: [...state.logs, { type: 'challenge_fail', actorId: pa.sourceId, role: Role.DUKE, loserId: challengerId }],
            };
          }
          return {
            ...state,
            phase: Phase.LOSE_CARD,
            victimId: pa.sourceId,
            logs: [...state.logs, { type: 'challenge_success_actor', actorId: pa.sourceId, loserId: pa.sourceId }],
          };
        }

        if (pa.type === ActionType.ASSASSINATE) {
          const hasAssassin = actor.cards.includes(Role.ASSASSIN);
          if (hasAssassin) {
            return {
              ...state,
              phase: Phase.LOSE_CARD,
              victimId: challengerId,
              logs: [...state.logs, { type: 'challenge_fail', actorId: pa.sourceId, role: Role.ASSASSIN, loserId: challengerId }],
            };
          }
          return {
            ...state,
            phase: Phase.LOSE_CARD,
            victimId: pa.sourceId,
            logs: [...state.logs, { type: 'challenge_success_actor', actorId: pa.sourceId, loserId: pa.sourceId }],
          };
        }

        if (pa.type === ActionType.STEAL) {
          const hasCaptain = actor.cards.includes(Role.CAPTAIN);
          if (hasCaptain) {
            const target = state.players.find((p) => p.id === pa.targetId)!;
            const amount = Math.min(2, target.coins);
            const updatedPlayers = state.players.map((p) => {
              if (p.id === pa.sourceId) return { ...p, coins: p.coins + amount };
              if (p.id === pa.targetId) return { ...p, coins: p.coins - amount };
              return p;
            });
            return {
              ...state,
              players: updatedPlayers,
              phase: Phase.LOSE_CARD,
              victimId: challengerId,
              pendingAction: null,
              logs: [...state.logs, { type: 'challenge_fail', actorId: pa.sourceId, role: Role.CAPTAIN, loserId: challengerId }],
            };
          }
          return {
            ...state,
            phase: Phase.LOSE_CARD,
            victimId: pa.sourceId,
            logs: [...state.logs, { type: 'challenge_success_actor', actorId: pa.sourceId, loserId: pa.sourceId }],
          };
        }

        if (pa.type === ActionType.EXCHANGE) {
          const hasAmbassador = actor.cards.includes(Role.AMBASSADOR);
          if (hasAmbassador) {
            return {
              ...state,
              phase: Phase.LOSE_CARD,
              victimId: challengerId,
              deferredExchangeSourceId: pa.sourceId,
              pendingAction: null,
              logs: [...state.logs, { type: 'challenge_fail', actorId: pa.sourceId, role: Role.AMBASSADOR, loserId: challengerId }],
            };
          }
          return {
            ...state,
            phase: Phase.LOSE_CARD,
            victimId: pa.sourceId,
            logs: [...state.logs, { type: 'challenge_success_actor', actorId: pa.sourceId, loserId: pa.sourceId }],
          };
        }
      }

      // --- BLOCK_RESPONSE: challenging the blocker ---
      if (state.phase === Phase.BLOCK_RESPONSE && state.pendingAction?.blockedBy) {
        const pa = state.pendingAction;
        const blocker = state.players.find((p) => p.id === pa.blockedBy)!;
        const role = pa.blockedByRole ?? Role.DUKE;

        const hasRole = blocker.cards.includes(role);

        if (hasRole) {
          return {
            ...state,
            phase: Phase.LOSE_CARD,
            victimId: pa.sourceId,
            logs: [...state.logs, { type: 'challenge_fail', actorId: pa.blockedBy!, role, loserId: pa.sourceId }],
          };
        }

        // Block fails; apply original action
        let updatedPlayers = [...state.players];
        if (pa.type === ActionType.FOREIGN_AID) {
          updatedPlayers = updatedPlayers.map((p) =>
            p.id === pa.sourceId ? { ...p, coins: p.coins + 2 } : p
          );
        }
        if (pa.type === ActionType.ASSASSINATE && pa.targetId) {
          return {
            ...state,
            players: updatedPlayers,
            phase: Phase.LOSE_CARD,
            victimId: pa.targetId,
            logs: [...state.logs, { type: 'challenge_success_block', blockerId: pa.blockedBy!, message: 'assassinate' }],
          };
        }
        if (pa.type === ActionType.STEAL && pa.targetId) {
          const target = state.players.find((p) => p.id === pa.targetId)!;
          const amount = Math.min(2, target.coins);
          updatedPlayers = updatedPlayers.map((p) => {
            if (p.id === pa.sourceId) return { ...p, coins: p.coins + amount };
            if (p.id === pa.targetId) return { ...p, coins: p.coins - amount };
            return p;
          });
        }
        return {
          ...state,
          players: updatedPlayers,
          phase: Phase.LOSE_CARD,
          victimId: pa.blockedBy!,
          logs: [...state.logs, { type: 'challenge_success_block', blockerId: pa.blockedBy!, message: 'action' }],
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
