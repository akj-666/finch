import React, { useEffect, useRef } from 'react';
import { X, AlertCircle, RotateCcw } from 'lucide-react';

interface NoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  icon?: 'alert' | 'info' | 'finch';
}

export const NoticeModal: React.FC<NoticeModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel = 'Dismiss',
  icon = 'finch',
}) => {
  const primaryButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      // Auto-focus primary action for keyboard accessibility
      setTimeout(() => {
        primaryButtonRef.current?.focus();
      }, 50);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notice-dialog-title"
    >
      <div
        className="bg-[#FFF8EE] rounded-2xl max-w-md w-full shadow-2xl border border-[#e5decb] overflow-hidden my-6 transform transition-all animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Forest Green banner */}
        <div className="bg-[#0F3B2E] text-[#FFF8EE] px-5 py-4 flex items-center justify-between border-b border-[#185241]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-[#185241] border border-[#C89B3C]/50 flex items-center justify-center flex-shrink-0">
              {icon === 'alert' ? (
                <AlertCircle className="w-4 h-4 text-[#C89B3C]" />
              ) : (
                <svg
                  viewBox="310 800 460 410"
                  className="w-5 h-5"
                  role="img"
                  aria-hidden="true"
                >
                  <circle cx="540" cy="1000" r="174" fill="#0f3b2e" />
                  <path
                    d="M570 883c-77 0-137 57-137 137 0 61 33 108 86 130-14 20-33 37-61 49 47 12 96-1 130-34 75-6 129-63 129-139 0-80-63-143-147-143Z"
                    fill="#fff8ee"
                  />
                  <path
                    d="M476 1032c29-40 70-61 122-59-20 14-33 33-38 58 27-13 57-16 89-8-27 36-67 58-115 62-26-12-46-30-58-53Z"
                    fill="#0f3b2e"
                  />
                  <circle cx="611" cy="966" r="11" fill="#c89b3c" />
                  <path d="m684 968 69 22-69 22c7-14 7-30 0-44Z" fill="#c89b3c" />
                </svg>
              )}
            </div>
            <div>
              <h3 id="notice-dialog-title" className="text-sm font-bold text-[#FFF8EE] tracking-tight">
                {title}
              </h3>
              <span className="text-[10px] text-[#C89B3C] font-semibold tracking-wide">
                Finch Expense Tracker
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#d8cfbe] hover:text-[#FFF8EE] hover:bg-[#185241] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body content */}
        <div className="p-6">
          <p className="text-sm text-[#37473f] leading-relaxed">
            {message}
          </p>

          <div className="mt-4 p-3 bg-white rounded-xl border border-[#e5decb] text-xs text-[#6e8278] flex items-start gap-2">
            <span className="text-base leading-none">💡</span>
            <span>
              Tip: Use the timeline selector or clear keyword search to bring expenses into the active period.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-[#FAF7F0] border-t border-[#f0ebd9] flex flex-col sm:flex-row items-center justify-end gap-2.5">
          {primaryActionLabel && onPrimaryAction ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[#d9cfbe] text-xs font-semibold text-[#5a6e64] hover:bg-white transition-colors cursor-pointer text-center order-2 sm:order-1"
              >
                {secondaryActionLabel}
              </button>
              <button
                ref={primaryButtonRef}
                type="button"
                onClick={() => {
                  onPrimaryAction();
                  onClose();
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-5 py-2.5 rounded-xl bg-[#0F3B2E] hover:bg-[#185241] text-[#FFF8EE] text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer order-1 sm:order-2"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#C89B3C]" />
                <span>{primaryActionLabel}</span>
              </button>
            </>
          ) : (
            <button
              ref={primaryButtonRef}
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#0F3B2E] hover:bg-[#185241] text-[#FFF8EE] text-xs font-bold shadow transition-all cursor-pointer"
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
