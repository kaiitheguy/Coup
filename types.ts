export type Language = 'en' | 'zh';

export enum Phase {
  LOBBY = 'LOBBY',
  ACTION_SELECTION = 'ACTION_SELECTION',
  CHALLENGE_WINDOW = 'CHALLENGE_WINDOW', // Waiting for others to Challenge or Block
  BLOCK_RESPONSE = 'BLOCK_RESPONSE', // Action was blocked, waiting for actor to Challenge or Pass
  LOSE_CARD = 'LOSE_CARD', // Someone needs to lose a life
  GAME_OVER = 'GAME_OVER'
}

export enum Role {
  DUKE = 'duke',
  ASSASSIN = 'assassin',
  CAPTAIN = 'captain',
  AMBASSADOR = 'ambassador',
  CONTESSA = 'contessa'
}

export enum ActionType {
  INCOME = 'income',
  FOREIGN_AID = 'foreign_aid',
  TAX = 'tax',
  COUP = 'coup',
  BLOCK_FOREIGN_AID = 'block_foreign_aid',
  CHALLENGE = 'challenge',
  PASS = 'pass'
}

export interface Player {
  id: string;
  name: string;
  coins: number;
  cards: Role[];
  isAlive: boolean;
  lostCards: Role[];
}

export interface PendingAction {
  type: ActionType;
  sourceId: string;
  targetId?: string;
  blockedBy?: string; // If blocked, who blocked it
}

export interface GameState {
  roomId: string;
  hostPlayerId: string;
  phase: Phase;
  players: Player[];
  turnIndex: number;
  deck: Role[];
  pendingAction: PendingAction | null;
  logs: string[];
  winnerId: string | null;
  victimId: string | null; // The player who must currently lose a card
}

export interface I18nSchema {
  lobby: {
    title: string;
    create: string;
    join: string;
    enterName: string;
    roomCode: string;
    waiting: string;
    waitingForPlayers: string;
    youCanStart: string;
    startGame: string;
    needPlayers: string;
    players: string;
    host: string;
  };
  game: {
    round: string;
    turn: string;
    coins: string;
    cards: string;
    logs: string;
    dead: string;
    you: string;
    target: string;
    winner: string;
    actionRequired: string;
    loseCard: string;
  };
  actions: {
    [key in ActionType]: string;
  };
  roles: {
    [key in Role]: string;
  };
  status: {
    waiting: string;
    challenging: string;
    blocking: string;
    resolving: string;
  };
}