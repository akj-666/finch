import React, { useState } from 'react';
import { PieChart, BarChart2 } from 'lucide-react';
import { Expense, ExpenseCategory } from '../types';
import { formatINR } from '../utils/formatters';
import { CATEGORY_META } from '../utils/categoryMeta';

interface CategoryChartProps {
  expenses: Expense[];
  timelineLabel: string;
}

interface CategorySlice {
  category: ExpenseCategory;
  amount: number;
  percentage: number;
  capex: number;
  opex: number;
  color: string;
  count: number;
}

export const CategoryChart: React.FC<CategoryChartProps> = ({ expenses, timelineLabel }) => {
  const [chartType, setChartType] = useState<'donut' | 'bar'>('donut');
  const [hoveredCategory, setHoveredCategory] = useState<ExpenseCategory | null>(null);

  const totalSpend = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Group by category
  const categoryMap = new Map<ExpenseCategory, { amount: number; capex: number; opex: number; count: number }>();
  expenses.forEach((e) => {
    const existing = categoryMap.get(e.category) || { amount: 0, capex: 0, opex: 0, count: 0 };
    existing.amount += e.amount;
    if (e.nature === 'CapEx') existing.capex += e.amount;
    else existing.opex += e.amount;
    existing.count += 1;
    categoryMap.set(e.category, existing);
  });

  const slices: CategorySlice[] = Array.from(categoryMap.entries())
    .map(([cat, data]) => ({
      category: cat,
      amount: data.amount,
      percentage: totalSpend > 0 ? (data.amount / totalSpend) * 100 : 0,
      capex: data.capex,
      opex: data.opex,
      color: CATEGORY_META[cat]?.color || '#0F3B2E',
      count: data.count,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Active slice for center display in donut
  const activeSlice = hoveredCategory
    ? slices.find((s) => s.category === hoveredCategory) || slices[0]
    : slices[0];

  // Helper to generate SVG Donut paths
  let accumulatedAngle = 0;
  const donutPaths = slices.map((slice) => {
    const angle = (slice.percentage / 100) * 360;
    const startAngle = accumulatedAngle;
    const endAngle = accumulatedAngle + angle;
    accumulatedAngle += angle;

    const radius = 90;
    const innerRadius = 58;
    const center = 110;

    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((endAngle - 90) * Math.PI) / 180;

    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);

    const ix1 = center + innerRadius * Math.cos(endRad);
    const iy1 = center + innerRadius * Math.sin(endRad);
    const ix2 = center + innerRadius * Math.cos(startRad);
    const iy2 = center + innerRadius * Math.sin(startRad);

    const largeArc = angle > 180 ? 1 : 0;

    const pathData = `
      M ${x1} ${y1}
      A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
      L ${ix1} ${iy1}
      A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2}
      Z
    `;

    return {
      slice,
      pathData,
      isSingle: slices.length === 1,
    };
  });

  if (expenses.length === 0) {
    return (
      <div className="bg-white rounded-xl p-5 border border-[#e5decb] shadow-xs mb-5 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-[#f0ebd9] gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-[#0F3B2E] flex items-center space-x-2">
              <span>Category Spending Breakdown</span>
              <span className="text-xs font-normal text-[#6e8278]">({timelineLabel})</span>
            </h2>
            <p className="text-xs text-[#6e8278] mt-0.5">
              Distribution across equipment, assets, consumables & operational services
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center py-4">
          <div className="md:col-span-5 flex flex-col items-center justify-center relative">
            <svg viewBox="0 0 220 220" className="w-48 h-48 sm:w-52 sm:h-52">
              <circle
                cx="110"
                cy="110"
                r="74"
                fill="none"
                stroke="#EDE5D5"
                strokeWidth="28"
                strokeDasharray="6 4"
              />
              <foreignObject x="45" y="45" width="130" height="130">
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-2">
                  <span className="text-[10px] uppercase font-bold text-[#7e998e] tracking-wider leading-none">
                    Total
                  </span>
                  <span className="text-base sm:text-lg font-extrabold text-[#0F3B2E] mt-1">
                    ₹0.00
                  </span>
                  <span className="text-[10px] font-semibold text-[#8c9e94] mt-0.5">
                    No Expenses
                  </span>
                </div>
              </foreignObject>
            </svg>
          </div>

          <div className="md:col-span-7 flex flex-col justify-center text-center md:text-left px-2 sm:px-4">
            <h3 className="text-sm font-bold text-[#0F3B2E] mb-1">
              No Spending Recorded
            </h3>
            <p className="text-xs text-[#6e8278] max-w-md leading-relaxed">
              No expenses have been recorded for this period. As you enter company expenditures, Finch will automatically chart category allocations, CapEx vs OpEx distributions, and percentage shares.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-5 border border-[#e5decb] shadow-sm mb-6">
      {/* Header and Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-[#f0ebd9] gap-3">
        <div>
          <h2 className="text-base font-bold text-[#0F3B2E] flex items-center space-x-2">
            <span>Category Spending Breakdown</span>
            <span className="text-xs font-normal text-[#6e8278]">({timelineLabel})</span>
          </h2>
          <p className="text-xs text-[#6e8278] mt-0.5">
            Distribution across equipment, assets, consumables & operational services
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center space-x-1 p-1 bg-[#f7f2e7] rounded-lg border border-[#e5decb] self-start sm:self-auto">
          <button
            onClick={() => setChartType('donut')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-semibold transition-all ${
              chartType === 'donut'
                ? 'bg-[#0F3B2E] text-[#FFF8EE] shadow-sm'
                : 'text-[#5a6e64] hover:text-[#0F3B2E]'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Donut</span>
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-semibold transition-all ${
              chartType === 'bar'
                ? 'bg-[#0F3B2E] text-[#FFF8EE] shadow-sm'
                : 'text-[#5a6e64] hover:text-[#0F3B2E]'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Bars</span>
          </button>
        </div>
      </div>

      {chartType === 'donut' ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Donut Chart SVG */}
          <div className="md:col-span-5 flex flex-col items-center justify-center relative py-2">
            <svg
              viewBox="0 0 220 220"
              className="w-56 h-56 transform transition-transform filter drop-shadow-sm"
            >
              {slices.length === 1 ? (
                // Full circle for 100% single slice
                <circle
                  cx="110"
                  cy="110"
                  r="74"
                  fill="transparent"
                  stroke={slices[0].color}
                  strokeWidth="32"
                  className="transition-all duration-300"
                />
              ) : (
                donutPaths.map(({ slice, pathData }) => {
                  const isHovered = hoveredCategory === slice.category;
                  return (
                    <path
                      key={slice.category}
                      d={pathData}
                      fill={slice.color}
                      opacity={hoveredCategory ? (isHovered ? 1 : 0.45) : 0.95}
                      className="cursor-pointer transition-all duration-200 hover:opacity-100"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      onMouseEnter={() => setHoveredCategory(slice.category)}
                      onMouseLeave={() => setHoveredCategory(null)}
                    />
                  );
                })
              )}

              {/* Center Donut Info */}
              <foreignObject x="45" y="45" width="130" height="130">
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-2">
                  <span className="text-[10px] uppercase font-bold text-[#6e8278] tracking-wider leading-none">
                    {hoveredCategory ? 'Selected' : 'Top Category'}
                  </span>
                  <span className="text-xs font-bold text-[#0F3B2E] truncate w-full mt-1">
                    {activeSlice?.category || 'All Spend'}
                  </span>
                  <span className="text-sm font-extrabold text-[#C89B3C] mt-0.5">
                    {formatINR(activeSlice?.amount || totalSpend)}
                  </span>
                  <span className="text-[10px] font-semibold text-[#5a6e64] mt-0.5">
                    {activeSlice ? `${activeSlice.percentage.toFixed(1)}%` : '100%'}
                  </span>
                </div>
              </foreignObject>
            </svg>

            <span className="text-[11px] text-[#7e998e] mt-1 text-center">
              Hover over slices or legend items to inspect details
            </span>
          </div>

          {/* Donut Legend */}
          <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {slices.map((slice) => {
              const isHovered = hoveredCategory === slice.category;
              return (
                <div
                  key={slice.category}
                  onMouseEnter={() => setHoveredCategory(slice.category)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                    isHovered
                      ? 'bg-[#F9F6EE] border-[#C89B3C] shadow-sm scale-[1.01]'
                      : 'bg-white border-[#eee7da] hover:border-[#d9cfbe]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 truncate">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: slice.color }}
                      />
                      <span className="text-xs font-bold text-[#0F3B2E] truncate" title={slice.category}>
                        {slice.category}
                      </span>
                    </div>
                    <span className="text-xs font-extrabold text-[#0F3B2E] ml-2">
                      {slice.percentage.toFixed(1)}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-1 text-[11px] text-[#5a6e64]">
                    <span className="font-medium text-[#C89B3C]">{formatINR(slice.amount)}</span>
                    <div className="flex items-center space-x-1.5 text-[10px]">
                      {slice.capex > 0 && (
                        <span className="px-1 py-0.2 rounded bg-indigo-50 text-indigo-700 font-medium">
                          CapEx {formatINR(slice.capex)}
                        </span>
                      )}
                      {slice.opex > 0 && (
                        <span className="px-1 py-0.2 rounded bg-amber-50 text-amber-800 font-medium">
                          OpEx {formatINR(slice.opex)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Bar Chart View */
        <div className="space-y-3 py-1">
          {slices.map((slice) => (
            <div key={slice.category} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <span
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="font-bold text-[#0F3B2E]">{slice.category}</span>
                  <span className="text-[#7e998e]">({slice.count} items)</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-[#6e8278]">{slice.percentage.toFixed(1)}%</span>
                  <span className="font-extrabold text-[#0F3B2E]">{formatINR(slice.amount)}</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-[#eee7da] h-3 rounded-full overflow-hidden flex">
                {/* CapEx portion */}
                {slice.capex > 0 && (
                  <div
                    title={`CapEx: ${formatINR(slice.capex)}`}
                    style={{
                      width: `${(slice.capex / totalSpend) * 100}%`,
                      backgroundColor: slice.color,
                    }}
                    className="h-full transition-all duration-500 opacity-95"
                  />
                )}
                {/* OpEx portion */}
                {slice.opex > 0 && (
                  <div
                    title={`OpEx: ${formatINR(slice.opex)}`}
                    style={{
                      width: `${(slice.opex / totalSpend) * 100}%`,
                      backgroundColor: '#C89B3C',
                    }}
                    className="h-full transition-all duration-500 opacity-90"
                  />
                )}
              </div>
            </div>
          ))}

          {/* Bar Legend */}
          <div className="flex items-center justify-end space-x-4 pt-3 text-xs text-[#5a6e64] border-t border-[#f0ebd9]">
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded bg-[#0F3B2E]" />
              <span>Category / CapEx Base</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded bg-[#C89B3C]" />
              <span>OpEx Component</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
