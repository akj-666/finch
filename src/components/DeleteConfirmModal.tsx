import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
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
  if (!isOpen || !expense) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#e5decb] overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <div className="bg-red-50 p-5 border-b border-red-100 flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-red-900">Delete Expense Record?</h3>
            <p className="text-xs text-red-700 mt-1">
              This action cannot be undone. Are you sure you want to remove this expense from the ledger?
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Expense Detail summary */}
        <div className="p-5 space-y-3 bg-[#FFFDF9]">
          <div className="p-3.5 rounded-xl bg-white border border-[#e5decb] space-y-2">
            <div className="flex items-start justify-between">
              <span className="text-xs text-[#7e998e] font-medium">{formatDate(expense.date)}</span>
              <span className="text-sm font-extrabold text-[#0F3B2E] font-mono">
                {formatINR(expense.amount)}
              </span>
            </div>
            <div className="font-bold text-sm text-[#0F3B2E]">{expense.description}</div>
            <div className="flex items-center space-x-2 text-xs text-[#5a6e64]">
              <span className="px-2 py-0.5 rounded bg-[#f4efe4] font-medium">
                {expense.category}
              </span>
              <span className="px-2 py-0.5 rounded font-bold bg-[#FAF7F0] border border-[#e5decb]">
                {expense.nature}
              </span>
              {expense.kioskTag && (
                <span className="text-[#0F3B2E] font-semibold">{expense.kioskTag}</span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 bg-white border-t border-[#f0ebd9] flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#d9cfbe] text-xs font-semibold text-[#5a6e64] hover:bg-[#FAF7F0] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Yes, Delete Expense</span>
          </button>
        </div>
      </div>
    </div>
  );
};
