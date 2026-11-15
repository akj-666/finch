import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { SummaryCards } from './components/SummaryCards';
import { CategoryChart } from './components/CategoryChart';
import { FilterToolbar } from './components/FilterToolbar';
import { ExpenseTable } from './components/ExpenseTable';
import { ExpenseModal, ReceiptAttachmentData } from './components/ExpenseModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { BackupModal } from './components/BackupModal';
import { ReceiptViewerModal } from './components/ReceiptViewerModal';
import {
  Expense,
  FilterState,
  SortState,
  SortColumn,
  ExpenseSummary,
  ExpenseCategory,
} from './types';
import { loadExpenses, saveExpenses } from './utils/storage';
import { INITIAL_EXPENSES } from './utils/seedData';
import { generateExpensePDF } from './utils/pdfGenerator';
import { formatTimeline } from './utils/formatters';
import { saveReceipt, deleteReceipt, getReceipt } from './utils/receiptStorage';
import { CheckCircle2, Plus, MapPin } from 'lucide-react';
import finchIconPng from './assets/finch-icon.png';
import finchIconLightPng from './assets/finch-icon-light.png';

export const App: React.FC = () => {
  // Primary expenses state persisted in localStorage
  const [expenses, setExpenses] = useState<Expense[]>(() => loadExpenses());

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    startDate: '',
    endDate: '',
    category: 'ALL',
    nature: 'ALL',
    searchQuery: '',
  });

  // Sort state
  const [sortState, setSortState] = useState<SortState>({
    column: 'date',
    direction: 'desc',
  });

  // Modal dialog states
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  // Receipt viewer state
  const [viewingReceiptExpense, setViewingReceiptExpense] = useState<Expense | null>(null);
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null);

  // Transient Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Sync with localStorage on any state modification
  useEffect(() => {
    saveExpenses(expenses);
  }, [expenses]);

  // Handle Sort Toggle
  const handleSortChange = (column: SortColumn) => {
    setSortState((prev) => {
      if (prev.column === column) {
        return {
          column,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return {
        column,
        direction: column === 'date' || column === 'amount' ? 'desc' : 'asc',
      };
    });
  };

  // Reset Filters
  const handleResetFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      category: 'ALL',
      nature: 'ALL',
      searchQuery: '',
    });
  };

  // Filter expenses based on current active criteria
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      // Date filters
      if (filters.startDate && exp.date < filters.startDate) return false;
      if (filters.endDate && exp.date > filters.endDate) return false;

      // Category filter
      if (filters.category !== 'ALL' && exp.category !== filters.category) return false;

      // Nature filter
      if (filters.nature !== 'ALL' && exp.nature !== filters.nature) return false;

      // Search keyword filter
      if (filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase().trim();
        const matchDesc = exp.description.toLowerCase().includes(query);
        const matchTag = exp.kioskTag ? exp.kioskTag.toLowerCase().includes(query) : false;
        const matchNotes = exp.notes ? exp.notes.toLowerCase().includes(query) : false;
        const matchCategory = exp.category.toLowerCase().includes(query);
        const matchMode = exp.paymentMode.toLowerCase().includes(query);
        const matchAmount = String(exp.amount).includes(query);

        if (!matchDesc && !matchTag && !matchNotes && !matchCategory && !matchMode && !matchAmount) {
          return false;
        }
      }

      return true;
    });
  }, [expenses, filters]);

  // Sort filtered expenses
  const sortedExpenses = useMemo(() => {
    const list = [...filteredExpenses];
    const { column, direction } = sortState;

    list.sort((a, b) => {
      let comp = 0;
      switch (column) {
        case 'date':
          comp = a.date.localeCompare(b.date);
          break;
        case 'amount':
          comp = a.amount - b.amount;
          break;
        case 'description':
          comp = a.description.localeCompare(b.description);
          break;
        case 'category':
          comp = a.category.localeCompare(b.category);
          break;
        case 'nature':
          comp = a.nature.localeCompare(b.nature);
          break;
      }
      return direction === 'asc' ? comp : -comp;
    });

    return list;
  }, [filteredExpenses, sortState]);

  // Calculate Summary metrics
  const summary: ExpenseSummary = useMemo(() => {
    const allTimeSpend = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalSpend = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const capexSpend = filteredExpenses
      .filter((e) => e.nature === 'CapEx')
      .reduce((sum, e) => sum + e.amount, 0);
    const opexSpend = filteredExpenses
      .filter((e) => e.nature === 'OpEx')
      .reduce((sum, e) => sum + e.amount, 0);

    // Compute top category in filtered selection
    const catMap = new Map<ExpenseCategory, number>();
    filteredExpenses.forEach((e) => {
      catMap.set(e.category, (catMap.get(e.category) || 0) + e.amount);
    });

    let topCategory: ExpenseSummary['topCategory'] = null;
    if (catMap.size > 0 && totalSpend > 0) {
      let maxCat: ExpenseCategory = filteredExpenses[0].category;
      let maxAmount = 0;
      catMap.forEach((amt, cat) => {
        if (amt > maxAmount) {
          maxAmount = amt;
          maxCat = cat;
        }
      });
      topCategory = {
        category: maxCat,
        amount: maxAmount,
        percentage: (maxAmount / totalSpend) * 100,
      };
    }

    return {
      totalSpend,
      capexSpend,
      opexSpend,
      topCategory,
      allTimeSpend,
      filteredCount: filteredExpenses.length,
      allTimeCount: expenses.length,
    };
  }, [expenses, filteredExpenses]);

  // Actions
  const handleSaveExpense = async (
    data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>,
    editId?: string,
    receiptData?: ReceiptAttachmentData | null
  ) => {
    const now = new Date().toISOString();
    const targetId = editId || `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // Handle receipt persistence in IndexedDB
    if (receiptData) {
      await saveReceipt(targetId, receiptData);
    } else if (receiptData === null) {
      await deleteReceipt(targetId);
    }

    if (editId) {
      // Edit existing
      setExpenses((prev) =>
        prev.map((item) =>
          item.id === editId
            ? {
                ...item,
                ...data,
                updatedAt: now,
              }
            : item
        )
      );
      showToast('Expense updated successfully.');
    } else {
      // Add new
      const newExpense: Expense = {
        ...data,
        id: targetId,
        createdAt: now,
        updatedAt: now,
      };
      setExpenses((prev) => [newExpense, ...prev]);
      showToast('New expense recorded to ledger.');
    }
    setEditingExpense(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingExpense) return;
    await deleteReceipt(deletingExpense.id);
    setExpenses((prev) => prev.filter((e) => e.id !== deletingExpense.id));
    showToast(`Deleted "${deletingExpense.description}".`);
    setDeletingExpense(null);
  };

  const handleViewReceipt = async (expense: Expense) => {
    const stored = await getReceipt(expense.id);
    if (stored && stored.dataUrl) {
      setViewingReceiptExpense(expense);
      setViewingReceiptUrl(stored.dataUrl);
    } else {
      showToast('No receipt file found for this expense.');
    }
  };

  const handleImportExpenses = (importedData: Expense[], mode: 'replace' | 'merge') => {
    if (mode === 'replace') {
      setExpenses(importedData);
      showToast(`Imported ${importedData.length} records (replaced existing).`);
    } else {
      // Merge: replace items with matching IDs, append new ones
      setExpenses((prev) => {
        const idMap = new Map<string, Expense>();
        prev.forEach((e) => idMap.set(e.id, e));
        importedData.forEach((e) => idMap.set(e.id, e));
        return Array.from(idMap.values());
      });
      showToast(`Merged ${importedData.length} imported records.`);
    }
  };

  const handleResetToDemoData = () => {
    setExpenses(INITIAL_EXPENSES);
    showToast('Reset ledger to Finch sample records.');
  };

  const handleDownloadPDF = () => {
    generateExpensePDF(
      filteredExpenses,
      filters.startDate,
      filters.endDate,
      filters.category,
      filters.nature
    );
  };

  const isFiltered =
    Boolean(filters.startDate) ||
    Boolean(filters.endDate) ||
    filters.category !== 'ALL' ||
    filters.nature !== 'ALL' ||
    Boolean(filters.searchQuery.trim());

  const timelineLabel = formatTimeline(filters.startDate, filters.endDate);

  return (
    <div className="min-h-screen bg-[#FFF8EE] flex flex-col font-sans">
      {/* Top Navigation & App Header (Contains Download PDF Report button; No separate Add Expense button) */}
      <Header
        onDownloadPDF={handleDownloadPDF}
        onOpenBackup={() => setIsBackupModalOpen(true)}
        filteredExpensesCount={filteredExpenses.length}
        filteredSpend={summary.totalSpend}
        allExpenses={expenses}
        timelineLabel={timelineLabel}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Secondary Bar directly below top navigation:
            - Concise, useful copy (no filler, no kiosk)
            - Single action: Record Expense button
            - Duplicate PDF button removed */}
        <div className="bg-gradient-to-r from-[#0F3B2E] to-[#185241] rounded-2xl p-4 sm:p-5 text-[#FFF8EE] shadow-sm mb-5 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 border border-[#C89B3C]/30">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 flex items-center justify-center p-2 rounded-xl bg-white/10 backdrop-blur-xs">
              <img src={finchIconLightPng} alt="Finch icon" className="w-6 h-6 sm:w-7 sm:h-7 object-contain" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-[#FFF8EE]">
                  Finch Expense Management
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#C89B3C] text-[#0A261E]">
                  <MapPin className="w-2.5 h-2.5 text-[#0A261E]" />
                  Kottayam, Kerala
                </span>
                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/15 text-[#FFF8EE]">
                  ₹ INR
                </span>
              </div>
              <p className="text-xs text-[#d8cfbe] mt-0.5">
                Track company expenses, monitor capital and operating spend, and manage receipts.
              </p>
            </div>
          </div>

          {/* Single action for adding an expense: Record Expense button (duplicate PDF button removed) */}
          <div className="flex items-center self-stretch sm:self-auto flex-shrink-0 pt-1 sm:pt-0">
            <button
              onClick={() => {
                setEditingExpense(null);
                setIsExpenseModalOpen(true);
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-[#C89B3C] hover:bg-[#b4892e] text-[#0A261E] rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md active:scale-98 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Record Expense</span>
            </button>
          </div>
        </div>

        {/* 1. Summary Cards (Mobile-first compact 2x2 grid) */}
        <SummaryCards
          summary={summary}
          isFiltered={isFiltered}
          timelineLabel={timelineLabel}
        />

        {/* 2. Category Spending Chart */}
        <CategoryChart
          expenses={filteredExpenses}
          timelineLabel={timelineLabel}
        />

        {/* 3. Filter and Search Toolbar */}
        <FilterToolbar
          filters={filters}
          onFilterChange={setFilters}
          onResetFilters={handleResetFilters}
          totalCount={expenses.length}
          filteredCount={filteredExpenses.length}
        />

        {/* 4. Expense Table / Ledger (Subtotal sum row removed; receipt actions added) */}
        <ExpenseTable
          expenses={sortedExpenses}
          sortState={sortState}
          onSortChange={handleSortChange}
          onEditExpense={(expense) => {
            setEditingExpense(expense);
            setIsExpenseModalOpen(true);
          }}
          onDeleteExpense={(expense) => setDeletingExpense(expense)}
          onAddExpense={() => {
            setEditingExpense(null);
            setIsExpenseModalOpen(true);
          }}
          onResetFilters={handleResetFilters}
          onViewReceipt={handleViewReceipt}
          isFiltered={isFiltered}
        />
      </main>

      {/* Footer: Bottom-left shows only the company name: Finch */}
      <footer className="bg-[#FAF7F0] border-t border-[#e5decb] py-5 text-xs text-[#6e8278]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Bottom-left area: Show ONLY the company name: Finch */}
          <div className="flex items-center space-x-2">
            <img src={finchIconPng} alt="Finch" className="w-5 h-5 object-contain" />
            <span className="font-bold text-sm text-[#0F3B2E]">Finch</span>
          </div>

          <div className="text-[11px] text-[#7e998e] text-center sm:text-right">
            Browser local storage active • Verified offline persistence
          </div>
        </div>
      </footer>

      {/* Modal Dialogs */}
      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setEditingExpense(null);
        }}
        onSave={handleSaveExpense}
        initialExpense={editingExpense}
      />

      <DeleteConfirmModal
        isOpen={Boolean(deletingExpense)}
        expense={deletingExpense}
        onClose={() => setDeletingExpense(null)}
        onConfirm={handleConfirmDelete}
      />

      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        expenses={expenses}
        onImportExpenses={handleImportExpenses}
        onResetToDemoData={handleResetToDemoData}
      />

      <ReceiptViewerModal
        isOpen={Boolean(viewingReceiptUrl)}
        onClose={() => {
          setViewingReceiptUrl(null);
          setViewingReceiptExpense(null);
        }}
        imageUrl={viewingReceiptUrl}
        expense={viewingReceiptExpense}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#0F3B2E] text-[#FFF8EE] px-4 py-2.5 rounded-xl shadow-xl border border-[#C89B3C]/40 flex items-center space-x-2.5 animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-4 h-4 text-[#C89B3C]" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default App;
