import React from 'react';
import { Player, Role, Language } from '../types';
import { I18N } from '../constants';
import { User, Coins, Skull } from 'lucide-react';

interface PlayerCardProps {
  player: Player;
  isMe: boolean;
  isCurrentTurn: boolean;
  lang: Language;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({ player, isMe, isCurrentTurn, lang }) => {
  if (!player.isAlive) {
    return (
      <div className="flex items-center p-3 rounded-lg bg-gray-100 border border-gray-200 opacity-60">
        <Skull className="w-5 h-5 mr-3 text-gray-400" />
        <span className="line-through text-gray-500 font-medium">{player.name}</span>
      </div>
    );
  }

  return (
    <div className={`
      relative p-4 rounded-xl border-2 transition-all
      ${isCurrentTurn ? 'border-slate-800 bg-white shadow-lg scale-[1.02]' : 'border-transparent bg-white shadow-sm'}
    `}>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isMe ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>
            <User size={18} />
          </div>
          <span className="font-bold text-slate-900">
            {player.name} {isMe && <span className="text-xs bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded ml-1">{I18N[lang].game.you}</span>}
          </span>
        </div>
        <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-full border border-yellow-100 text-yellow-700">
          <Coins size={14} />
          <span className="font-bold text-sm">{player.coins}</span>
        </div>
      </div>

      <div className="flex gap-2">
        {isMe ? (
          player.cards.map((card, idx) => (
            <div key={idx} className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-semibold text-center text-slate-700">
              {I18N[lang].roles[card]}
            </div>
          ))
        ) : (
          player.cards.map((_, idx) => (
            <div key={idx} className="flex-1 bg-slate-800 rounded px-2 py-1 text-xs font-semibold text-center text-slate-300">
              ?
            </div>
          ))
        )}
        {player.lostCards.map((card, idx) => (
           <div key={`lost-${idx}`} className="flex-1 bg-red-50 border border-red-100 rounded px-2 py-1 text-xs font-semibold text-center text-red-300 line-through">
              {I18N[lang].roles[card]}
            </div>
        ))}
      </div>
    </div>
  );
};