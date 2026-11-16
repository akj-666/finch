import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  Upload,
  FileSpreadsheet,
  FileCode,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  HardDrive,
  Database,
  FolderOpen,
} from 'lucide-react';
import { Expense } from '../types';
import {
  exportToJSON,
  exportToCSV,
  parseAndValidateImportJSON,
} from '../utils/storage';
import { getSystemHealth, syncBatchToSystem, SystemStats } from '../utils/apiSync';
import finchIconLightPng from '../assets/finch-icon-light.png';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenses: Expense[];
  onImportExpenses: (importedExpenses: Expense[], mode: 'replace' | 'merge') => void;
  onNotify?: (message: string) => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  expenses,
  onImportExpenses,
  onNotify,
}) => {
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importStatus, setImportStatus] = useState<{
    type: 'idle' | 'success' | 'error';
    message: string;
    validData?: Expense[];
  }>({ type: 'idle', message: '' });

  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [isSyncingToSystem, setIsSyncingToSystem] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      getSystemHealth().then((stats) => setSystemStats(stats));

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSyncToSystemDisk = async () => {
    setIsSyncingToSystem(true);
    setSyncFeedback(null);
    try {
      const result = await syncBatchToSystem(expenses);
      if (result.ok) {
        const updated = await getSystemHealth();
        setSystemStats(updated);
        setSyncFeedback({
          type: 'success',
          message: result.message,
        });
      } else {
        setSyncFeedback({
          type: 'error',
          message: result.message,
        });
      }
    } catch (err) {
      setSyncFeedback({
        type: 'error',
        message: 'Could not connect to local system API. Make sure the Finch server is running.',
      });
    } finally {
      setIsSyncingToSystem(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = parseAndValidateImportJSON(content);

      if (res.success && res.expenses) {
        setImportStatus({
          type: 'success',
          message: res.summary || `Parsed ${res.expenses.length} valid expenses.`,
          validData: res.expenses,
        });
      } else {
        setImportStatus({
          type: 'error',
          message: res.error || 'Failed to validate imported file.',
        });
      }
    };
    reader.onerror = () => {
      setImportStatus({
        type: 'error',
        message: 'Failed to read file from disk.',
      });
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (!importStatus.validData || importStatus.validData.length === 0) return;
    onImportExpenses(importStatus.validData, importMode);
    onClose();
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-[#e5decb] overflow-hidden my-6 flex flex-col max-h-[85vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bg-[#0F3B2E] text-[#FFF8EE] px-6 py-4 flex items-center justify-between border-b border-[#185241] flex-shrink-0">
          <div className="flex items-center space-x-3">
            <img src={finchIconLightPng} alt="Finch" className="w-8 h-8 object-contain flex-shrink-0" />
            <div>
              <h2 className="text-base font-bold">Data & Backup Management</h2>
              <p className="text-xs text-[#d8cfbe]">
                Secure offline persistence • {expenses.length} expenses on record
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#d8cfbe] hover:text-[#FFF8EE] hover:bg-[#185241] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Section 0: Host Computer System Storage (SQLite + Disk) */}
          <div className="p-4 rounded-xl border border-[#C89B3C]/50 bg-[#FAF7F0] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <HardDrive className="w-4 h-4 text-[#0F3B2E]" />
                <h3 className="text-xs font-bold text-[#0F3B2E] uppercase tracking-wider">
                  System Database & Disk Storage
                </h3>
              </div>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                  systemStats?.status === 'connected'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border-amber-300'
                }`}
              >
                ● {systemStats?.status === 'connected' ? 'Active & Connected' : 'Offline Cache (Browser)'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-[#42524a]">
              <div className="bg-white p-2.5 rounded-lg border border-[#e5decb] space-y-1">
                <div className="flex items-center text-[#0F3B2E] font-bold gap-1.5">
                  <Database className="w-3.5 h-3.5 text-[#C89B3C]" />
                  <span>SQLite Database</span>
                </div>
                <div className="font-mono text-[10px] text-gray-600 truncate" title="data/finch.db">
                  data/finch.db
                </div>
                <div className="text-[10px] text-[#7e998e]">
                  Size: {formatBytes(systemStats?.databaseSizeBytes)} • {systemStats?.totalExpensesCount ?? expenses.length} records
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-[#e5decb] space-y-1">
                <div className="flex items-center text-[#0F3B2E] font-bold gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-[#C89B3C]" />
                  <span>Receipts Folder</span>
                </div>
                <div className="font-mono text-[10px] text-gray-600 truncate" title="data/receipts/">
                  data/receipts/
                </div>
                <div className="text-[10px] text-[#7e998e]">
                  Size: {formatBytes(systemStats?.totalReceiptsSizeBytes)} • {systemStats?.totalReceiptsCount ?? 0} files
                </div>
              </div>
            </div>

            <div className="pt-1 flex items-center justify-between">
              <span className="text-[10px] text-[#7e998e]">
                All expenses and receipts are stored on disk with high reliability.
              </span>
              <button
                type="button"
                onClick={handleSyncToSystemDisk}
                disabled={isSyncingToSystem}
                className="px-3 py-1.5 rounded-lg bg-[#0F3B2E] text-[#FFF8EE] text-[11px] font-bold hover:bg-[#185241] transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 text-[#C89B3C] ${isSyncingToSystem ? 'animate-spin' : ''}`} />
                <span>{isSyncingToSystem ? 'Syncing...' : 'Sync to SQLite'}</span>
              </button>
            </div>

            {syncFeedback && (
              <div
                className={`text-[11px] font-semibold p-2.5 rounded-lg border flex items-start gap-2 ${
                  syncFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}
              >
                {syncFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <span>{syncFeedback.message}</span>
              </div>
            )}
          </div>

          {/* Section 1: Export */}
          <div>
            <h3 className="text-xs font-bold text-[#0F3B2E] uppercase tracking-wider mb-2 flex items-center">
              <Download className="w-4 h-4 mr-1.5 text-[#C89B3C]" />
              Export & Backup Data
            </h3>
            <p className="text-xs text-[#6e8278] mb-3">
              Download your complete expense records to safe offline storage or open in Excel / Google Sheets.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Export JSON */}
              <button
                onClick={() => {
                  exportToJSON(expenses);
                  onNotify?.(`Exported JSON backup file (${expenses.length} records).`);
                }}
                className="flex items-center justify-between p-3.5 rounded-xl border border-[#d9cfbe] bg-[#FAF7F0] hover:bg-[#f2ecdf] hover:border-[#0F3B2E] transition-all group text-left cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-lg bg-[#E8F3EE] text-[#0F3B2E] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <FileCode className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#0F3B2E]">Export JSON</div>
                    <div className="text-[11px] text-[#6e8278]">Complete app backup</div>
                  </div>
                </div>
                <Download className="w-4 h-4 text-[#7e998e] group-hover:text-[#0F3B2E]" />
              </button>

              {/* Export CSV */}
              <button
                onClick={() => {
                  exportToCSV(expenses);
                  onNotify?.(`Exported CSV spreadsheet (${expenses.length} records).`);
                }}
                className="flex items-center justify-between p-3.5 rounded-xl border border-[#d9cfbe] bg-[#FAF7F0] hover:bg-[#f2ecdf] hover:border-[#0F3B2E] transition-all group text-left cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-lg bg-[#f9f3e4] text-[#C89B3C] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#0F3B2E]">Export CSV</div>
                    <div className="text-[11px] text-[#6e8278]">Spreadsheet ready format</div>
                  </div>
                </div>
                <Download className="w-4 h-4 text-[#7e998e] group-hover:text-[#0F3B2E]" />
              </button>
            </div>
          </div>

          {/* Section 2: Import */}
          <div className="pt-4 border-t border-[#f0ebd9]">
            <h3 className="text-xs font-bold text-[#0F3B2E] uppercase tracking-wider mb-2 flex items-center">
              <Upload className="w-4 h-4 mr-1.5 text-[#C89B3C]" />
              Import JSON Backup
            </h3>
            <p className="text-xs text-[#6e8278] mb-3">
              Upload a Finch JSON backup file. All entries are validated before any data is updated.
            </p>

            <div className="space-y-3">
              <input
                type="file"
                ref={fileInputRef}
                accept=".json,application/json"
                onChange={handleFileChange}
                className="block w-full text-xs text-[#5a6e64] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-[#d9cfbe] file:text-xs file:font-semibold file:bg-[#FAF7F0] file:text-[#0F3B2E] hover:file:bg-[#eee6d5] cursor-pointer"
              />

              {/* Validation Status Feedback */}
              {importStatus.type === 'success' && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2">
                  <div className="flex items-center space-x-2 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>{importStatus.message}</span>
                  </div>

                  {/* Mode Selector */}
                  <div className="pt-2 border-t border-emerald-200/60 flex flex-col space-y-1.5">
                    <label className="text-[11px] font-bold text-emerald-950 uppercase">Import Strategy:</label>
                    <label className="flex items-center space-x-2 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name="importMode"
                        value="merge"
                        checked={importMode === 'merge'}
                        onChange={() => setImportMode('merge')}
                        className="text-emerald-700"
                      />
                      <span>
                        <strong>Merge with existing</strong> (keeps existing data, updates matching IDs)
                      </span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name="importMode"
                        value="replace"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                        className="text-emerald-700"
                      />
                      <span>
                        <strong>Replace all data</strong> (overwrites current ledger entirely)
                      </span>
                    </label>
                  </div>

                  <button
                    onClick={handleConfirmImport}
                    className="w-full mt-2 py-2 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer"
                  >
                    Apply Import ({importStatus.validData?.length} records)
                  </button>
                </div>
              )}

              {importStatus.type === 'error' && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Import failed:</span>
                    <pre className="mt-1 whitespace-pre-wrap font-sans text-[11px] text-red-700">
                      {importStatus.message}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#FAF7F0] border-t border-[#f0ebd9] flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#d9cfbe] text-xs font-semibold text-[#5a6e64] hover:bg-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
