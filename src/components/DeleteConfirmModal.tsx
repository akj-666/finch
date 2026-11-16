import React, { useEffect, useRef } from 'react';
import { Trash2, X, AlertTriangle, Calendar, Tag } from 'lucide-react';
import { Expense } from '../types';
import { formatINR, formatDate } from '../utils/formatters';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  expense: Expense | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  expense,
  onClose,
  onConfirm,
}) => {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      setTimeout(() => {
        cancelBtnRef.current?.focus();
      }, 50);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !expense) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      <div
        className="bg-[#FFF8EE] rounded-2xl max-w-md w-full shadow-2xl border border-[#e5decb] overflow-hidden my-6 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Finch Branded Header */}
        <div className="bg-[#0F3B2E] text-[#FFF8EE] px-5 py-4 flex items-center justify-between border-b border-[#185241]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-red-950/60 border border-red-500/50 flex items-center justify-center flex-shrink-0 text-red-400">
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h3 id="delete-dialog-title" className="text-sm font-bold text-[#FFF8EE] tracking-tight">
                Delete Expense Record
              </h3>
              <span className="text-[10px] text-[#C89B3C] font-semibold tracking-wide">
                Finch Expense Ledger
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#d8cfbe] hover:text-[#FFF8EE] hover:bg-[#185241] transition-colors cursor-pointer"
            aria-label="Cancel deletion"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4">
          <p className="text-xs sm:text-sm text-[#4a5e54] leading-relaxed">
            Are you sure you want to permanently remove this expense? This action will remove the record and any attached receipts from both local storage and database.
          </p>

          {/* Itemized expense snapshot */}
          <div className="p-4 rounded-xl bg-white border border-[#e5decb] shadow-xs space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-semibold text-[#6e8278] flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#C89B3C]" />
                {formatDate(expense.date)}
              </span>
              <span className="text-base font-extrabold text-[#0F3B2E] font-mono tracking-tight">
                {formatINR(expense.amount)}
              </span>
            </div>

            <div className="font-bold text-sm text-[#0F3B2E] leading-snug">
              {expense.description}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-[#f4efe4] text-[#42524a] font-medium text-[11px] border border-[#e5decb]">
                {expense.category}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                  expense.nature === 'CapEx'
                    ? 'bg-[#e8f1fa] text-[#1e4e79] border-[#bad5f0]'
                    : 'bg-[#fff6e0] text-[#8c5e00] border-[#fce3a8]'
                }`}
              >
                {expense.nature}
              </span>
              {expense.kioskTag && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-[#E8F3EE] text-[#0F3B2E] border border-[#C3DFD3]">
                  <Tag className="w-2.5 h-2.5 mr-1" />
                  {expense.kioskTag}
                </span>
              )}
            </div>

            {expense.hasReceipt && (
              <div className="text-[11px] text-[#71857c] italic flex items-center gap-1 pt-1 border-t border-[#f2ede2]">
                <span>📎 Includes attached receipt file ({expense.receiptName || 'receipt'})</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-5 py-4 bg-[#FAF7F0] border-t border-[#f0ebd9] flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[#d9cfbe] text-xs font-semibold text-[#5a6e64] hover:bg-white transition-colors cursor-pointer text-center"
          >
            Keep Expense
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Permanently</span>
          </button>
        </div>
      </div>
    </div>
  );
};
