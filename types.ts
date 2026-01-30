export type Language = 'en' | 'zh';

export enum Phase {
  LOBBY = 'LOBBY',
  ACTION_SELECTION = 'ACTION_SELECTION',
  CHALLENGE_WINDOW = 'CHALLENGE_WINDOW', // Waiting for others to Challenge or Block
  BLOCK_RESPONSE = 'BLOCK_RESPONSE', // Action was blocked, waiting for actor to Challenge or Pass
  LOSE_CARD = 'LOSE_CARD', // Someone needs to lose a life
  EXCHANGE_SELECT = 'EXCHANGE_SELECT', // Ambassador exchange: player chooses 2 cards to return
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
  ASSASSINATE = 'assassinate',
  STEAL = 'steal',
  EXCHANGE = 'exchange',
  BLOCK_FOREIGN_AID = 'block_foreign_aid',
  BLOCK_ASSASSINATE = 'block_assassinate',
  BLOCK_STEAL = 'block_steal',
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
  blockedByRole?: Role; // Role claimed by blocker (for challenge flow)
}

/** Structured log entry (ids only); client formats to display name using getPlayerName */
export type LogEntry =
  | { type: 'game_start' }
  | { type: 'game_over'; winnerId: string }
  | { type: 'income'; actorId: string }
  | { type: 'coup'; actorId: string; targetId: string }
  | { type: 'action_attempt'; actionType: ActionType; actorId: string; targetId?: string }
  | { type: 'block'; blockerId: string; role: Role }
  | { type: 'block_accepted' }
  | { type: 'steal_success'; actorId: string; targetId: string; amount: number }
  | { type: 'tax_success'; actorId: string }
  | { type: 'foreign_aid_success'; actorId: string }
  | { type: 'exchange_start'; actorId: string }
  | { type: 'exchange_done'; actorId: string }
  | { type: 'challenge_started'; challengerId: string; challengedId: string; claimedRole: Role }
  | { type: 'challenge_success'; challengerId: string; challengedId: string; claimedRole: Role }
  | { type: 'challenge_fail'; challengerId: string; challengedId: string; claimedRole: Role; loserId: string }
  | { type: 'challenge_success_actor'; actorId: string; loserId?: string }
  | { type: 'challenge_success_block'; blockerId: string; message: 'assassinate' | 'action' }
  | { type: 'assassinate_victim'; targetId: string };

export interface GameState {
  roomId: string;
  hostPlayerId: string;
  phase: Phase;
  players: Player[];
  turnIndex: number;
  deck: Role[];
  pendingAction: PendingAction | null;
  /** Structured entries (ids); client formats with getPlayerName. Backward compat: string treated as raw line. */
  logs: (string | LogEntry)[];
  winnerId: string | null;
  victimId: string | null; // The player who must currently lose a card
  exchangePlayerId?: string | null; // During EXCHANGE_SELECT: player choosing cards to return
  exchangeDrawnCards?: Role[]; // Cards drawn for exchange (player has original + these, must return 2)
  deferredExchangeSourceId?: string | null; // After challenger loses card on Exchange challenge fail, do exchange for this player
  /** During CHALLENGE_WINDOW: ids of players who have passed (action proceeds only when all other alive have passed) */
  passedResponderIds?: string[];
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
    leaveRoom: string;
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
    returnTwoCards: string;
    mustCoup: string;
    playAgain: string;
    playAgainHostOnly: string;
    exitGame: string;
  };
  actions: {
    [key in ActionType]: string;
  };
  roles: {
    [key in Role]: string;
  };
  cheatsheet: {
    title: string;
    duke: string;
    assassin: string;
    captain: string;
    ambassador: string;
    contessa: string;
  };
  status: {
    waiting: string;
    challenging: string;
    blocking: string;
    resolving: string;
    exchangeSelect: string;
  };
  /** Mobile/prompt overlay labels */
  prompt: {
    respond: string;
    doNotBlock: string;
    needCoins: string;
    noValidTarget: string;
    deckTooSmall: string;
    cardLost: string;
    confirm: string;
    cancel: string;
    chooseCardToLose: string;
    usesAction: string;
    blockedYourAction: string;
    claimTheyLie: string;
    acceptBlock: string;
  };
  /** Short labels for mobile action bar */
  actionsShort: {
    [ActionType.INCOME]: string;
    [ActionType.FOREIGN_AID]: string;
    [ActionType.TAX]: string;
    [ActionType.STEAL]: string;
    [ActionType.ASSASSINATE]: string;
    [ActionType.COUP]: string;
    [ActionType.EXCHANGE]: string;
  };
  /** Game log message templates; placeholders: {actor}, {target}, {winner}, {blocker}, {role}, {loser}, {action}, {amount} */
  log: {
    game_start: string;
    game_over: string;
    income_used: string;
    coup: string;
    action_attempt: string;
    action_attempt_target: string;
    block: string;
    block_accepted: string;
    steal_success: string;
    tax_success: string;
    foreign_aid_success: string;
    exchange_start: string;
    exchange_done: string;
    challenge_started: string;
    challenge_success: string;
    challenge_fail: string;
    challenge_success_actor: string;
    challenge_success_actor_loser: string;
    challenge_success_block_assassinate: string;
    challenge_success_block_action: string;
    assassinate_victim: string;
    unknown_event: string;
  };
}