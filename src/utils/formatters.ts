/**
 * Format amounts consistently as Indian Rupees (₹) with Indian number grouping:
 * e.g., ₹1,25,000.00
 */
export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₹0.00';
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format compact amounts for tight UI spaces:
 * e.g., ₹1.25L, ₹45K
 */
export function formatINRCompact(amount: number): string {
  if (isNaN(amount) || amount === 0) return '₹0';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (abs >= 10000000) {
    return `${sign}₹${(abs / 10000000).toFixed(2).replace(/\.00$/, '')}Cr`;
  }
  if (abs >= 100000) {
    return `${sign}₹${(abs / 100000).toFixed(2).replace(/\.00$/, '')}L`;
  }
  if (abs >= 1000) {
    return `${sign}₹${(abs / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return `${sign}₹${abs.toFixed(0)}`;
}

/**
 * Format date string (YYYY-MM-DD) into readable Indian business date:
 * e.g. "15 Nov 2026"
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    // Add time component to prevent timezone offset shifts
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return dateStr;
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a Date object to YYYY-MM-DD
 */
export function toISODateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date formatted as YYYY-MM-DD
 */
export function getTodayDateString(): string {
  return toISODateString(new Date());
}

/**
 * Format report timeline: "01 Nov 2026 – 30 Nov 2026" or "All Time"
 */
export function formatTimeline(startDate: string, endDate: string): string {
  if (!startDate && !endDate) {
    return 'All Time';
  }
  if (startDate && endDate) {
    return `${formatDate(startDate)} – ${formatDate(endDate)}`;
  }
  if (startDate) {
    return `From ${formatDate(startDate)}`;
  }
  return `Up to ${formatDate(endDate)}`;
}
