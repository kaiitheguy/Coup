/**
 * Easter egg mapping: name (trim + lowercase) -> visual config.
 * Badge is emoji only; no label text. Visual only, no gameplay logic.
 */

export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export interface EasterEggConfig {
  emoji: string;
  /** Not used; badge is emoji only */
  badgeText: null;
  cardClass: string;
  nameClass: string;
  turnClass?: string;
  themeClass?: string;
  /** Applied to Coup button when this player is acting */
  actionCoupClass?: string;
  onJoinEffect?: 'confetti' | null;
}

const EGGS: Record<string, EasterEggConfig> = {
  tojaki: {
    emoji: '🐤',
    badgeText: null,
    cardClass: 'ring-2 ring-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.35)]',
    nameClass: 'text-amber-600 font-semibold',
    turnClass: 'bg-amber-50 border-amber-300',
    onJoinEffect: undefined,
  },
  '1k': {
    emoji: '🫶',
    badgeText: null,
    nameClass: 'text-pink-600 font-semibold',
    cardClass: 'ring-1 ring-pink-300',
    onJoinEffect: 'confetti',
  },
  wd9: {
    emoji: '🐍',
    badgeText: null,
    nameClass: 'text-emerald-700 font-medium',
    cardClass: 'border-emerald-400',
    themeClass: 'bg-slate-50/80 border-slate-200',
  },
  lll: {
    emoji: '🦷',
    badgeText: null,
    nameClass: 'text-indigo-600',
    cardClass: 'animate-[wiggle_0.6s_ease-in-out_1]',
  },
  kw: {
    emoji: '🐟',
    badgeText: null,
    nameClass: 'text-cyan-700 font-semibold',
    cardClass: 'ring-1 ring-cyan-300',
    actionCoupClass: 'shadow-[0_0_16px_rgba(34,211,238,0.45)]',
  },
  jojo: {
    emoji: '👄',
    badgeText: null,
    cardClass: 'border-rose-200',
    nameClass: 'text-rose-600 font-semibold',
    turnClass: 'bg-rose-50 border-rose-300 ring-2 ring-rose-200 ring-offset-2 shadow-md',
  },
};

/** Normalized name -> egg key */
const NAME_TO_KEY: Record<string, string> = {};
const PAIRS: [string, string][] = [
  ['tojaki', 'tojaki'],
  ['jaki', 'tojaki'],
  ['1k', '1k'],
  ['kai', '1k'],
  ['wd9', 'wd9'],
  ['william', 'wd9'],
  ['lll', 'lll'],
  ['luciar', 'lll'],
  ['kw', 'kw'],
  ['yusir', 'kw'],
  ['jojo', 'jojo'],
  ['jo', 'jojo'],
];
PAIRS.forEach(([norm, key]) => {
  NAME_TO_KEY[norm] = key;
});

export function getEgg(playerName: string): EasterEggConfig | undefined {
  const key = NAME_TO_KEY[normalizeName(playerName)];
  return key ? EGGS[key] : undefined;
}

export function hasJoinConfetti(playerName: string): boolean {
  const egg = getEgg(playerName);
  return egg?.onJoinEffect === 'confetti';
}

export function getCoupButtonClass(playerName: string): string | undefined {
  return getEgg(playerName)?.actionCoupClass;
}
