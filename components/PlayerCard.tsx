import React from 'react';
import { Player, Language } from '../types';
import { I18N } from '../constants';
import { RoleChip } from '../constants/roleMeta';
import { getEgg } from '../src/easterEggs';
import { User, Coins, Skull } from 'lucide-react';

interface PlayerCardProps {
  player: Player;
  isMe: boolean;
  isCurrentTurn: boolean;
  lang: Language;
  isTargetSelectable?: boolean;
  isTargetSelected?: boolean;
  onTargetClick?: () => void;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  isMe,
  isCurrentTurn,
  lang,
  isTargetSelectable,
  isTargetSelected,
  onTargetClick,
}) => {
  if (!player.isAlive) {
    return (
      <div className="flex items-center p-3 rounded-xl border border-slate-200 bg-slate-50 grayscale opacity-40 transition-all">
        <Skull className="w-5 h-5 mr-3 text-slate-400 shrink-0" aria-hidden />
        <span className="line-through text-slate-500 font-medium">{player.name}</span>
      </div>
    );
  }

  const t = I18N[lang];
  const isClickable = isTargetSelectable && onTargetClick;
  const egg = getEgg(player.name);
  const turnDefault = 'border-indigo-400 bg-white shadow-lg ring-2 ring-indigo-200 ring-offset-2';
  const turnStyle = isCurrentTurn ? (egg?.turnClass ?? turnDefault) : 'border-slate-200 bg-white shadow-sm';

  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? onTargetClick : undefined}
      onKeyDown={isClickable ? (e) => e.key === 'Enter' && onTargetClick?.() : undefined}
      className={`
        relative p-4 rounded-xl border-2 transition-all
        ${turnStyle}
        ${egg ? ` ${egg.cardClass}` : ''}
        ${egg?.themeClass ?? ''}
        ${isTargetSelectable ? 'cursor-pointer hover:border-slate-400 hover:shadow-md' : ''}
        ${isTargetSelected ? 'ring-2 ring-indigo-500 ring-offset-2 border-indigo-400' : ''}
        ${isTargetSelectable && !isTargetSelected ? 'border-dashed border-slate-300' : ''}
      `}
    >
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isMe ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>
            <User size={18} />
          </div>
          <span className={egg ? egg.nameClass : 'font-bold text-slate-900'}>
            {player.name}
            {egg && <span className="ml-1.5 text-lg bg-transparent" aria-hidden>{egg.emoji}</span>}
            {isMe && <span className="text-xs bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded ml-1">{t.game.you}</span>}
          </span>
        </div>
        <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-full border border-yellow-100 text-yellow-700">
          <Coins size={14} />
          <span className="font-bold text-sm">{player.coins}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {isMe ? (
          player.cards.map((card, idx) => (
            <RoleChip key={idx} role={card} label={t.roles[card]} size="sm" />
          ))
        ) : (
          player.cards.map((_, idx) => (
            <span
              key={idx}
              className="inline-flex items-center justify-center gap-1 rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 min-w-[2.5rem] min-h-[1.75rem] text-xs font-semibold text-slate-300"
            >
              ?
            </span>
          ))
        )}
        {player.lostCards.map((card, idx) => (
          <span key={`lost-${idx}`} className="opacity-70 line-through">
            <RoleChip role={card} label={t.roles[card]} size="sm" />
          </span>
        ))}
      </div>
    </div>
  );
};