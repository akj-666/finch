export const EXPENSE_CATEGORIES = [
  'Hardware & Electronics',
  'Cabinet Fabrication & Materials',
  'Branding, Decals & Design',
  'Consumables & Refills',
  'Software, Web & Hosting',
  'Logistics, Transport & Travel',
  'Operations, Rent & Utilities',
  'Miscellaneous / Tools',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type ExpenseNature = 'CapEx' | 'OpEx';

export const PAYMENT_MODES = ['UPI', 'Cash', 'Bank Transfer', 'Card'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export interface Expense {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  category: ExpenseCategory;
  nature: ExpenseNature;
  description: string;
  kioskTag?: string;
  paymentMode: PaymentMode;
  notes?: string;
  hasReceipt?: boolean;
  receiptName?: string;
  receiptSize?: number;
  createdAt: string;
  updatedAt: string;
}

export type NatureLabel = {
  [K in ExpenseNature]: {
    label: string;
    description: string;
    shortLabel: string;
    badgeBg: string;
    badgeText: string;
    border: string;
  };
};

export interface FilterState {
  startDate: string;
  endDate: string;
  category: string; // 'ALL' or ExpenseCategory
  nature: string; // 'ALL' | 'CapEx' | 'OpEx'
  searchQuery: string;
}

export type SortColumn = 'date' | 'amount' | 'description' | 'category' | 'nature';
export type SortDirection = 'asc' | 'desc';

export interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

export interface ExpenseSummary {
  totalSpend: number;
  capexSpend: number;
  opexSpend: number;
  topCategory: {
    category: ExpenseCategory | string;
    amount: number;
    percentage: number;
  } | null;
  allTimeSpend: number;
  filteredCount: number;
  allTimeCount: number;
}
