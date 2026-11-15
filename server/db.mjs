import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const DATA_DIR = path.join(ROOT_DIR, 'data');
const RECEIPTS_DIR = path.join(DATA_DIR, 'receipts');
const DB_PATH = path.join(DATA_DIR, 'finch.db');

// Ensure storage directories exist on the system
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(RECEIPTS_DIR)) {
  fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
}

// Initialize SQLite database with WAL mode for high concurrency
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    nature TEXT NOT NULL,
    description TEXT NOT NULL,
    kiosk_tag TEXT,
    payment_mode TEXT NOT NULL,
    notes TEXT,
    has_receipt INTEGER DEFAULT 0,
    receipt_name TEXT,
    receipt_size INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
  CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
  CREATE INDEX IF NOT EXISTS idx_expenses_nature ON expenses(nature);

  CREATE TABLE IF NOT EXISTS receipts (
    expense_id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(expense_id) REFERENCES expenses(id) ON DELETE CASCADE
  );
`);

/**
 * Convert DB row to Expense TypeScript-compatible object
 */
function rowToExpense(row) {
  return {
    id: row.id,
    date: row.date,
    amount: row.amount,
    category: row.category,
    nature: row.nature,
    description: row.description,
    kioskTag: row.kiosk_tag || undefined,
    paymentMode: row.payment_mode,
    notes: row.notes || undefined,
    hasReceipt: Boolean(row.has_receipt),
    receiptName: row.receipt_name || undefined,
    receiptSize: row.receipt_size || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAllExpenses() {
  const query = db.prepare('SELECT * FROM expenses ORDER BY date DESC, created_at DESC');
  const rows = query.all();
  return rows.map(rowToExpense);
}

export function getExpenseById(id) {
  const query = db.prepare('SELECT * FROM expenses WHERE id = ?');
  const row = query.get(id);
  return row ? rowToExpense(row) : null;
}

export function saveExpense(exp) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO expenses (
      id, date, amount, category, nature, description, kiosk_tag,
      payment_mode, notes, has_receipt, receipt_name, receipt_size, created_at, updated_at
    ) VALUES (
      @id, @date, @amount, @category, @nature, @description, @kiosk_tag,
      @payment_mode, @notes, @has_receipt, @receipt_name, @receipt_size, @created_at, @updated_at
    )
    ON CONFLICT(id) DO UPDATE SET
      date = excluded.date,
      amount = excluded.amount,
      category = excluded.category,
      nature = excluded.nature,
      description = excluded.description,
      kiosk_tag = excluded.kiosk_tag,
      payment_mode = excluded.payment_mode,
      notes = excluded.notes,
      has_receipt = excluded.has_receipt,
      receipt_name = excluded.receipt_name,
      receipt_size = excluded.receipt_size,
      updated_at = excluded.updated_at;
  `);

  stmt.run({
    id: exp.id,
    date: exp.date,
    amount: exp.amount,
    category: exp.category,
    nature: exp.nature,
    description: exp.description,
    kiosk_tag: exp.kioskTag || null,
    payment_mode: exp.paymentMode,
    notes: exp.notes || null,
    has_receipt: exp.hasReceipt ? 1 : 0,
    receipt_name: exp.receiptName || null,
    receipt_size: exp.receiptSize || null,
    created_at: exp.createdAt || now,
    updated_at: now,
  });

  return getExpenseById(exp.id);
}

export function deleteExpense(id) {
  deleteReceipt(id);
  const stmt = db.prepare('DELETE FROM expenses WHERE id = ?');
  stmt.run(id);
  return true;
}

export function saveReceipt(expenseId, dataUrl, filename = 'receipt.jpg') {
  // Parse data URL
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid data URL format for receipt');
  }

  const mimeType = match[1];
  const base64Data = match[2];
  const buffer = Buffer.from(base64Data, 'base64');

  // Determine file extension
  let ext = '.jpg';
  if (mimeType.includes('png')) ext = '.png';
  else if (mimeType.includes('webp')) ext = '.webp';
  else if (mimeType.includes('pdf')) ext = '.pdf';

  const safeFilename = `${expenseId}${ext}`;
  const filePath = path.join(RECEIPTS_DIR, safeFilename);

  fs.writeFileSync(filePath, buffer);

  // Update receipts table
  const stmt = db.prepare(`
    INSERT INTO receipts (expense_id, filename, mime_type, size_bytes, file_path, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(expense_id) DO UPDATE SET
      filename = excluded.filename,
      mime_type = excluded.mime_type,
      size_bytes = excluded.size_bytes,
      file_path = excluded.file_path,
      created_at = excluded.created_at;
  `);

  stmt.run(expenseId, filename, mimeType, buffer.length, filePath, new Date().toISOString());

  // Also update parent expense record
  const updateExpense = db.prepare(`
    UPDATE expenses
    SET has_receipt = 1, receipt_name = ?, receipt_size = ?, updated_at = ?
    WHERE id = ?;
  `);
  updateExpense.run(filename, buffer.length, new Date().toISOString(), expenseId);

  return {
    expenseId,
    filename,
    mimeType,
    size: buffer.length,
    path: filePath,
  };
}

export function getReceipt(expenseId) {
  const query = db.prepare('SELECT * FROM receipts WHERE expense_id = ?');
  const record = query.get(expenseId);
  if (!record || !fs.existsSync(record.file_path)) {
    return null;
  }

  const buffer = fs.readFileSync(record.file_path);
  const dataUrl = `data:${record.mime_type};base64,${buffer.toString('base64')}`;

  return {
    expenseId: record.expense_id,
    filename: record.filename,
    mimeType: record.mime_type,
    size: record.size_bytes,
    dataUrl,
    buffer,
  };
}

export function deleteReceipt(expenseId) {
  const query = db.prepare('SELECT * FROM receipts WHERE expense_id = ?');
  const record = query.get(expenseId);
  if (record && fs.existsSync(record.file_path)) {
    try {
      fs.unlinkSync(record.file_path);
    } catch (e) {
      console.warn('Could not unlink receipt file:', e);
    }
  }

  const stmt = db.prepare('DELETE FROM receipts WHERE expense_id = ?');
  stmt.run(expenseId);

  const updateExpense = db.prepare(`
    UPDATE expenses
    SET has_receipt = 0, receipt_name = NULL, receipt_size = NULL, updated_at = ?
    WHERE id = ?;
  `);
  updateExpense.run(new Date().toISOString(), expenseId);
}

export function getSystemStats() {
  const countRow = db.prepare('SELECT COUNT(*) as count, SUM(amount) as total FROM expenses').get();
  const receiptRow = db.prepare('SELECT COUNT(*) as count, SUM(size_bytes) as total_size FROM receipts').get();

  let dbSize = 0;
  if (fs.existsSync(DB_PATH)) {
    dbSize = fs.statSync(DB_PATH).size;
  }

  return {
    status: 'connected',
    engine: 'SQLite (node:sqlite) + Local Filesystem',
    databasePath: DB_PATH,
    receiptsDirectory: RECEIPTS_DIR,
    databaseSizeBytes: dbSize,
    totalExpensesCount: countRow.count || 0,
    totalSpendAmount: countRow.total || 0,
    totalReceiptsCount: receiptRow.count || 0,
    totalReceiptsSizeBytes: receiptRow.total_size || 0,
  };
}
