import { GameState, Phase, Player, ActionType, Role, PendingAction } from '../types';
import { INITIAL_COINS, ROLES_DECK } from '../constants';

// --- Helpers ---
const shuffle = <T>(array: T[]): T[] => {
  return [...array].sort(() => Math.random() - 0.5);
};

const nextTurn = (state: GameState): GameState => {
  let nextIndex = (state.turnIndex + 1) % state.players.length;
  // Skip dead players
  while (!state.players[nextIndex].isAlive) {
    nextIndex = (nextIndex + 1) % state.players.length;
  }
  return {
    ...state,
    turnIndex: nextIndex,
    phase: Phase.ACTION_SELECTION,
    pendingAction: null,
    victimId: null
  };
};

const checkWinCondition = (state: GameState): GameState => {
  const alivePlayers = state.players.filter(p => p.isAlive);
  if (alivePlayers.length === 1) {
    return {
      ...state,
      phase: Phase.GAME_OVER,
      winnerId: alivePlayers[0].id,
      logs: [...state.logs, `Game Over! ${alivePlayers[0].name} wins!`]
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
    isAlive: newCards.length > 0
  };
};

// --- Command Handlers ---

export const initializeGame = (roomId: string, playerNames: string[], hostPlayerId: string): GameState => {
  const deck = shuffle([...ROLES_DECK]);
  const players: Player[] = playerNames.map((name, i) => ({
    id: `p${i + 1}`,
    name,
    coins: INITIAL_COINS,
    cards: [deck.pop()!, deck.pop()!],
    isAlive: true,
    lostCards: []
  }));

  // Re-map host ID to the new player objects if necessary, or just keep the string.
  // In a real app we'd keep stable IDs. For this prototype, IDs are p1, p2... 
  // We'll assume the host is always p1 (the first player) if we are resetting, 
  // OR we pass the actual host ID if we were maintaining IDs.
  // To keep it simple for the prototype's ID generation logic (`p${i+1}`), 
  // let's ensure the host stays the host if they were the first one.
  const effectiveHostId = hostPlayerId.startsWith('p') ? hostPlayerId : 'p1';

  return {
    roomId,
    hostPlayerId: effectiveHostId,
    phase: Phase.ACTION_SELECTION,
    players,
    turnIndex: 0,
    deck,
    pendingAction: null,
    logs: ['Game started.'],
    winnerId: null,
    victimId: null
  };
};

export const applyAction = (state: GameState, action: { type: string, payload: any }): GameState => {
  if (state.phase === Phase.GAME_OVER) return state;

  const currentPlayer = state.players[state.turnIndex];

  switch (action.type) {
    case 'SUBMIT_ACTION': {
      const { actionType, targetId } = action.payload;
      
      // Immediate Actions
      if (actionType === ActionType.INCOME) {
        const updatedPlayers = state.players.map(p => 
          p.id === currentPlayer.id ? { ...p, coins: p.coins + 1 } : p
        );
        return nextTurn({ ...state, players: updatedPlayers, logs: [...state.logs, `${currentPlayer.name} used Income.`] });
      }

      if (actionType === ActionType.COUP) {
         if (currentPlayer.coins < 7) return state; // validation
         const updatedPlayers = state.players.map(p => 
            p.id === currentPlayer.id ? { ...p, coins: p.coins - 7 } : p
         );
         return {
           ...state,
           players: updatedPlayers,
           phase: Phase.LOSE_CARD,
           victimId: targetId,
           logs: [...state.logs, `${currentPlayer.name} coups ${state.players.find(p => p.id === targetId)?.name}.`]
         };
      }

      // Challengeable Actions
      const pending: PendingAction = {
        type: actionType,
        sourceId: currentPlayer.id,
        targetId
      };
      
      return {
        ...state,
        phase: Phase.CHALLENGE_WINDOW,
        pendingAction: pending,
        logs: [...state.logs, `${currentPlayer.name} attempts ${actionType === ActionType.FOREIGN_AID ? 'Foreign Aid' : 'Tax'}.`]
      };
    }

    case 'PASS': {
      // Logic depends on current phase
      if (state.phase === Phase.CHALLENGE_WINDOW) {
        // Assume for MVP if one person passes, we wait? No, in simplified real-time, 
        // we'll assume this 'PASS' comes from a "Resolve" tick or "Everyone Passed".
        // For this prototype, we will treat a single "PASS" from the active user's debug view 
        // or a simulated "All Pass" event.
        // Let's implement: If we receive PASS here, it implies no one challenged.
        
        if (!state.pendingAction) return state;

        if (state.pendingAction.type === ActionType.TAX) {
           const updatedPlayers = state.players.map(p => 
             p.id === state.pendingAction!.sourceId ? { ...p, coins: p.coins + 3 } : p
           );
           return nextTurn({ ...state, players: updatedPlayers, logs: [...state.logs, `Tax successful.`] });
        }

        if (state.pendingAction.type === ActionType.FOREIGN_AID) {
           const updatedPlayers = state.players.map(p => 
             p.id === state.pendingAction!.sourceId ? { ...p, coins: p.coins + 2 } : p
           );
           return nextTurn({ ...state, players: updatedPlayers, logs: [...state.logs, `Foreign Aid successful.`] });
        }
      }

      if (state.phase === Phase.BLOCK_RESPONSE) {
          // The action source decided NOT to challenge the block. Action fails.
          return nextTurn({ ...state, logs: [...state.logs, `Block accepted. Action failed.`] });
      }
      return state;
    }

    case 'BLOCK': {
       // Only valid for Foreign Aid in this MVP (Duke blocks Foreign Aid)
       if (state.phase !== Phase.CHALLENGE_WINDOW || !state.pendingAction) return state;
       const blockerId = action.payload.playerId;
       const blocker = state.players.find(p => p.id === blockerId);
       
       return {
         ...state,
         phase: Phase.BLOCK_RESPONSE,
         pendingAction: { ...state.pendingAction, blockedBy: blockerId },
         logs: [...state.logs, `${blocker?.name} blocks with Duke.`]
       };
    }

    case 'CHALLENGE': {
      const challengerId = action.payload.playerId;
      const challenger = state.players.find(p => p.id === challengerId);

      // Scenario 1: Challenging a Tax (claiming Duke)
      if (state.phase === Phase.CHALLENGE_WINDOW && state.pendingAction?.type === ActionType.TAX) {
         const targetId = state.pendingAction.sourceId; // The one claiming Duke
         const target = state.players.find(p => p.id === targetId)!;
         
         const hasDuke = target.cards.includes(Role.DUKE);
         
         if (hasDuke) {
           // Challenge fails: Challenger loses card, Target swaps Duke, Action succeeds
           // 1. Target swaps card (Simulated by just reshuffling in this MVP or keep simple)
           // 2. Action succeeds (+3 coins)
           // 3. Challenger loses life
           const updatedPlayers = state.players.map(p => {
             if (p.id === target.id) return { ...p, coins: p.coins + 3 }; // Get money
             return p;
           });
           
           // Transition to LOSE_CARD for challenger
           return {
             ...state,
             players: updatedPlayers,
             phase: Phase.LOSE_CARD,
             victimId: challengerId,
             logs: [...state.logs, `Challenge Failed! ${target.name} had the Duke. ${challenger?.name} loses influence.`]
           };
         } else {
           // Challenge succeeds: Target loses card, Action fails
           return {
             ...state,
             phase: Phase.LOSE_CARD,
             victimId: targetId,
             logs: [...state.logs, `Challenge Successful! ${target.name} did NOT have Duke.`]
           };
         }
      }

      // Scenario 2: Challenging a Block (claiming Duke)
      if (state.phase === Phase.BLOCK_RESPONSE) {
          const blockerId = state.pendingAction!.blockedBy!;
          const blocker = state.players.find(p => p.id === blockerId)!;
          const hasDuke = blocker.cards.includes(Role.DUKE);

          if (hasDuke) {
            // Challenge fails: Challenger (original actor) loses card. Block stands.
             return {
                ...state,
                phase: Phase.LOSE_CARD,
                victimId: state.pendingAction!.sourceId,
                logs: [...state.logs, `Challenge Failed! ${blocker.name} had Duke. Block stands.`]
             };
          } else {
             // Challenge succeeds: Blocker loses card. Block fails. Original action succeeds.
             // Apply original action result
             let updatedPlayers = [...state.players];
             if (state.pendingAction!.type === ActionType.FOREIGN_AID) {
                updatedPlayers = updatedPlayers.map(p => 
                  p.id === state.pendingAction!.sourceId ? { ...p, coins: p.coins + 2 } : p
                );
             }
             
             return {
                ...state,
                players: updatedPlayers,
                phase: Phase.LOSE_CARD,
                victimId: blockerId,
                logs: [...state.logs, `Challenge Successful! ${blocker.name} lied about Duke.`]
             };
          }
      }

      return state;
    }

    case 'LOSE_CARD': {
      const { playerId, cardIndex } = action.payload;
      if (state.victimId !== playerId) return state; // Security check

      const player = state.players.find(p => p.id === playerId);
      if (!player) return state;

      const updatedPlayer = killPlayerCard(player, cardIndex);
      const updatedPlayers = state.players.map(p => p.id === playerId ? updatedPlayer : p);
      
      const newState = {
        ...state,
        players: updatedPlayers,
        phase: Phase.ACTION_SELECTION, // Reset to standard flow, will be overridden by nextTurn if needed
        victimId: null
      };

      const finalState = checkWinCondition(newState);
      if (finalState.phase === Phase.GAME_OVER) return finalState;

      // If the victim was the one acting or being challenged, we typically proceed to next turn
      // Simplified: Always next turn after a death resolution unless game over
      return nextTurn(finalState);
    }

    default:
      return state;
  }
};