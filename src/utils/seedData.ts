import { Expense } from '../types';

/**
 * Production clean state:
 * All seeded, demo, sample, and placeholder expenses are removed.
 * New installations start with an empty ledger (₹0 spend).
 */
export const INITIAL_EXPENSES: Expense[] = [];

/**
 * Identifiers for sample/demo records from development.
 * Used to identify and clean legacy demo data without touching user expenses.
 */
export const DEMO_EXPENSE_IDS = new Set([
  'exp-1',
  'exp-2',
  'exp-3',
  'exp-4',
  'exp-5',
  'exp-6',
  'exp-7',
  'exp-8',
  'exp-9',
  'exp-10',
  'exp-11',
  'exp-12',
  'exp-13',
  'exp-14',
  'exp-15',
]);

export function isDemoExpense(exp: { id?: string }): boolean {
  return Boolean(exp && exp.id && DEMO_EXPENSE_IDS.has(exp.id));
}
