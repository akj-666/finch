import React, { useState } from 'react';
import { FileDown, Database, Menu, X, ShieldCheck, MapPin } from 'lucide-react';
import { Expense } from '../types';
import { formatINR } from '../utils/formatters';
import finchLogoLightPng from '../assets/finch-logo-light.png';
import finchIconLightPng from '../assets/finch-icon-light.png';

interface HeaderProps {
  onDownloadPDF: () => void;
  onOpenBackup: () => void;
  filteredExpensesCount: number;
  filteredSpend: number;
  allExpenses: Expense[];
  timelineLabel: string;
}

export const Header: React.FC<HeaderProps> = ({
  onDownloadPDF,
  onOpenBackup,
  filteredExpensesCount,
  filteredSpend,
  allExpenses,
  timelineLabel,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-[#0F3B2E] text-[#FFF8EE] shadow-md border-b border-[#185241]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Brand Identity */}
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            <div className="flex items-center transition-transform hover:scale-102 flex-shrink-0">
              <img
                src={finchLogoLightPng}
                alt="Finch"
                className="h-7 sm:h-9 w-auto object-contain"
              />
            </div>
            <div className="border-l border-[#1f5e4c] pl-2 sm:pl-3 flex-shrink-0">
              <div className="flex items-center space-x-1.5">
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#C89B3C] text-[#0A261E]">
                  <MapPin className="w-2.5 h-2.5 mr-1 text-[#0A261E]" />
                  Kottayam, Kerala, India
                </span>
                <span className="sm:hidden inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#C89B3C] text-[#0A261E]">
                  <MapPin className="w-2.5 h-2.5 mr-0.5 text-[#0A261E]" />
                  Kottayam
                </span>
              </div>
              <p className="text-[11px] text-[#d8cfbe] hidden md:block mt-0.5">
                Corporate & Operations Spend Ledger
              </p>
            </div>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center space-x-3">
            {/* Backup & Data */}
            <button
              onClick={onOpenBackup}
              title="Backup, export CSV, and import data"
              className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-[#185241] hover:bg-[#206953] text-[#FFF8EE] text-xs font-semibold transition-colors border border-[#2b7760]/50 shadow-xs"
            >
              <Database className="w-3.5 h-3.5 text-[#C89B3C]" />
              <span>Data & Backup</span>
            </button>

            {/* Download PDF Report - Kept at the top of the page */}
            <button
              onClick={onDownloadPDF}
              title={`Download PDF report for: ${timelineLabel}`}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-[#185241] hover:bg-[#206953] text-[#FFF8EE] text-xs font-bold transition-all border border-[#2b7760]/60 shadow-xs hover:border-[#C89B3C]/50"
            >
              <FileDown className="w-4 h-4 text-[#C89B3C]" />
              <span>Download PDF Report</span>
            </button>
          </div>

          {/* Mobile Actions: Download PDF + Menu Button (No duplicate Add Expense) */}
          <div className="md:hidden flex items-center space-x-2">
            <button
              onClick={onDownloadPDF}
              className="p-2 rounded-lg bg-[#185241] text-[#FFF8EE] hover:bg-[#206953] border border-[#2b7760]/60 flex items-center gap-1.5 text-xs font-semibold"
              aria-label="Download PDF Report"
              title="Download PDF Report"
            >
              <FileDown className="w-4 h-4 text-[#C89B3C]" />
              <span className="text-[11px]">PDF</span>
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg bg-[#185241] text-[#FFF8EE] hover:bg-[#206953] border border-[#2b7760]/60"
              aria-label="Open Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0A261E] border-t border-[#185241] px-4 pt-3 pb-4 space-y-3 animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center space-x-2">
              <img src={finchIconLightPng} alt="Finch" className="w-5 h-5 object-contain" />
              <span className="text-xs font-bold text-[#FFF8EE]">Finch Expense Management</span>
            </div>
            <span className="text-[10px] text-[#C89B3C] font-semibold">Kottayam, Kerala</span>
          </div>

          <div className="p-3 bg-[#0F3B2E] rounded-lg border border-[#185241]">
            <div className="text-[11px] text-[#a0b8ae]">Active Period Filter</div>
            <div className="font-semibold text-xs text-[#FFF8EE] mt-0.5">{timelineLabel}</div>
            <div className="text-xs text-[#C89B3C] font-bold mt-1">
              {filteredExpensesCount} expenses • {formatINR(filteredSpend)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onDownloadPDF();
              }}
              className="flex items-center justify-center space-x-2 px-3 py-2.5 rounded-lg bg-[#185241] hover:bg-[#206953] text-xs font-bold text-[#FFF8EE] border border-[#2b7760]/60"
            >
              <FileDown className="w-4 h-4 text-[#C89B3C]" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenBackup();
              }}
              className="flex items-center justify-center space-x-2 px-3 py-2.5 rounded-lg bg-[#185241] hover:bg-[#206953] text-xs font-bold text-[#FFF8EE] border border-[#2b7760]/60"
            >
              <Database className="w-4 h-4 text-[#C89B3C]" />
              <span>Data & Backup</span>
            </button>
          </div>

          <div className="pt-2 text-[11px] text-[#7e998e] flex items-center justify-between border-t border-[#185241]">
            <span>Local Storage Active</span>
            <span className="flex items-center text-emerald-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" /> {allExpenses.length} records saved
            </span>
          </div>
        </div>
      )}
    </header>
  );
};
