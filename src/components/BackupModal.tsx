import React, { useState, useRef } from 'react';
import {
  X,
  Download,
  Upload,
  FileSpreadsheet,
  FileCode,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { Expense } from '../types';
import {
  exportToJSON,
  exportToCSV,
  parseAndValidateImportJSON,
} from '../utils/storage';
import { INITIAL_EXPENSES } from '../utils/seedData';
import finchIconLightPng from '../assets/finch-icon-light.png';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenses: Expense[];
  onImportExpenses: (importedExpenses: Expense[], mode: 'replace' | 'merge') => void;
  onResetToDemoData: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  expenses,
  onImportExpenses,
  onResetToDemoData,
}) => {
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importStatus, setImportStatus] = useState<{
    type: 'idle' | 'success' | 'error';
    message: string;
    validData?: Expense[];
  }>({ type: 'idle', message: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-[#e5decb] overflow-hidden my-6"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bg-[#0F3B2E] text-[#FFF8EE] px-6 py-4 flex items-center justify-between border-b border-[#185241]">
          <div className="flex items-center space-x-3">
            <img src={finchIconLightPng} alt="finch" className="w-8 h-8 object-contain flex-shrink-0" />
            <div>
              <h2 className="text-base font-bold">Data, Backup & Restore</h2>
              <p className="text-xs text-[#d8cfbe]">
                Persisted in browser localStorage • {expenses.length} expenses currently saved
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

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
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
                onClick={() => exportToJSON(expenses)}
                className="flex items-center justify-between p-3.5 rounded-xl border border-[#d9cfbe] bg-[#FAF7F0] hover:bg-[#f2ecdf] hover:border-[#0F3B2E] transition-all group text-left"
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
                onClick={() => exportToCSV(expenses)}
                className="flex items-center justify-between p-3.5 rounded-xl border border-[#d9cfbe] bg-[#FAF7F0] hover:bg-[#f2ecdf] hover:border-[#0F3B2E] transition-all group text-left"
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
                    className="w-full mt-2 py-2 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition-colors shadow-xs"
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

          {/* Section 3: Reset / Reload Demo Data */}
          <div className="pt-4 border-t border-[#f0ebd9]">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-[#8A5323] uppercase tracking-wider flex items-center">
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reload Sample Data
                </h4>
                <p className="text-xs text-[#6e8278] mt-0.5">
                  Reset ledger back to the {INITIAL_EXPENSES.length} realistic Finch sample expenses.
                </p>
              </div>
              <button
                onClick={() => {
                  if (confirm('Reset all expenses back to default Finch sample records?')) {
                    onResetToDemoData();
                    onClose();
                  }
                }}
                className="px-3 py-1.5 rounded-lg border border-[#EDD4BE] bg-[#FAF0E6] text-[#8A5323] hover:bg-[#F3E1CF] text-xs font-semibold transition-colors flex-shrink-0 ml-3"
              >
                Reset to Demo Data
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#FAF7F0] border-t border-[#f0ebd9] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#d9cfbe] text-xs font-semibold text-[#5a6e64] hover:bg-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
