import React, { useEffect, useRef } from 'react';
import { Language } from '../types';
import { I18N } from '../constants';
import { classifyLogLine, LogTone } from '../utils/gameUtils';

/** Muted tone colors (no neon) for game UI log */
const TONE_CLASSES: Record<LogTone, string> = {
  system: 'text-slate-600',
  action: 'text-indigo-600',
  success: 'text-emerald-600',
  block: 'text-amber-600',
  challenge: 'text-violet-600',
  danger: 'text-rose-600',
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

/** Compact main text — no base text color so TONE_CLASSES[tone] controls color */
const LOG_TEXT = 'text-[14px] leading-5';

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
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 overflow-hidden sm:shadow-sm">
      <div className="px-3 py-2 border-b border-slate-200 font-bold text-xs uppercase text-slate-400 tracking-wider shrink-0">
        {I18N[lang].game.logs}
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 no-scrollbar min-h-0">
        {logs.length === 0 && <div className="text-center text-slate-400 text-sm py-4">Game started...</div>}
        <div className="space-y-0">
          {logs.map((log, i) => {
            const tone = classifyLogLine(log);
            const content = segmentWithBold(log, boldNames);
            return (
              <div
                key={i}
                className="group flex items-start px-3 py-2 rounded-lg hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
              >
                <div className={`flex-1 min-w-0 ${TONE_CLASSES[tone]} ${LOG_TEXT}`}>
                  <span className="text-[11px] text-slate-400 tabular-nums bg-slate-100 rounded px-1.5 py-0.5 mr-2 align-baseline inline-block">
                    #{i + 1}
                  </span>
                  {content}
                </div>
              </div>
            );
          })}
        </div>
        <div ref={bottomRef} />
      </div>
    </div>
  );
};