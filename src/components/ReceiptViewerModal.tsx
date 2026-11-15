import React from 'react';
import { X, Download, FileText } from 'lucide-react';
import { formatINR } from '../utils/formatters';
import { Expense } from '../types';

interface ReceiptViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  expense: Expense | null;
}

export const ReceiptViewerModal: React.FC<ReceiptViewerModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  expense,
}) => {
  if (!isOpen || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-[#e5decb] overflow-hidden my-4 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bg-[#0F3B2E] text-[#FFF8EE] px-5 py-3.5 flex items-center justify-between border-b border-[#185241]">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-[#185241] text-[#C89B3C]">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold truncate">
                {expense ? expense.description : 'Receipt Attachment'}
              </h3>
              {expense && (
                <div className="text-xs text-[#d8cfbe] flex items-center gap-2">
                  <span>{expense.date}</span>
                  <span>•</span>
                  <span className="font-semibold text-[#C89B3C]">{formatINR(expense.amount)}</span>
                  {expense.receiptName && (
                    <>
                      <span>•</span>
                      <span className="truncate max-w-[150px]">{expense.receiptName}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={expense?.receiptName || 'finch-receipt.jpg'}
              className="p-1.5 rounded-lg text-[#d8cfbe] hover:text-[#FFF8EE] hover:bg-[#185241] transition-colors"
              title="Download or open original"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#d8cfbe] hover:text-[#FFF8EE] hover:bg-[#185241] transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Image Preview Container */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-[#FAF7F0] flex items-center justify-center min-h-[300px]">
          <img
            src={imageUrl}
            alt={expense?.description || 'Receipt'}
            className="max-h-[70vh] w-auto max-w-full object-contain rounded-lg shadow-md border border-[#e5decb]"
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-white border-t border-[#f0ebd9] flex items-center justify-between text-xs text-[#6e8278]">
          <span>Verified bill / receipt stored securely in local browser storage</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#FAF7F0] hover:bg-[#ece4d5] text-[#0F3B2E] font-semibold border border-[#d9cfbe] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
