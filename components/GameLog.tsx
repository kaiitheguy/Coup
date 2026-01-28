import React, { useEffect, useRef } from 'react';
import { Language } from '../types';
import { I18N } from '../constants';
import { classifyLogLine, LogTone } from '../utils/gameUtils';

const TONE_CLASSES: Record<LogTone, string> = {
  system: 'text-slate-600',
  action: 'text-blue-700',
  success: 'text-emerald-700',
  block: 'text-amber-700',
  challenge: 'text-violet-700',
  danger: 'text-red-700',
};

/** Split line into segments; segments at odd indices are bold names */
function segmentWithBold(line: string, boldNames: string[]): (string | React.ReactNode)[] {
  if (boldNames.length === 0) return [line];
  const sorted = [...boldNames].filter(Boolean).sort((a, b) => b.length - a.length);
  const escaped = sorted.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'g');
  const parts = line.split(re);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold text-inherit">{part}</strong> : part
  );
}

interface GameLogProps {
  logs: string[];
  lang: Language;
  /** Player names + role labels to bold in log lines */
  boldNames?: string[];
}

export const GameLog: React.FC<GameLogProps> = ({ logs, lang, boldNames = [] }) => {
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
        {logs.map((log, i) => {
          const tone = classifyLogLine(log);
          const content = segmentWithBold(log, boldNames);
          return (
            <div
              key={i}
              className={`text-sm leading-relaxed border-b border-slate-100 pb-1 last:border-0 ${TONE_CLASSES[tone]}`}
            >
              <span className="text-slate-400 text-xs mr-2 tabular-nums font-mono w-6 inline-block text-right">
                [{i + 1}]
              </span>
              {content}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};