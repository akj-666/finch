import React from 'react';
import { IndianRupee, Layers, RefreshCw, Trophy, AlertCircle } from 'lucide-react';
import { ExpenseSummary } from '../types';
import { formatINR } from '../utils/formatters';

interface SummaryCardsProps {
  summary: ExpenseSummary;
  isFiltered: boolean;
  timelineLabel: string;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  summary,
  isFiltered,
  timelineLabel,
}) => {
  const { totalSpend, capexSpend, opexSpend, topCategory, allTimeSpend, filteredCount, allTimeCount } = summary;

  const capexPercent = totalSpend > 0 ? ((capexSpend / totalSpend) * 100).toFixed(1) : '0';
  const opexPercent = totalSpend > 0 ? ((opexSpend / totalSpend) * 100).toFixed(1) : '0';
  const periodShareOfAllTime = allTimeSpend > 0 ? ((totalSpend / allTimeSpend) * 100).toFixed(1) : '0';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-5 sm:mb-6">
      {/* 1. Total Spend Card */}
      <div className="bg-white rounded-xl p-3 sm:p-4 border border-[#e5decb] shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-[11px] font-bold text-[#5a6e64] uppercase tracking-wider mb-1 sm:mb-1.5">
            <span>Period Total</span>
            <span className="p-1 sm:p-1.5 rounded-md bg-[#E8F3EE] text-[#0F3B2E]">
              <IndianRupee className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-lg sm:text-2xl font-extrabold text-[#0F3B2E] tracking-tight">
            {formatINR(totalSpend)}
          </div>
          <div className="text-[10px] sm:text-xs text-[#6e8278] mt-0.5 truncate" title={`${filteredCount} expenses in ${timelineLabel}`}>
            {filteredCount} {filteredCount === 1 ? 'expense' : 'expenses'} ({timelineLabel})
          </div>
        </div>

        {/* All-time comparison */}
        <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-[#f0ebd9] flex items-center justify-between text-[10px] sm:text-xs">
          <span className="text-[#6e8278] font-medium hidden sm:inline">All-Time:</span>
          <div className="flex items-center justify-between w-full sm:w-auto">
            <span className="font-bold text-[#0F3B2E]">{formatINR(allTimeSpend)}</span>
            <span className="text-[#7e998e] ml-1">({allTimeCount})</span>
            {isFiltered && (
              <span className="ml-1 px-1 py-0.2 rounded text-[9px] font-semibold bg-[#FFF8EE] text-[#C89B3C] border border-[#e5decb]">
                {periodShareOfAllTime}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. CapEx Spend Card */}
      <div className="bg-white rounded-xl p-3 sm:p-4 border border-[#e5decb] shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-[11px] font-bold text-[#1e4e79] uppercase tracking-wider mb-1 sm:mb-1.5">
            <span>CapEx (Capital)</span>
            <span className="p-1 sm:p-1.5 rounded-md bg-[#e8f1fa] text-[#1e4e79]">
              <Layers className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-lg sm:text-2xl font-extrabold text-[#153f63] tracking-tight">
            {formatINR(capexSpend)}
          </div>
          <div className="flex items-center space-x-1.5 mt-0.5">
            <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#e8f1fa] text-[#1e4e79]">
              {capexPercent}%
            </span>
            <span className="text-[10px] sm:text-xs text-[#6e8278] truncate">Fixed assets</span>
          </div>
        </div>

        <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-[#f0ebd9] text-[10px] sm:text-xs text-[#6e8278] truncate">
          Equipment, machinery & tooling
        </div>
      </div>

      {/* 3. OpEx Spend Card */}
      <div className="bg-white rounded-xl p-3 sm:p-4 border border-[#e5decb] shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-[11px] font-bold text-[#8c5e00] uppercase tracking-wider mb-1 sm:mb-1.5">
            <span>OpEx (Operating)</span>
            <span className="p-1 sm:p-1.5 rounded-md bg-[#fff6e0] text-[#a67000]">
              <RefreshCw className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-lg sm:text-2xl font-extrabold text-[#754e00] tracking-tight">
            {formatINR(opexSpend)}
          </div>
          <div className="flex items-center space-x-1.5 mt-0.5">
            <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#fff6e0] text-[#8c5e00]">
              {opexPercent}%
            </span>
            <span className="text-[10px] sm:text-xs text-[#6e8278] truncate">Operations</span>
          </div>
        </div>

        <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-[#f0ebd9] text-[10px] sm:text-xs text-[#6e8278] truncate">
          Supplies, rent & utility refills
        </div>
      </div>

      {/* 4. Top Category Card */}
      <div className="bg-white rounded-xl p-3 sm:p-4 border border-[#e5decb] shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-[11px] font-bold text-[#5a6e64] uppercase tracking-wider mb-1 sm:mb-1.5">
            <span>Top Category</span>
            <span className="p-1 sm:p-1.5 rounded-md bg-[#f9f3e4] text-[#C89B3C]">
              <Trophy className="w-3.5 h-3.5" />
            </span>
          </div>

          {topCategory ? (
            <>
              <div className="text-xs sm:text-sm font-bold text-[#0F3B2E] truncate" title={topCategory.category}>
                {topCategory.category}
              </div>
              <div className="text-lg sm:text-2xl font-extrabold text-[#C89B3C] tracking-tight mt-0.5">
                {formatINR(topCategory.amount)}
              </div>
            </>
          ) : (
            <div className="py-1 flex items-center text-xs text-[#7e998e]">
              <AlertCircle className="w-3.5 h-3.5 mr-1 text-gray-400" />
              <span>No expenses</span>
            </div>
          )}
        </div>

        <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-[#f0ebd9] text-[10px] sm:text-xs text-[#6e8278] truncate">
          {topCategory ? (
            <span className="font-semibold text-[#0F3B2E]">
              {topCategory.percentage.toFixed(1)}% of period
            </span>
          ) : (
            <span>Adjust filters</span>
          )}
        </div>
      </div>
    </div>
  );
};
