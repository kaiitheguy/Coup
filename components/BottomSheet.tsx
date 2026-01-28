import React, { useEffect } from 'react';

interface BottomSheetProps {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children: React.ReactNode;
  /** Optional urgency badge (e.g. "Respond") */
  urgency?: string;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ open, onClose, title, children, urgency }) => {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40 sm:hidden"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] max-h-[85vh] flex flex-col sm:hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'bottom-sheet-title' : undefined}
      >
        <div className="flex-shrink-0 px-4 pt-4 pb-2 border-b border-slate-100">
          <div className="flex items-center justify-between gap-2">
            {title && (
              <h2 id="bottom-sheet-title" className="text-lg font-bold text-slate-900">
                {title}
              </h2>
            )}
            {urgency && (
              <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                {urgency}
              </span>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 pb-safe">{children}</div>
      </div>
    </>
  );
};
