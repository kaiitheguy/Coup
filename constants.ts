import { I18nSchema, Role, ActionType } from './types';

export const INITIAL_COINS = 2;
export const MAX_PLAYERS = 6;
export const MIN_PLAYERS = 2;

export const ROLES_DECK = [
  Role.DUKE, Role.DUKE, Role.DUKE,
  Role.ASSASSIN, Role.ASSASSIN, Role.ASSASSIN,
  Role.CAPTAIN, Role.CAPTAIN, Role.CAPTAIN,
  Role.AMBASSADOR, Role.AMBASSADOR, Role.AMBASSADOR,
  Role.CONTESSA, Role.CONTESSA, Role.CONTESSA
];

export const I18N: Record<string, I18nSchema> = {
  en: {
    lobby: {
      title: "COUP WEB",
      create: "Create Room",
      join: "Join Room",
      enterName: "Enter your name",
      roomCode: "Room Code",
      waiting: "Waiting for host to start...",
      waitingForPlayers: "Waiting for more players...",
      youCanStart: "You can start the game.",
      startGame: "Start Game",
      needPlayers: "Need at least 2 players",
      players: "Players",
      host: "HOST"
    },
    game: {
      round: "Round",
      turn: "Turn",
      coins: "Coins",
      cards: "Cards",
      logs: "Game Log",
      dead: "Eliminated",
      you: "YOU",
      target: "Select Target",
      winner: "Winner!",
      actionRequired: "Your Action Required",
      loseCard: "You must lose an influence"
    },
    actions: {
      [ActionType.INCOME]: "Income (+1)",
      [ActionType.FOREIGN_AID]: "Foreign Aid (+2)",
      [ActionType.TAX]: "Tax (+3)",
      [ActionType.COUP]: "Coup (-7)",
      [ActionType.BLOCK_FOREIGN_AID]: "Block (Duke)",
      [ActionType.CHALLENGE]: "Challenge",
      [ActionType.PASS]: "Pass"
    },
    roles: {
      [Role.DUKE]: "Duke",
      [Role.ASSASSIN]: "Assassin",
      [Role.CAPTAIN]: "Captain",
      [Role.AMBASSADOR]: "Ambassador",
      [Role.CONTESSA]: "Contessa"
    },
    status: {
      waiting: "Waiting for action...",
      challenging: "Challenge Window",
      blocking: "Block Opportunity",
      resolving: "Resolving...",
    }
  },
  zh: {
    lobby: {
      title: "政变风云",
      create: "创建房间",
      join: "加入房间",
      enterName: "输入昵称",
      roomCode: "房间号",
      waiting: "等待房主开始...",
      waitingForPlayers: "等待更多玩家...",
      youCanStart: "您可以开始游戏",
      startGame: "开始游戏",
      needPlayers: "至少需要2名玩家",
      players: "玩家列表",
      host: "房主"
    },
    game: {
      round: "回合",
      turn: "的回合",
      coins: "金币",
      cards: "手牌",
      logs: "游戏记录",
      dead: "已淘汰",
      you: "你",
      target: "选择目标",
      winner: "获胜者!",
      actionRequired: "请执行操作",
      loseCard: "你必须弃掉一张手牌"
    },
    actions: {
      [ActionType.INCOME]: "收入 (+1)",
      [ActionType.FOREIGN_AID]: "外援 (+2)",
      [ActionType.TAX]: "税收 (+3)",
      [ActionType.COUP]: "政变 (-7)",
      [ActionType.BLOCK_FOREIGN_AID]: "阻挡 (公爵)",
      [ActionType.CHALLENGE]: "质疑",
      [ActionType.PASS]: "过"
    },
    roles: {
      [Role.DUKE]: "公爵",
      [Role.ASSASSIN]: "刺客",
      [Role.CAPTAIN]: "队长",
      [Role.AMBASSADOR]: "大使",
      [Role.CONTESSA]: "伯爵夫人"
    },
    status: {
      waiting: "等待行动...",
      challenging: "质疑窗口",
      blocking: "阻挡窗口",
      resolving: "结算中...",
    }
  }
};