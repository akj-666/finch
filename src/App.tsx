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
import { generateExpensePDF } from './utils/pdfGenerator';
import { formatTimeline } from './utils/formatters';
import { saveReceipt, deleteReceipt, getReceipt } from './utils/receiptStorage';
import {
  getSystemHealth,
  fetchSystemExpenses,
  saveExpenseToSystem,
  deleteExpenseFromSystem,
  saveReceiptToSystem,
  deleteReceiptFromSystem,
  syncBatchToSystem,
  SystemStats,
} from './utils/apiSync';
import { CheckCircle2, Plus, MapPin, HardDrive } from 'lucide-react';
import finchIconPng from './assets/finch-icon.png';
import finchIconLightPng from './assets/finch-icon-light.png';

export const App: React.FC = () => {
  // Primary expenses state
  const [expenses, setExpenses] = useState<Expense[]>(() => loadExpenses());

  // Local System Backend health & sync status
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);

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

  // 1. Initial Connection with Local Machine Backend System
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const health = await getSystemHealth();
      if (!isMounted) return;
      setSystemStats(health);

      if (health.status === 'connected') {
        const remoteList = await fetchSystemExpenses();
        if (!isMounted) return;

        if (remoteList && remoteList.length > 0) {
          // If system database has data, load it as source of truth
          setExpenses(remoteList);
        } else {
          // If system database is fresh/empty, seed it with current expenses
          await syncBatchToSystem(expenses);
          const updated = await getSystemHealth();
          if (isMounted) setSystemStats(updated);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Sync with browser localStorage as reliable local cache
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

    // 1. Browser-local IndexedDB persistence
    if (receiptData) {
      await saveReceipt(targetId, receiptData);
    } else if (receiptData === null) {
      await deleteReceipt(targetId);
    }

    // 2. Build complete expense record
    const updatedRecord: Expense = {
      ...data,
      id: targetId,
      createdAt: editId ? (editingExpense?.createdAt || now) : now,
      updatedAt: now,
    };

    // 3. Persist directly to host machine SQLite and filesystem
    await saveExpenseToSystem(updatedRecord);
    if (receiptData) {
      await saveReceiptToSystem(targetId, receiptData.dataUrl, receiptData.name);
    } else if (receiptData === null) {
      await deleteReceiptFromSystem(targetId);
    }

    // 4. Update UI State
    if (editId) {
      setExpenses((prev) => prev.map((item) => (item.id === editId ? updatedRecord : item)));
      showToast('Expense updated & saved to system disk.');
    } else {
      setExpenses((prev) => [updatedRecord, ...prev]);
      showToast('New expense recorded to system database.');
    }

    setEditingExpense(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingExpense) return;

    // Delete from IndexedDB and local system database
    await deleteReceipt(deletingExpense.id);
    await deleteExpenseFromSystem(deletingExpense.id);

    setExpenses((prev) => prev.filter((e) => e.id !== deletingExpense.id));
    showToast(`Deleted "${deletingExpense.description}" from system.`);
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

  const handleImportExpenses = async (importedData: Expense[], mode: 'replace' | 'merge') => {
    let nextList: Expense[] = [];
    if (mode === 'replace') {
      nextList = importedData;
    } else {
      const idMap = new Map<string, Expense>();
      expenses.forEach((e) => idMap.set(e.id, e));
      importedData.forEach((e) => idMap.set(e.id, e));
      nextList = Array.from(idMap.values());
    }

    setExpenses(nextList);
    // Sync all imported data to host SQLite database
    await syncBatchToSystem(nextList);
    showToast(`Saved ${importedData.length} records to local system database.`);
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
      {/* Top Navigation & App Header */}
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
        {/* Secondary Bar directly below top navigation */}
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

          {/* Single action for adding an expense: Record Expense button */}
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

        {/* 1. Summary Cards */}
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

        {/* 4. Expense Table / Ledger */}
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

      {/* Footer: Bottom-left shows only the company name: Finch; Right shows Host System status */}
      <footer className="bg-[#FAF7F0] border-t border-[#e5decb] py-5 text-xs text-[#6e8278]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Bottom-left area: Show ONLY the company name: Finch */}
          <div className="flex items-center space-x-2">
            <img src={finchIconPng} alt="Finch" className="w-5 h-5 object-contain" />
            <span className="font-bold text-sm text-[#0F3B2E]">Finch</span>
          </div>

          {/* Right status: Shows host system disk persistence */}
          <div className="flex items-center space-x-2 text-[11px] text-[#5a6e64]">
            <HardDrive className="w-3.5 h-3.5 text-[#C89B3C]" />
            <span>
              {systemStats?.status === 'connected' ? (
                <>Host Storage Active: <strong className="text-[#0F3B2E]">SQLite (data/finch.db) & data/receipts/</strong></>
              ) : (
                <>Local Storage Active • Offline Persistence Ready</>
              )}
            </span>
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
