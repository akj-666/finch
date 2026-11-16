/**
 * Client service for reliable cross-device synchronization in Finch.
 * Synchronizes phone PWA, laptop, and website using a shared backend workspace
 * and resilient offline queueing.
 */

import { Expense } from '../types';
import { getTombstones, recordTombstone, saveExpenses } from './storage';

export type SyncState = 'synced' | 'syncing' | 'offline' | 'error';

export interface SystemStats {
  status: 'connected' | 'offline';
  engine?: string;
  engineType?: 'postgres' | 'turso' | 'sqlite';
  workspaceId?: string;
  databaseSizeBytes?: number;
  totalExpensesCount?: number;
  totalSpendAmount?: number;
  totalReceiptsCount?: number;
  totalReceiptsSizeBytes?: number;
  error?: string;
}

export interface SyncStatusInfo {
  state: SyncState;
  message: string;
  pendingCount: number;
  lastSyncedAt?: number;
}

export interface QueueItem {
  id: string;
  action: 'save' | 'delete';
  expense?: Expense;
  receiptData?: {
    dataUrl: string;
    name: string;
    size?: number;
    mimeType?: string;
  };
  timestamp: number;
  retryCount: number;
}

const API_BASE = '/api';
const WORKSPACE_STORAGE_KEY = 'finch_workspace_id_v1';
const CUSTOM_DB_URL_KEY = 'finch_custom_db_url_v1';
const QUEUE_STORAGE_KEY = 'finch_offline_sync_queue_v1';
const LAST_SYNCED_KEY = 'finch_last_synced_at_v1';
const SESSION_TOKEN_KEY = 'finch_session_token_v1';

export function getSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SESSION_TOKEN_KEY);
}

export function setSessionToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token && token.trim()) {
    localStorage.setItem(SESSION_TOKEN_KEY, token.trim());
  } else {
    localStorage.removeItem(SESSION_TOKEN_KEY);
  }
}

// Default workspace identifier
export const DEFAULT_WORKSPACE_ID = 'finch-kottayam';

// Status listeners
type StatusListener = (info: SyncStatusInfo) => void;
const statusListeners = new Set<StatusListener>();

let currentSyncState: SyncState = 'synced';
let currentSyncMessage: string = 'Synced with cloud storage';
let isFlushingQueue = false;

// Initialize Workspace ID from URL if provided (e.g. ?workspace=finch-kottayam)
export function initWorkspaceFromUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_WORKSPACE_ID;

  try {
    const params = new URLSearchParams(window.location.search);
    const urlWorkspace = params.get('workspace');
    if (urlWorkspace && urlWorkspace.trim()) {
      const sanitized = urlWorkspace.trim().toLowerCase();
      localStorage.setItem(WORKSPACE_STORAGE_KEY, sanitized);
      return sanitized;
    }
  } catch (e) {}

  return getWorkspaceId();
}

export function getWorkspaceId(): string {
  if (typeof window === 'undefined') return DEFAULT_WORKSPACE_ID;
  const stored = localStorage.getItem(WORKSPACE_STORAGE_KEY);
  if (stored && stored.trim()) {
    return stored.trim().toLowerCase();
  }
  return DEFAULT_WORKSPACE_ID;
}

export function setWorkspaceId(newId: string): string {
  const sanitized = (newId || DEFAULT_WORKSPACE_ID).trim().toLowerCase();
  localStorage.setItem(WORKSPACE_STORAGE_KEY, sanitized);
  updateSyncStatus('syncing', `Switched to workspace: ${sanitized}`);
  return sanitized;
}

export function getCustomDbUrl(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(CUSTOM_DB_URL_KEY) || '';
}

export function setCustomDbUrl(url: string): void {
  if (url && url.trim()) {
    localStorage.setItem(CUSTOM_DB_URL_KEY, url.trim());
  } else {
    localStorage.removeItem(CUSTOM_DB_URL_KEY);
  }
}

export function getWorkspaceShareUrl(workspaceId?: string): string {
  const targetId = workspaceId || getWorkspaceId();
  if (typeof window === 'undefined') {
    return `https://finch-sooty-eight.vercel.app/?workspace=${encodeURIComponent(targetId)}`;
  }
  const origin = window.location.origin;
  return `${origin}/?workspace=${encodeURIComponent(targetId)}`;
}

export function getSyncStatus(): SyncStatusInfo {
  const queue = getOfflineQueue();
  const lastSyncStr = typeof window !== 'undefined' ? localStorage.getItem(LAST_SYNCED_KEY) : null;
  const lastSyncedAt = lastSyncStr ? parseInt(lastSyncStr, 10) : undefined;

  return {
    state: currentSyncState,
    message: currentSyncMessage,
    pendingCount: queue.length,
    lastSyncedAt,
  };
}

export function subscribeSyncStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  listener(getSyncStatus());
  return () => {
    statusListeners.delete(listener);
  };
}

function updateSyncStatus(state: SyncState, message: string) {
  currentSyncState = state;
  currentSyncMessage = message;
  if (state === 'synced' && typeof window !== 'undefined') {
    localStorage.setItem(LAST_SYNCED_KEY, Date.now().toString());
  }
  const status = getSyncStatus();
  statusListeners.forEach((fn) => fn(status));
}

// Request header generator
function getHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-workspace-id': getWorkspaceId(),
    ...extraHeaders,
  };
  const token = getSessionToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-session-token'] = token;
  }
  const customDb = getCustomDbUrl();
  if (customDb) {
    headers['x-database-url'] = customDb;
  }
  return headers;
}

/**
 * Check if the Master Access Password has been set and if current session is authenticated
 */
export async function getAuthStatus(): Promise<{ isPasswordSet: boolean; authenticated: boolean; locked: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/auth/status`, {
      method: 'GET',
      headers: getHeaders(),
    });
    if (!res.ok) {
      return { isPasswordSet: true, authenticated: false, locked: true };
    }
    return await res.json();
  } catch (e) {
    // If backend is offline or unreachable, check if local session token exists
    const token = getSessionToken();
    return {
      isPasswordSet: true,
      authenticated: Boolean(token),
      locked: !Boolean(token),
    };
  }
}

/**
 * Set the Master Access Password permanently (first-time setup only)
 */
export async function setupMasterPassword(password: string): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/setup`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.token) {
      setSessionToken(data.token);
      return { success: true, token: data.token };
    }
    return { success: false, error: data.error || 'Failed to set master password.' };
  } catch (err) {
    return { success: false, error: 'Network error connecting to auth server.' };
  }
}

/**
 * Login / Unlock the tracker using the Master Access Password
 */
export async function loginWithMasterPassword(
  password: string
): Promise<{ success: boolean; token?: string; error?: string; cooldownSeconds?: number }> {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.token) {
      setSessionToken(data.token);
      return { success: true, token: data.token };
    }
    return {
      success: false,
      error: data.error || 'Incorrect master password.',
      cooldownSeconds: data.cooldownSeconds,
    };
  } catch (err) {
    return { success: false, error: 'Network error connecting to auth server.' };
  }
}

/**
 * Manually lock the tracker and invalidate session
 */
export async function logoutMasterPassword(): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: getHeaders(),
    });
  } catch (e) {}
  setSessionToken(null);
}

// Offline Queue Management
function getOfflineQueue(): QueueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveOfflineQueue(queue: QueueItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Failed to write offline queue to localStorage', e);
  }
}

export function enqueueChange(
  action: 'save' | 'delete',
  id: string,
  expense?: Expense,
  receiptData?: { dataUrl: string; name: string; size?: number; mimeType?: string }
) {
  const queue = getOfflineQueue();
  // Filter out any previous action for the same ID to keep the queue minimal
  const filtered = queue.filter((item) => item.id !== id);
  filtered.push({
    id,
    action,
    expense,
    receiptData,
    timestamp: Date.now(),
    retryCount: 0,
  });
  saveOfflineQueue(filtered);
  updateSyncStatus('offline', `${filtered.length} change${filtered.length === 1 ? '' : 's'} queued for sync`);
}

/**
 * Flush all offline queue changes sequentially
 */
export async function flushOfflineQueue(): Promise<{ processed: number; failed: number }> {
  if (isFlushingQueue) return { processed: 0, failed: 0 };
  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { processed: 0, failed: 0 };
  }

  isFlushingQueue = true;
  updateSyncStatus('syncing', `Syncing ${queue.length} pending change${queue.length === 1 ? '' : 's'}...`);

  const remaining: QueueItem[] = [];
  let processed = 0;

  for (const item of queue) {
    try {
      if (item.action === 'save' && item.expense) {
        const ok = await directSaveExpense(item.expense);
        if (!ok) throw new Error('Expense save failed');

        if (item.receiptData) {
          await directSaveReceipt(
            item.expense.id,
            item.receiptData.dataUrl,
            item.receiptData.name,
            item.receiptData.size,
            item.receiptData.mimeType
          );
        }
      } else if (item.action === 'delete') {
        await directDeleteExpense(item.id);
        await directDeleteReceipt(item.id);
      }
      processed++;
    } catch (err) {
      item.retryCount = (item.retryCount || 0) + 1;
      remaining.push(item);
    }
  }

  saveOfflineQueue(remaining);
  isFlushingQueue = false;

  if (remaining.length === 0) {
    updateSyncStatus('synced', 'All changes synchronized');
  } else {
    updateSyncStatus('error', `${remaining.length} item(s) could not be synchronized yet`);
  }

  return { processed, failed: remaining.length };
}

// Low-level direct API calls
async function directSaveExpense(expense: Expense): Promise<boolean> {
  const res = await fetch(`${API_BASE}/expenses`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(expense),
  });
  return res.ok;
}

async function directDeleteExpense(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/expenses/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  return res.ok;
}

async function directSaveReceipt(
  expenseId: string,
  dataUrl: string,
  name: string,
  size?: number,
  mimeType?: string
): Promise<boolean> {
  const res = await fetch(`${API_BASE}/receipts/${encodeURIComponent(expenseId)}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ dataUrl, name, size, mimeType }),
  });
  return res.ok;
}

async function directDeleteReceipt(expenseId: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/receipts/${encodeURIComponent(expenseId)}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  return res.ok;
}

/**
 * Check backend status and retrieve workspace statistics
 */
export async function getSystemHealth(): Promise<SystemStats> {
  try {
    const res = await fetch(`${API_BASE}/status`, {
      method: 'GET',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        status: 'offline',
        error: err?.error || `Server responded with HTTP ${res.status}`,
      };
    }
    const data = await res.json();
    return { ...data, status: 'connected' };
  } catch (err) {
    return {
      status: 'offline',
      error: err instanceof Error ? err.message : 'Cannot connect to backend server',
    };
  }
}

export interface SystemExpensesResponse {
  expenses: Expense[];
  deletedIds?: Record<string, string>;
}

/**
 * Fetch all expenses and deletion tombstones stored in the active cloud/shared workspace
 */
export async function fetchSystemExpenses(): Promise<SystemExpensesResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/expenses`, {
      method: 'GET',
      headers: getHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      expenses: Array.isArray(data.expenses) ? data.expenses : [],
      deletedIds: data.deletedIds || {},
    };
  } catch (err) {
    console.warn('System database not reachable:', err);
    return null;
  }
}

/**
 * Save an expense with automatic online/offline routing
 */
export async function saveExpenseToSystem(expense: Expense): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueChange('save', expense.id, expense);
    return false;
  }

  updateSyncStatus('syncing', 'Saving expense to shared workspace...');
  try {
    const ok = await directSaveExpense(expense);
    if (ok) {
      updateSyncStatus('synced', 'Expense saved & synced');
      return true;
    } else {
      enqueueChange('save', expense.id, expense);
      updateSyncStatus('error', 'Server error while saving. Queued for auto-retry.');
      return false;
    }
  } catch (err) {
    enqueueChange('save', expense.id, expense);
    updateSyncStatus('offline', 'Network error. Queued for auto-retry.');
    return false;
  }
}

/**
 * Delete an expense with automatic online/offline routing
 */
export async function deleteExpenseFromSystem(id: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueChange('delete', id);
    return false;
  }

  updateSyncStatus('syncing', 'Deleting expense from shared workspace...');
  try {
    const ok = await directDeleteExpense(id);
    if (ok) {
      updateSyncStatus('synced', 'Expense deleted from shared workspace');
      return true;
    } else {
      enqueueChange('delete', id);
      updateSyncStatus('error', 'Server error while deleting. Queued for auto-retry.');
      return false;
    }
  } catch (err) {
    enqueueChange('delete', id);
    updateSyncStatus('offline', 'Network error. Queued for auto-retry.');
    return false;
  }
}

/**
 * Save a receipt image
 */
export async function saveReceiptToSystem(
  expenseId: string,
  dataUrl: string,
  name: string,
  size?: number,
  mimeType?: string
): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
  try {
    return await directSaveReceipt(expenseId, dataUrl, name, size, mimeType);
  } catch (err) {
    console.warn('Could not save receipt to shared workspace:', err);
    return false;
  }
}

/**
 * Delete a receipt
 */
export async function deleteReceiptFromSystem(expenseId: string): Promise<boolean> {
  try {
    return await directDeleteReceipt(expenseId);
  } catch (err) {
    console.warn('Could not delete receipt from shared workspace:', err);
    return false;
  }
}

export interface SyncResult {
  ok: boolean;
  message: string;
  count?: number;
}

/**
 * Batch sync a list of expenses to the active workspace
 */
export async function syncBatchToSystem(expenses: Expense[]): Promise<SyncResult> {
  updateSyncStatus('syncing', `Syncing ${expenses.length} record${expenses.length === 1 ? '' : 's'}...`);

  try {
    const res = await fetch(`${API_BASE}/sync`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ expenses }),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const count = typeof data.syncedCount === 'number' ? data.syncedCount : expenses.length;
      updateSyncStatus('synced', `Synced ${count} record${count === 1 ? '' : 's'}`);
      return {
        ok: true,
        count,
        message: `Successfully synchronized ${count} record${count === 1 ? '' : 's'} with workspace (${getWorkspaceId()})!`,
      };
    }

    const errData = await res.json().catch(() => null);
    const detail = errData?.error ? ` (${errData.error})` : '';
    const msg = `Sync failed: Server returned HTTP ${res.status}${detail}.`;
    updateSyncStatus('error', msg);
    return { ok: false, message: msg };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Connection failed';
    const msg = `Cannot connect to Finch sync server (${detail}). Changes are safely kept on this device.`;
    updateSyncStatus('offline', msg);
    return { ok: false, message: msg };
  }
}

/**
 * Intelligent two-way merge of local expenses with remote expenses.
 * Preserves active records while strictly respecting deletion tombstones,
 * preventing deleted records from ever resurrecting.
 */
export function reconcileExpenses(
  localList: Expense[],
  remoteList: Expense[],
  extraDeletedIds: Record<string, string> = {}
): { merged: Expense[]; needsPush: Expense[]; needsRemoteDelete: string[] } {
  const localTombstones = getTombstones();
  // Merge tombstones from local storage and remote backend
  const allTombstones: Record<string, string> = { ...localTombstones, ...extraDeletedIds };

  const map = new Map<string, Expense>();
  const needsPush: Expense[] = [];
  const needsRemoteDelete: string[] = [];

  // Index remote items
  remoteList.forEach((r) => {
    // If tombstoned and not updated strictly after deletion, ignore and mark for remote deletion
    const delTime = allTombstones[r.id];
    if (delTime) {
      const rTime = new Date(r.updatedAt || r.createdAt || 0).getTime();
      if (new Date(delTime).getTime() >= rTime) {
        needsRemoteDelete.push(r.id);
        return;
      }
    }
    map.set(r.id, r);
  });

  // Compare with local items
  localList.forEach((l) => {
    // If local item is tombstoned, discard it
    const delTime = allTombstones[l.id];
    if (delTime) {
      const lTime = new Date(l.updatedAt || l.createdAt || 0).getTime();
      if (new Date(delTime).getTime() >= lTime) {
        return;
      }
    }

    const remote = map.get(l.id);
    if (!remote) {
      // Local expense does not exist on remote yet and is not deleted -> keep and push to remote
      map.set(l.id, l);
      needsPush.push(l);
    } else {
      // Both exist -> pick whichever has more recent updatedAt or createdAt
      const localTime = new Date(l.updatedAt || l.createdAt || 0).getTime();
      const remoteTime = new Date(remote.updatedAt || remote.createdAt || 0).getTime();

      if (localTime > remoteTime) {
        map.set(l.id, l);
        needsPush.push(l);
      }
    }
  });

  const merged = Array.from(map.values()).sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return { merged, needsPush, needsRemoteDelete };
}

/**
 * Perform a full two-way reconciliation and queue flush
 */
export async function performFullSync(
  currentExpenses: Expense[]
): Promise<{ success: boolean; mergedExpenses: Expense[]; message: string }> {
  updateSyncStatus('syncing', 'Connecting to shared workspace...');

  // 1. Flush offline queue first
  await flushOfflineQueue();

  // 2. Fetch remote records & remote deletion tombstones
  const remoteData = await fetchSystemExpenses();
  if (remoteData === null) {
    updateSyncStatus('offline', 'Shared workspace is currently unreachable. Using local offline records.');
    return {
      success: false,
      mergedExpenses: currentExpenses,
      message: 'Could not connect to shared workspace. Working with local offline data.',
    };
  }

  // 3. Register any remote deletions into local tombstones
  if (remoteData.deletedIds) {
    Object.entries(remoteData.deletedIds).forEach(([id, deletedAt]) => {
      recordTombstone(id, deletedAt);
    });
  }

  // 4. Reconcile local and remote
  const { merged, needsPush, needsRemoteDelete } = reconcileExpenses(
    currentExpenses,
    remoteData.expenses,
    remoteData.deletedIds
  );

  // 5. If any local tombstones were still present on remote, delete them on remote
  for (const delId of needsRemoteDelete) {
    await directDeleteExpense(delId).catch(() => {});
  }

  // 6. If any genuine local records are missing on remote, upload them
  if (needsPush.length > 0) {
    updateSyncStatus('syncing', `Uploading ${needsPush.length} record(s) to shared workspace...`);
    await syncBatchToSystem(needsPush);
  }

  // 7. Immediately save clean merged state back to local storage
  saveExpenses(merged);

  updateSyncStatus('synced', `Synchronized with workspace "${getWorkspaceId()}"`);
  return {
    success: true,
    mergedExpenses: merged,
    message: `Connected to workspace "${getWorkspaceId()}". Synced ${merged.length} record(s).`,
  };
}

// Setup network event listeners for reactive reconnection
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    updateSyncStatus('syncing', 'Network reconnected. Syncing pending changes...');
    flushOfflineQueue();
  });

  window.addEventListener('offline', () => {
    updateSyncStatus('offline', 'Device is offline. Changes will be saved locally and synced when online.');
  });
}
