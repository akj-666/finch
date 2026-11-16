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
import { NoticeModal } from './components/NoticeModal';
import { SplashScreen } from './components/SplashScreen';
import {
  Expense,
  FilterState,
  SortState,
  SortColumn,
  ExpenseSummary,
  ExpenseCategory,
} from './types';
import { loadExpenses, saveExpenses, removeExpenseFromStorage, clearTombstone } from './utils/storage';
import { generateExpensePDF } from './utils/pdfGenerator';
import { formatTimeline } from './utils/formatters';
import { saveReceipt, deleteReceipt, getReceipt } from './utils/receiptStorage';
import {
  getSystemHealth,
  saveExpenseToSystem,
  deleteExpenseFromSystem,
  saveReceiptToSystem,
  deleteReceiptFromSystem,
  syncBatchToSystem,
  SystemStats,
  initWorkspaceFromUrl,
  getWorkspaceId,
  performFullSync,
  subscribeSyncStatus,
  SyncStatusInfo,
  getSyncStatus,
  getCustomDbUrl,
} from './utils/apiSync';
import { CheckCircle2, AlertCircle, X, Plus, MapPin, HardDrive } from 'lucide-react';
import finchIconPng from './assets/finch-icon.png';
import finchIconLightPng from './assets/finch-icon-light.png';

export const App: React.FC = () => {
  // Mobile Splash screen state
  const [showSplash, setShowSplash] = useState(true);

  // Primary expenses state
  const [expenses, setExpenses] = useState<Expense[]>(() => loadExpenses());

  // Workspace and live sync status
  const [workspaceId, setWorkspaceIdState] = useState<string>(() => initWorkspaceFromUrl());
  const [syncInfo, setSyncInfo] = useState<SyncStatusInfo>(() => getSyncStatus());

  // Backend health & sync stats
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

  // In-App Notice/Alert Modal (replaces browser alert dialog)
  const [noticeModal, setNoticeModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    primaryActionLabel?: string;
    onPrimaryAction?: () => void;
    secondaryActionLabel?: string;
    icon?: 'alert' | 'info' | 'finch';
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  // Receipt viewer state
  const [viewingReceiptExpense, setViewingReceiptExpense] = useState<Expense | null>(null);
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null);

  // Polished in-app feedback toast
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // 1. Live Sync Status Subscription
  useEffect(() => {
    const unsubscribe = subscribeSyncStatus((info) => {
      setSyncInfo(info);
      setWorkspaceIdState(getWorkspaceId());
    });
    return () => unsubscribe();
  }, []);

  // 2. Initial Cross-Device Sync & Workspace Reconciliation
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const health = await getSystemHealth();
      if (!isMounted) return;
      setSystemStats(health);

      // Perform intelligent two-way sync: preserves all records from phone and laptop
      const syncResult = await performFullSync(expenses);
      if (!isMounted) return;

      if (syncResult.success && syncResult.mergedExpenses) {
        setExpenses(syncResult.mergedExpenses);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // 3. Sync with browser localStorage as reliable local cache
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

    // Clear any previous deletion tombstone for this ID
    clearTombstone(targetId);

    // 2. Build complete expense record
    const updatedRecord: Expense = {
      ...data,
      id: targetId,
      createdAt: editId ? (editingExpense?.createdAt || now) : now,
      updatedAt: now,
    };

    // 3. Immediately persist to localStorage synchronously
    const nextList = editId
      ? expenses.map((item) => (item.id === editId ? updatedRecord : item))
      : [updatedRecord, ...expenses];
    saveExpenses(nextList);
    setExpenses(nextList);
    setEditingExpense(null);

    // 4. Persist directly to shared workspace (handles online/offline seamlessly)
    await saveExpenseToSystem(updatedRecord);
    if (receiptData) {
      await saveReceiptToSystem(
        targetId,
        receiptData.dataUrl,
        receiptData.name,
        receiptData.size,
        receiptData.type
      );
    } else if (receiptData === null) {
      await deleteReceiptFromSystem(targetId);
    }

    if (editId) {
      showToast('Expense updated & synced across devices.');
    } else {
      showToast('New expense recorded & synced across devices.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingExpense) return;

    const targetId = deletingExpense.id;
    const targetDesc = deletingExpense.description;

    // 1. Immediately remove from local storage & record tombstone synchronously
    const remaining = removeExpenseFromStorage(targetId);
    setExpenses(remaining);
    setDeletingExpense(null);

    // 2. Persist deletion to IndexedDB and shared cloud workspace
    try {
      await deleteReceipt(targetId);
      await deleteReceiptFromSystem(targetId);
      await deleteExpenseFromSystem(targetId);
      showToast(`Expense deleted: "${targetDesc}".`, 'success');
    } catch (err) {
      console.warn('Backend deletion failed or queued:', err);
      showToast(`Expense deleted: "${targetDesc}".`, 'success');
    }
  };

  const handleRetrySync = async () => {
    showToast('Connecting and synchronizing with workspace...', 'info');
    const result = await performFullSync(expenses);
    const health = await getSystemHealth();
    setSystemStats(health);
    if (result.success) {
      if (result.mergedExpenses) {
        setExpenses(result.mergedExpenses);
      }
      showToast(result.message, 'success');
    } else {
      showToast(result.message, 'error');
    }
  };

  const handleViewReceipt = async (expense: Expense) => {
    let stored = await getReceipt(expense.id);
    if (!stored || !stored.dataUrl) {
      // If not in local IndexedDB (e.g. created on another device), fetch from shared backend
      try {
        const customUrl = getCustomDbUrl();
        const res = await fetch(`/api/receipts/${encodeURIComponent(expense.id)}`, {
          headers: {
            'x-workspace-id': getWorkspaceId(),
            ...(customUrl ? { 'x-database-url': customUrl } : {}),
          },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.receipt && json.receipt.dataUrl) {
            const remoteReceipt = {
              dataUrl: json.receipt.dataUrl,
              name: json.receipt.name || 'receipt.jpg',
              size: json.receipt.size || 0,
              type: json.receipt.mimeType || 'image/jpeg',
            };
            await saveReceipt(expense.id, remoteReceipt);
            stored = {
              expenseId: expense.id,
              ...remoteReceipt,
              createdAt: new Date().toISOString(),
            };
          }
        }
      } catch (e) {
        console.warn('Could not fetch remote receipt:', e);
      }
    }

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
    if (filteredExpenses.length === 0) {
      setNoticeModal({
        isOpen: true,
        title: 'Unable to Generate Report',
        message:
          'No expenses match the currently selected filters. Adjust your date range or filters to include records before generating a report.',
        primaryActionLabel: 'Reset Filters',
        onPrimaryAction: () => {
          handleResetFilters();
          showToast('Filters cleared — all expenses now visible.', 'info');
        },
        secondaryActionLabel: 'Dismiss',
        icon: 'finch',
      });
      return;
    }

    const success = generateExpensePDF(
      filteredExpenses,
      filters.startDate,
      filters.endDate,
      filters.category,
      filters.nature,
      (errMsg) => {
        setNoticeModal({
          isOpen: true,
          title: 'Unable to Generate Report',
          message: errMsg,
          primaryActionLabel: 'Reset Filters',
          onPrimaryAction: () => {
            handleResetFilters();
            showToast('Filters cleared — all expenses now visible.', 'info');
          },
          secondaryActionLabel: 'Dismiss',
          icon: 'finch',
        });
      }
    );

    if (success) {
      showToast('PDF expense report downloaded successfully.', 'success');
    }
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
        syncInfo={syncInfo}
        workspaceId={workspaceId}
        onRetrySync={handleRetrySync}
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
        onExpensesUpdated={(newExpenses) => setExpenses(newExpenses)}
        onNotify={(msg) => showToast(msg, 'success')}
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

      <NoticeModal
        isOpen={noticeModal.isOpen}
        onClose={() => setNoticeModal((prev) => ({ ...prev, isOpen: false }))}
        title={noticeModal.title}
        message={noticeModal.message}
        primaryActionLabel={noticeModal.primaryActionLabel}
        onPrimaryAction={noticeModal.onPrimaryAction}
        secondaryActionLabel={noticeModal.secondaryActionLabel}
        icon={noticeModal.icon}
      />

      {/* Small, polished in-app messages */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-4 right-4 sm:left-auto sm:right-6 sm:w-auto max-w-sm z-50 bg-[#0F3B2E] text-[#FFF8EE] px-4 py-3 rounded-xl shadow-2xl border border-[#C89B3C]/50 flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-200"
          style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-[#C89B3C] flex-shrink-0" />
            )}
            <span className="text-xs font-semibold leading-snug truncate">
              {toast.message}
            </span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-[#d8cfbe] hover:text-white p-0.5 rounded cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Mobile-first branded Finch splash screen */}
      {showSplash && (
        <SplashScreen
          onComplete={() => setShowSplash(false)}
          minDuration={1100}
        />
      )}
    </div>
  );
};

export default App;
