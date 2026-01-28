import React, { useEffect, useRef } from 'react';
import { Language } from '../types';
import { I18N } from '../constants';

interface GameLogProps {
  logs: string[];
  lang: Language;
}

export const GameLog: React.FC<GameLogProps> = ({ logs, lang }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex flex-col h-full bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
      <div className="p-3 bg-white border-b border-slate-100 font-bold text-xs uppercase text-slate-400 tracking-wider">
        {I18N[lang].game.logs}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
        {logs.length === 0 && <div className="text-center text-gray-400 text-sm mt-4">Game started...</div>}
        {logs.map((log, i) => (
          <div key={i} className="text-sm text-slate-600 leading-relaxed border-b border-slate-100 pb-1 last:border-0">
            <span className="text-slate-400 text-xs mr-2">[{i + 1}]</span>
            {log}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};