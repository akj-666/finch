/**
 * Client service to communicate with the local Finch SQLite & Filesystem backend.
 * Provides automatic synchronization between browser state and the host computer system.
 */

import { Expense } from '../types';

export interface SystemStats {
  status: 'connected' | 'offline';
  engine?: string;
  databasePath?: string;
  receiptsDirectory?: string;
  databaseSizeBytes?: number;
  totalExpensesCount?: number;
  totalSpendAmount?: number;
  totalReceiptsCount?: number;
  totalReceiptsSizeBytes?: number;
}

const API_BASE = '/api';

/**
 * Check if the local system backend is connected and get health stats
 */
export async function getSystemHealth(): Promise<SystemStats> {
  try {
    const res = await fetch(`${API_BASE}/status`);
    if (!res.ok) throw new Error('System API responded with error');
    const data = await res.json();
    return { ...data, status: 'connected' };
  } catch (err) {
    return { status: 'offline' };
  }
}

/**
 * Fetch all expenses stored in the local SQLite database
 */
export async function fetchSystemExpenses(): Promise<Expense[] | null> {
  try {
    const res = await fetch(`${API_BASE}/expenses`);
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.expenses) ? data.expenses : null;
  } catch (err) {
    console.warn('System database not reachable, using offline cache:', err);
    return null;
  }
}

/**
 * Persist an expense directly into the local SQLite database
 */
export async function saveExpenseToSystem(expense: Expense): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expense),
    });
    return res.ok;
  } catch (err) {
    console.warn('Could not save expense to system database:', err);
    return false;
  }
}

/**
 * Delete an expense from the local SQLite database
 */
export async function deleteExpenseFromSystem(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/expenses/${id}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    console.warn('Could not delete expense from system database:', err);
    return false;
  }
}

/**
 * Save a receipt image directly into the local computer filesystem (data/receipts/)
 */
export async function saveReceiptToSystem(expenseId: string, dataUrl: string, name: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/receipts/${expenseId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl, name }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Could not save receipt file to system filesystem:', err);
    return false;
  }
}

/**
 * Delete a receipt file from the local filesystem
 */
export async function deleteReceiptFromSystem(expenseId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/receipts/${expenseId}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    console.warn('Could not delete receipt from system filesystem:', err);
    return false;
  }
}

/**
 * Bulk sync a list of expenses to the local SQLite database
 */
export async function syncBatchToSystem(expenses: Expense[]): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expenses }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Bulk system sync failed:', err);
    return false;
  }
}
