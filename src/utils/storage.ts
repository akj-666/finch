import { Expense, EXPENSE_CATEGORIES, PAYMENT_MODES, ExpenseCategory, ExpenseNature, PaymentMode } from '../types';
import { INITIAL_EXPENSES } from './seedData';

const STORAGE_KEY = 'finch_expenses_v1';
const LEGACY_STORAGE_KEY = 'etchr_expenses_v1';

/**
 * Validate a single candidate expense object.
 */
export function validateExpense(item: unknown): { isValid: boolean; expense?: Expense; reason?: string } {
  if (!item || typeof item !== 'object') {
    return { isValid: false, reason: 'Expense entry is not an object' };
  }

  const obj = item as Record<string, unknown>;

  if (typeof obj.description !== 'string' || !obj.description.trim()) {
    return { isValid: false, reason: 'Missing or empty description' };
  }

  const amountNum = typeof obj.amount === 'number' ? obj.amount : Number(obj.amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return { isValid: false, reason: `Invalid positive amount: ${obj.amount}` };
  }

  if (typeof obj.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(obj.date)) {
    return { isValid: false, reason: `Invalid date format (must be YYYY-MM-DD): ${obj.date}` };
  }

  if (!EXPENSE_CATEGORIES.includes(obj.category as ExpenseCategory)) {
    return { isValid: false, reason: `Invalid category: ${obj.category}` };
  }

  if (obj.nature !== 'CapEx' && obj.nature !== 'OpEx') {
    return { isValid: false, reason: `Invalid expense nature: ${obj.nature} (must be CapEx or OpEx)` };
  }

  if (!PAYMENT_MODES.includes(obj.paymentMode as PaymentMode)) {
    return { isValid: false, reason: `Invalid payment mode: ${obj.paymentMode}` };
  }

  const now = new Date().toISOString();
  const expense: Expense = {
    id: typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : `exp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    date: obj.date,
    amount: Math.round(amountNum * 100) / 100,
    category: obj.category as ExpenseCategory,
    nature: obj.nature as ExpenseNature,
    description: obj.description.trim(),
    kioskTag: typeof obj.kioskTag === 'string' ? obj.kioskTag.trim() : undefined,
    paymentMode: obj.paymentMode as PaymentMode,
    notes: typeof obj.notes === 'string' ? obj.notes.trim() : undefined,
    hasReceipt: Boolean(obj.hasReceipt),
    receiptName: typeof obj.receiptName === 'string' ? obj.receiptName.trim() : undefined,
    receiptSize: typeof obj.receiptSize === 'number' ? obj.receiptSize : undefined,
    createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : now,
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : now,
  };

  return { isValid: true, expense };
}

/**
 * Load expenses from localStorage with fallback to INITIAL_EXPENSES.
 */
export function loadExpenses(): Expense[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) {
      // First time loading: seed realistic startup expenses
      saveExpenses(INITIAL_EXPENSES);
      return INITIAL_EXPENSES;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn('Stored expenses is not an array, falling back to seed data');
      saveExpenses(INITIAL_EXPENSES);
      return INITIAL_EXPENSES;
    }

    const validated: Expense[] = [];
    for (const item of parsed) {
      const res = validateExpense(item);
      if (res.isValid && res.expense) {
        validated.push(res.expense);
      }
    }

    if (validated.length === 0 && parsed.length > 0) {
      console.warn('No valid expenses recovered from stored data, resetting to seed data');
      saveExpenses(INITIAL_EXPENSES);
      return INITIAL_EXPENSES;
    }

    return validated;
  } catch (err) {
    console.error('Failed to load expenses from localStorage:', err);
    saveExpenses(INITIAL_EXPENSES);
    return INITIAL_EXPENSES;
  }
}

/**
 * Persist expenses into localStorage.
 */
export function saveExpenses(expenses: Expense[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  } catch (err) {
    console.error('Failed to save expenses to localStorage:', err);
  }
}

/**
 * Export expenses as structured JSON backup.
 */
export function exportToJSON(expenses: Expense[]): void {
  const payload = {
    appName: 'finch Expense Tracker',
    version: '1.0',
    exportDate: new Date().toISOString(),
    totalRecords: expenses.length,
    expenses,
  };

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
  const downloadAnchor = document.createElement('a');
  const dateTag = new Date().toISOString().split('T')[0];
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `finch-expenses-backup-${dateTag}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * Validate and parse imported JSON string.
 */
export function parseAndValidateImportJSON(jsonText: string): {
  success: boolean;
  expenses?: Expense[];
  error?: string;
  summary?: string;
} {
  try {
    const data = JSON.parse(jsonText);
    let itemsToProcess: unknown[] = [];

    if (Array.isArray(data)) {
      itemsToProcess = data;
    } else if (data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).expenses)) {
      itemsToProcess = (data as Record<string, unknown>).expenses as unknown[];
    } else {
      return {
        success: false,
        error: 'Invalid file format. Expected a JSON array of expenses or a finch backup object with an "expenses" list.',
      };
    }

    if (itemsToProcess.length === 0) {
      return {
        success: false,
        error: 'The imported file contains no expense entries.',
      };
    }

    const validExpenses: Expense[] = [];
    const errors: string[] = [];

    itemsToProcess.forEach((item, index) => {
      const check = validateExpense(item);
      if (check.isValid && check.expense) {
        validExpenses.push(check.expense);
      } else {
        errors.push(`Row #${index + 1}: ${check.reason || 'Invalid format'}`);
      }
    });

    if (validExpenses.length === 0) {
      return {
        success: false,
        error: `Could not parse any valid expenses. Issues:\n${errors.slice(0, 5).join('\n')}`,
      };
    }

    return {
      success: true,
      expenses: validExpenses,
      summary: `Found ${validExpenses.length} valid expense record${validExpenses.length === 1 ? '' : 's'}.${
        errors.length > 0 ? ` (${errors.length} invalid entries skipped)` : ''
      }`,
    };
  } catch (err) {
    return {
      success: false,
      error: `JSON parse error: ${err instanceof Error ? err.message : 'Invalid JSON file syntax.'}`,
    };
  }
}

/**
 * Export expenses as clean RFC 4180 compliant CSV.
 */
export function exportToCSV(expenses: Expense[]): void {
  const headers = [
    'Date',
    'Description',
    'Category',
    'Nature',
    'Payment Mode',
    'Kiosk / Unit Tag',
    'Amount (INR)',
    'Notes / Receipt Ref',
    'ID',
  ];

  const escapeCSV = (value: string | number | undefined | null): string => {
    if (value === null || value === undefined) return '""';
    const str = String(value);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const rows = expenses.map((exp) => [
    escapeCSV(exp.date),
    escapeCSV(exp.description),
    escapeCSV(exp.category),
    escapeCSV(exp.nature),
    escapeCSV(exp.paymentMode),
    escapeCSV(exp.kioskTag || ''),
    exp.amount.toFixed(2), // Numeric amount without quotes for spreadsheet math
    escapeCSV(exp.notes || ''),
    escapeCSV(exp.id),
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const dateTag = new Date().toISOString().split('T')[0];
  anchor.setAttribute('href', url);
  anchor.setAttribute('download', `finch-expenses-${dateTag}.csv`);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
