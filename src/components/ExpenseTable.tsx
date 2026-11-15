import React from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  Tag,
  CreditCard,
  Building,
  Smartphone,
  Banknote,
  AlertCircle,
  FileText,
  Paperclip,
  Image as ImageIcon,
} from 'lucide-react';
import { Expense, SortState, SortColumn, PaymentMode } from '../types';
import { formatINR, formatDate } from '../utils/formatters';
import { CATEGORY_META } from '../utils/categoryMeta';

interface ExpenseTableProps {
  expenses: Expense[];
  sortState: SortState;
  onSortChange: (column: SortColumn) => void;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (expense: Expense) => void;
  onAddExpense: () => void;
  onResetFilters: () => void;
  onViewReceipt: (expense: Expense) => void;
  isFiltered: boolean;
}

export const ExpenseTable: React.FC<ExpenseTableProps> = ({
  expenses,
  sortState,
  onSortChange,
  onEditExpense,
  onDeleteExpense,
  onAddExpense,
  onResetFilters,
  onViewReceipt,
  isFiltered,
}) => {
  const totalVisibleAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

  const getSortIcon = (column: SortColumn) => {
    if (sortState.column !== column) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-700 ml-1" />;
    }
    return sortState.direction === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-[#0F3B2E] ml-1 stroke-[2.5]" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-[#0F3B2E] ml-1 stroke-[2.5]" />
    );
  };

  const getPaymentModeIcon = (mode: PaymentMode) => {
    switch (mode) {
      case 'UPI':
        return <Smartphone className="w-3 h-3 text-emerald-700 mr-1" />;
      case 'Bank Transfer':
        return <Building className="w-3 h-3 text-blue-700 mr-1" />;
      case 'Card':
        return <CreditCard className="w-3 h-3 text-purple-700 mr-1" />;
      case 'Cash':
        return <Banknote className="w-3 h-3 text-amber-700 mr-1" />;
      default:
        return null;
    }
  };

  if (expenses.length === 0) {
    return (
      <div className="bg-white rounded-xl p-8 sm:p-10 border border-[#e5decb] shadow-xs text-center">
        <div className="max-w-md mx-auto flex flex-col items-center">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#f4eee2] text-[#C89B3C] flex items-center justify-center mb-3 sm:mb-4">
            <AlertCircle className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <h3 className="font-bold text-base sm:text-lg text-[#0F3B2E]">No Expenses Match Your Filters</h3>
          <p className="text-xs sm:text-sm text-[#6e8278] mt-1 mb-5">
            {isFiltered
              ? 'Try widening the date range, selecting "All Categories", or clearing your search term.'
              : 'You have no recorded expenses yet. Click Record Expense above to add your first entry!'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {isFiltered && (
              <button
                onClick={onResetFilters}
                className="px-4 py-2 bg-[#FAF7F0] border border-[#d9cfbe] text-[#0F3B2E] rounded-lg text-xs sm:text-sm font-semibold hover:bg-[#ede5d5] transition-colors"
              >
                Clear All Filters
              </button>
            )}
            <button
              onClick={onAddExpense}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#0F3B2E] text-[#FFF8EE] rounded-lg text-xs sm:text-sm font-bold hover:bg-[#185241] shadow-xs transition-colors"
            >
              <span>Record Expense</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[#e5decb] shadow-xs overflow-hidden mb-12">
      {/* Table Subheader: Clean Overview */}
      <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-b border-[#f0ebd9] flex items-center justify-between gap-2 bg-[#FAF7F0]">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-[#0F3B2E]">Expense Ledger</h2>
          <p className="text-[11px] sm:text-xs text-[#6e8278]">
            Showing {expenses.length} records • Tap headers to sort
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] sm:text-xs text-[#6e8278] font-medium">Visible Total</div>
          <div className="text-sm sm:text-base font-extrabold text-[#0F3B2E]">{formatINR(totalVisibleAmount)}</div>
        </div>
      </div>

      {/* Desktop / Tablet Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-[#f5efe4] text-[#42524a] text-xs uppercase font-bold border-b border-[#e5decb]">
              {/* Date */}
              <th
                onClick={() => onSortChange('date')}
                className="py-3 px-4 cursor-pointer hover:bg-[#ece4d5] transition-colors select-none group"
              >
                <div className="flex items-center">
                  <span>Date</span>
                  {getSortIcon('date')}
                </div>
              </th>

              {/* Description & Reference */}
              <th
                onClick={() => onSortChange('description')}
                className="py-3 px-4 cursor-pointer hover:bg-[#ece4d5] transition-colors select-none group"
              >
                <div className="flex items-center">
                  <span>Description & Tags</span>
                  {getSortIcon('description')}
                </div>
              </th>

              {/* Category */}
              <th
                onClick={() => onSortChange('category')}
                className="py-3 px-4 cursor-pointer hover:bg-[#ece4d5] transition-colors select-none group"
              >
                <div className="flex items-center">
                  <span>Category</span>
                  {getSortIcon('category')}
                </div>
              </th>

              {/* Nature */}
              <th
                onClick={() => onSortChange('nature')}
                className="py-3 px-4 cursor-pointer hover:bg-[#ece4d5] transition-colors select-none group text-center"
              >
                <div className="flex items-center justify-center">
                  <span>Nature</span>
                  {getSortIcon('nature')}
                </div>
              </th>

              {/* Payment Mode */}
              <th className="py-3 px-4 select-none text-center">Payment Mode</th>

              {/* Receipt Attachment Indicator */}
              <th className="py-3 px-3 select-none text-center">Receipt</th>

              {/* Amount */}
              <th
                onClick={() => onSortChange('amount')}
                className="py-3 px-4 cursor-pointer hover:bg-[#ece4d5] transition-colors select-none group text-right"
              >
                <div className="flex items-center justify-end">
                  <span>Amount</span>
                  {getSortIcon('amount')}
                </div>
              </th>

              {/* Actions */}
              <th className="py-3 px-4 text-center select-none">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f2ede2]">
            {expenses.map((expense) => {
              const meta = CATEGORY_META[expense.category];
              return (
                <tr
                  key={expense.id}
                  className="hover:bg-[#FFFDF9] transition-colors group"
                >
                  {/* Date */}
                  <td className="py-3 px-4 whitespace-nowrap text-xs font-semibold text-[#37473f]">
                    {formatDate(expense.date)}
                  </td>

                  {/* Description */}
                  <td className="py-3 px-4">
                    <div className="font-semibold text-[#0F3B2E] text-sm">
                      {expense.description}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      {expense.kioskTag && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#E8F3EE] text-[#0F3B2E] border border-[#C3DFD3]">
                          <Tag className="w-2.5 h-2.5 mr-1" />
                          {expense.kioskTag}
                        </span>
                      )}
                      {expense.notes && (
                        <span
                          className="inline-flex items-center text-[10px] text-[#71857c] italic truncate max-w-xs"
                          title={expense.notes}
                        >
                          <FileText className="w-2.5 h-2.5 mr-1 flex-shrink-0" />
                          {expense.notes}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Category */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      style={{
                        backgroundColor: meta?.bgLight || '#f3f4f6',
                        color: meta?.textColor || '#1f2937',
                        borderColor: meta?.borderColor || '#e5e7eb',
                      }}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border"
                    >
                      {expense.category}
                    </span>
                  </td>

                  {/* Nature (CapEx vs OpEx) */}
                  <td className="py-3 px-4 whitespace-nowrap text-center">
                    {expense.nature === 'CapEx' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-[#e8f1fa] text-[#1e4e79] border border-[#bad5f0]">
                        CapEx
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-[#fff6e0] text-[#8c5e00] border border-[#fce3a8]">
                        OpEx
                      </span>
                    )}
                  </td>

                  {/* Payment Mode */}
                  <td className="py-3 px-4 whitespace-nowrap text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#f0ebd9] text-[#42524a]">
                      {getPaymentModeIcon(expense.paymentMode)}
                      {expense.paymentMode}
                    </span>
                  </td>

                  {/* Receipt Attachment Indicator */}
                  <td className="py-3 px-3 whitespace-nowrap text-center">
                    {expense.hasReceipt ? (
                      <button
                        onClick={() => onViewReceipt(expense)}
                        title={`View receipt: ${expense.receiptName || 'Receipt'}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-colors shadow-2xs"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-emerald-700" />
                        <span className="text-[11px]">View</span>
                      </button>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>

                  {/* Amount */}
                  <td className="py-3 px-4 whitespace-nowrap text-right font-extrabold text-[#0F3B2E] text-sm font-mono">
                    {formatINR(expense.amount)}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center space-x-1">
                      <button
                        onClick={() => onEditExpense(expense)}
                        title="Edit expense"
                        className="p-1.5 rounded-md text-[#5a6e64] hover:text-[#0F3B2E] hover:bg-[#f0ebd9] transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteExpense(expense)}
                        title="Delete expense"
                        className="p-1.5 rounded-md text-[#8A5323] hover:text-red-700 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* Note: Subtotal sum footer at the end of expense rows has been removed per user specification */}
        </table>
      </div>

      {/* Mobile Card View (optimized for phones) */}
      <div className="md:hidden divide-y divide-[#f2ede2]">
        {expenses.map((expense) => {
          const meta = CATEGORY_META[expense.category];
          return (
            <div key={expense.id} className="p-3.5 space-y-2">
              {/* Header: Date, Description, Amount */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold text-[#6e8278]">
                    {formatDate(expense.date)}
                  </span>
                  <div className="font-bold text-[#0F3B2E] text-sm leading-snug mt-0.5 break-words">
                    {expense.description}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-extrabold text-[#0F3B2E] font-mono">
                    {formatINR(expense.amount)}
                  </div>
                </div>
              </div>

              {/* Badges: Category, Nature, Mode, Tag, Receipt */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span
                  style={{
                    backgroundColor: meta?.bgLight || '#f3f4f6',
                    color: meta?.textColor || '#1f2937',
                    borderColor: meta?.borderColor || '#e5e7eb',
                  }}
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium border"
                >
                  {expense.category}
                </span>

                {expense.nature === 'CapEx' ? (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#e8f1fa] text-[#1e4e79] border border-[#bad5f0]">
                    CapEx
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#fff6e0] text-[#8c5e00] border border-[#fce3a8]">
                    OpEx
                  </span>
                )}

                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[#f0ebd9] text-[#42524a]">
                  {getPaymentModeIcon(expense.paymentMode)}
                  {expense.paymentMode}
                </span>

                {expense.kioskTag && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#E8F3EE] text-[#0F3B2E] border border-[#C3DFD3]">
                    <Tag className="w-2.5 h-2.5 mr-1" />
                    {expense.kioskTag}
                  </span>
                )}

                {expense.hasReceipt && (
                  <button
                    onClick={() => onViewReceipt(expense)}
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                  >
                    <Paperclip className="w-2.5 h-2.5 mr-1 text-emerald-700" />
                    Receipt
                  </button>
                )}
              </div>

              {/* Notes */}
              {expense.notes && (
                <div className="text-[11px] text-[#71857c] italic bg-[#faf7f0] p-1.5 rounded border border-[#f0ebd9]">
                  {expense.notes}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-1.5 border-t border-[#f7f2e7]">
                <div className="text-[10px] text-[#7e998e]">
                  {expense.hasReceipt ? 'Receipt on file' : 'No receipt attached'}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onEditExpense(expense)}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[#FAF7F0] text-[#0F3B2E] border border-[#d9cfbe] text-[11px] font-semibold hover:bg-[#eee5d5]"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => onDeleteExpense(expense)}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 text-[11px] font-semibold hover:bg-red-100"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {/* Note: Subtotal sum footer at the end of mobile cards has been removed per user specification */}
      </div>
    </div>
  );
};
