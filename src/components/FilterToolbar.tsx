import React from 'react';
import { Search, RotateCcw, Calendar, Tag, Layers } from 'lucide-react';
import { FilterState, EXPENSE_CATEGORIES } from '../types';
import { toISODateString } from '../utils/formatters';

interface FilterToolbarProps {
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  onResetFilters: () => void;
  totalCount: number;
  filteredCount: number;
}

export const FilterToolbar: React.FC<FilterToolbarProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  totalCount,
  filteredCount,
}) => {
  const isFiltered =
    Boolean(filters.startDate) ||
    Boolean(filters.endDate) ||
    filters.category !== 'ALL' ||
    filters.nature !== 'ALL' ||
    Boolean(filters.searchQuery.trim());

  // Date range preset handlers
  const applyPreset = (preset: 'all' | 'this_month' | 'last_30_days' | 'this_quarter' | 'this_year') => {
    const today = new Date();

    if (preset === 'all') {
      onFilterChange({ ...filters, startDate: '', endDate: '' });
      return;
    }

    if (preset === 'this_month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      onFilterChange({
        ...filters,
        startDate: toISODateString(start),
        endDate: toISODateString(end),
      });
      return;
    }

    if (preset === 'last_30_days') {
      const start = new Date();
      start.setDate(today.getDate() - 30);
      onFilterChange({
        ...filters,
        startDate: toISODateString(start),
        endDate: toISODateString(today),
      });
      return;
    }

    if (preset === 'this_quarter') {
      const quarterIndex = Math.floor(today.getMonth() / 3);
      const start = new Date(today.getFullYear(), quarterIndex * 3, 1);
      const end = new Date(today.getFullYear(), (quarterIndex + 1) * 3, 0);
      onFilterChange({
        ...filters,
        startDate: toISODateString(start),
        endDate: toISODateString(end),
      });
      return;
    }

    if (preset === 'this_year') {
      const start = new Date(today.getFullYear(), 0, 1);
      const end = new Date(today.getFullYear(), 11, 31);
      onFilterChange({
        ...filters,
        startDate: toISODateString(start),
        endDate: toISODateString(end),
      });
      return;
    }
  };

  return (
    <div className="bg-white rounded-xl p-3.5 sm:p-5 border border-[#e5decb] shadow-xs mb-5 sm:mb-6 space-y-3 sm:space-y-4">
      {/* Top row: Search, Filter count, and Reset */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#7e998e] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => onFilterChange({ ...filters, searchQuery: e.target.value })}
            placeholder="Search vendor, description, tag, notes..."
            className="w-full pl-9 pr-8 py-2 bg-[#FAF7F0] border border-[#d9cfbe] rounded-lg text-xs sm:text-sm text-[#0F3B2E] placeholder-[#8a9e94] focus:outline-none focus:ring-2 focus:ring-[#0F3B2E]/20 focus:border-[#0F3B2E] transition-all"
          />
          {filters.searchQuery && (
            <button
              onClick={() => onFilterChange({ ...filters, searchQuery: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-700 font-bold p-1"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status and Reset */}
        <div className="flex items-center justify-between sm:justify-end space-x-3 text-xs">
          <span className="text-[#5a6e64] text-[11px] sm:text-xs">
            Showing <strong className="text-[#0F3B2E]">{filteredCount}</strong> of{' '}
            <strong className="text-[#0F3B2E]">{totalCount}</strong>
          </span>

          {isFiltered && (
            <button
              onClick={onResetFilters}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-[#FAF0E6] text-[#8A5323] hover:bg-[#F3E1CF] text-[11px] sm:text-xs font-semibold transition-colors border border-[#EDD4BE]"
              title="Reset all active filters"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Date Presets Row (scrollable on mobile if needed) */}
      <div className="flex items-center gap-1.5 pt-2 border-t border-[#f2ede2] overflow-x-auto pb-0.5 scrollbar-none">
        <span className="text-[11px] sm:text-xs font-semibold text-[#6e8278] mr-1 flex items-center flex-shrink-0">
          <Calendar className="w-3.5 h-3.5 mr-1 text-[#C89B3C]" /> Timeline:
        </span>
        <button
          onClick={() => applyPreset('all')}
          className={`px-2.5 py-1 rounded text-[11px] sm:text-xs font-medium transition-colors flex-shrink-0 ${
            !filters.startDate && !filters.endDate
              ? 'bg-[#0F3B2E] text-[#FFF8EE] font-bold shadow-2xs'
              : 'bg-[#f4efe4] text-[#5a6e64] hover:bg-[#e8e1d2]'
          }`}
        >
          All Time
        </button>
        <button
          onClick={() => applyPreset('this_month')}
          className="px-2.5 py-1 rounded text-[11px] sm:text-xs font-medium bg-[#f4efe4] text-[#5a6e64] hover:bg-[#e8e1d2] transition-colors flex-shrink-0"
        >
          This Month
        </button>
        <button
          onClick={() => applyPreset('last_30_days')}
          className="px-2.5 py-1 rounded text-[11px] sm:text-xs font-medium bg-[#f4efe4] text-[#5a6e64] hover:bg-[#e8e1d2] transition-colors flex-shrink-0"
        >
          Last 30 Days
        </button>
        <button
          onClick={() => applyPreset('this_quarter')}
          className="px-2.5 py-1 rounded text-[11px] sm:text-xs font-medium bg-[#f4efe4] text-[#5a6e64] hover:bg-[#e8e1d2] transition-colors flex-shrink-0"
        >
          This Quarter
        </button>
        <button
          onClick={() => applyPreset('this_year')}
          className="px-2.5 py-1 rounded text-[11px] sm:text-xs font-medium bg-[#f4efe4] text-[#5a6e64] hover:bg-[#e8e1d2] transition-colors flex-shrink-0"
        >
          This Year
        </button>
      </div>

      {/* Filter Inputs Grid: Start Date, End Date, Category, Nature */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 pt-1">
        {/* Start Date */}
        <div>
          <label className="block text-[11px] font-semibold text-[#5a6e64] mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => onFilterChange({ ...filters, startDate: e.target.value })}
            className="w-full px-2.5 py-1.5 sm:py-2 bg-[#FAF7F0] border border-[#d9cfbe] rounded-lg text-xs text-[#0F3B2E] focus:outline-none focus:ring-2 focus:ring-[#0F3B2E]/20 focus:border-[#0F3B2E]"
          />
        </div>

        {/* End Date */}
        <div>
          <label className="block text-[11px] font-semibold text-[#5a6e64] mb-1">
            End Date
          </label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => onFilterChange({ ...filters, endDate: e.target.value })}
            className="w-full px-2.5 py-1.5 sm:py-2 bg-[#FAF7F0] border border-[#d9cfbe] rounded-lg text-xs text-[#0F3B2E] focus:outline-none focus:ring-2 focus:ring-[#0F3B2E]/20 focus:border-[#0F3B2E]"
          />
        </div>

        {/* Category Dropdown */}
        <div>
          <label className="block text-[11px] font-semibold text-[#5a6e64] mb-1 flex items-center">
            <Tag className="w-3 h-3 mr-1 text-[#7e998e]" /> Category
          </label>
          <select
            value={filters.category}
            onChange={(e) => onFilterChange({ ...filters, category: e.target.value })}
            className="w-full px-2.5 py-1.5 sm:py-2 bg-[#FAF7F0] border border-[#d9cfbe] rounded-lg text-xs text-[#0F3B2E] focus:outline-none focus:ring-2 focus:ring-[#0F3B2E]/20 focus:border-[#0F3B2E]"
          >
            <option value="ALL">All Categories</option>
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Expense Nature (CapEx vs OpEx) */}
        <div>
          <label className="block text-[11px] font-semibold text-[#5a6e64] mb-1 flex items-center">
            <Layers className="w-3 h-3 mr-1 text-[#7e998e]" /> Nature
          </label>
          <select
            value={filters.nature}
            onChange={(e) => onFilterChange({ ...filters, nature: e.target.value })}
            className="w-full px-2.5 py-1.5 sm:py-2 bg-[#FAF7F0] border border-[#d9cfbe] rounded-lg text-xs text-[#0F3B2E] focus:outline-none focus:ring-2 focus:ring-[#0F3B2E]/20 focus:border-[#0F3B2E]"
          >
            <option value="ALL">All Natures (CapEx & OpEx)</option>
            <option value="CapEx">CapEx — One-Time Capital Asset</option>
            <option value="OpEx">OpEx — Recurring Operating Spend</option>
          </select>
        </div>
      </div>
    </div>
  );
};
