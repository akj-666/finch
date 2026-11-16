import { createClient } from '@libsql/client';
import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === 'production' && !fs.existsSync(path.join(ROOT_DIR, 'data'))
  ? path.join('/tmp', 'finch_data')
  : path.join(ROOT_DIR, 'data');
const DB_PATH = path.join(DATA_DIR, 'finch.db');

// Ensure local storage directory exists if running with local files
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {}
}

// If running in a serverless environment with an initial packaged database, seed it into writable /tmp
const packagedDb = path.join(ROOT_DIR, 'data', 'finch.db');
if (fs.existsSync(packagedDb) && !fs.existsSync(DB_PATH) && DB_PATH !== packagedDb) {
  try {
    fs.copyFileSync(packagedDb, DB_PATH);
  } catch (e) {}
}

/**
 * Determine active database engine based on environment variables or explicit config
 */
function resolveDatabaseConfig(customUrl) {
  const url = customUrl ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DATABASE_URL ||
    process.env.TURSO_DATABASE_URL ||
    process.env.LIBSQL_URL ||
    `file:${DB_PATH}`;

  const authToken = process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN;

  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    return { type: 'postgres', url };
  }

  if (url.startsWith('libsql://') || (url.startsWith('https://') && url.includes('turso.io'))) {
    return { type: 'turso', url, authToken };
  }

  // Fallback to local SQLite file
  return { type: 'sqlite', url: url.startsWith('file:') ? url : `file:${url}` };
}

// Global cached client instances to avoid reconnection on serverless warm starts
let cachedClient = null;
let cachedConfigType = null;
let tablesInitialized = false;

export function getDatabaseClient(customUrl) {
  const config = resolveDatabaseConfig(customUrl);

  if (cachedClient && cachedConfigType === config.type && !customUrl) {
    return { client: cachedClient, type: cachedConfigType };
  }

  if (config.type === 'postgres') {
    const sql = neon(config.url);
    cachedClient = sql;
    cachedConfigType = 'postgres';
    return { client: sql, type: 'postgres' };
  }

  // LibSQL / Turso or local SQLite file
  const client = createClient({
    url: config.url,
    authToken: config.authToken,
  });
  cachedClient = client;
  cachedConfigType = config.type;
  return { client, type: config.type };
}

/**
 * Ensure database schema exists on the active database
 */
export async function ensureSchema(customUrl) {
  if (tablesInitialized && !customUrl) return;

  const { client, type } = getDatabaseClient(customUrl);

  if (type === 'postgres') {
    await client`
      CREATE TABLE IF NOT EXISTS expenses (
        id VARCHAR(100) PRIMARY KEY,
        workspace_id VARCHAR(100) NOT NULL DEFAULT 'default',
        date VARCHAR(20) NOT NULL,
        amount NUMERIC NOT NULL,
        category VARCHAR(100) NOT NULL,
        nature VARCHAR(20) NOT NULL,
        description TEXT NOT NULL,
        kiosk_tag VARCHAR(100),
        payment_mode VARCHAR(50) NOT NULL,
        notes TEXT,
        has_receipt INTEGER DEFAULT 0,
        receipt_name TEXT,
        receipt_size INTEGER,
        created_at VARCHAR(50) NOT NULL,
        updated_at VARCHAR(50) NOT NULL
      );
    `;

    await client`
      CREATE INDEX IF NOT EXISTS idx_expenses_workspace ON expenses(workspace_id);
    `;
    await client`
      CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(workspace_id, date);
    `;

    await client`
      CREATE TABLE IF NOT EXISTS receipts (
        expense_id VARCHAR(100) PRIMARY KEY,
        workspace_id VARCHAR(100) NOT NULL DEFAULT 'default',
        filename VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        size_bytes INTEGER NOT NULL,
        data_url TEXT NOT NULL,
        created_at VARCHAR(50) NOT NULL,
        FOREIGN KEY(expense_id) REFERENCES expenses(id) ON DELETE CASCADE
      );
    `;

    try {
      await client`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS workspace_id VARCHAR(100) NOT NULL DEFAULT 'default';`;
    } catch (e) {}
    try {
      await client`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS data_url TEXT;`;
    } catch (e) {}

    await client`
      CREATE TABLE IF NOT EXISTS deleted_expenses (
        id VARCHAR(100) PRIMARY KEY,
        workspace_id VARCHAR(100) NOT NULL DEFAULT 'default',
        deleted_at VARCHAR(50) NOT NULL
      );
    `;
    await client`
      CREATE INDEX IF NOT EXISTS idx_deleted_workspace ON deleted_expenses(workspace_id);
    `;
  } else {
    // LibSQL / SQLite
    await client.execute(`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL DEFAULT 'default',
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
    `);

    // Add workspace_id column if upgrading an existing finch.db without it
    try {
      await client.execute(`ALTER TABLE expenses ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default';`);
    } catch (e) {
      // Column already exists
    }

    await client.execute(`CREATE INDEX IF NOT EXISTS idx_expenses_workspace ON expenses(workspace_id);`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(workspace_id, date);`);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS receipts (
        expense_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL DEFAULT 'default',
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        file_path TEXT NOT NULL DEFAULT '',
        data_url TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(expense_id) REFERENCES expenses(id) ON DELETE CASCADE
      );
    `);

    try {
      await client.execute(`ALTER TABLE receipts ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default';`);
    } catch (e) {
      // Column already exists
    }

    try {
      await client.execute(`ALTER TABLE receipts ADD COLUMN file_path TEXT NOT NULL DEFAULT '';`);
    } catch (e) {
      // Column already exists
    }

    try {
      await client.execute(`ALTER TABLE receipts ADD COLUMN data_url TEXT;`);
    } catch (e) {
      // Column already exists
    }

    await client.execute(`
      CREATE TABLE IF NOT EXISTS deleted_expenses (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL DEFAULT 'default',
        deleted_at TEXT NOT NULL
      );
    `);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_deleted_workspace ON deleted_expenses(workspace_id);`);
  }

  tablesInitialized = true;
}

/**
 * Format a database row into standard Expense object
 */
function rowToExpense(row) {
  return {
    id: String(row.id),
    workspaceId: row.workspace_id || 'default',
    date: String(row.date),
    amount: Number(row.amount),
    category: String(row.category),
    nature: String(row.nature),
    description: String(row.description),
    kioskTag: row.kiosk_tag || undefined,
    paymentMode: String(row.payment_mode),
    notes: row.notes || undefined,
    hasReceipt: Boolean(row.has_receipt),
    receiptName: row.receipt_name || undefined,
    receiptSize: row.receipt_size ? Number(row.receipt_size) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/**
 * Get all expenses for a specific workspace
 */
export async function getAllExpenses(workspaceId = 'default', customUrl) {
  await ensureSchema(customUrl);
  const { client, type } = getDatabaseClient(customUrl);
  const targetWorkspace = String(workspaceId || 'default').trim();

  if (type === 'postgres') {
    const rows = await client`
      SELECT * FROM expenses
      WHERE workspace_id = ${targetWorkspace}
      ORDER BY date DESC, created_at DESC;
    `;
    return rows.map(rowToExpense);
  } else {
    const res = await client.execute({
      sql: `SELECT * FROM expenses WHERE workspace_id = ? ORDER BY date DESC, created_at DESC;`,
      args: [targetWorkspace],
    });
    return res.rows.map(rowToExpense);
  }
}

/**
 * Get single expense by ID
 */
export async function getExpenseById(id, workspaceId = 'default', customUrl) {
  await ensureSchema(customUrl);
  const { client, type } = getDatabaseClient(customUrl);
  const targetWorkspace = String(workspaceId || 'default').trim();

  if (type === 'postgres') {
    const rows = await client`
      SELECT * FROM expenses
      WHERE id = ${String(id)} AND workspace_id = ${targetWorkspace}
      LIMIT 1;
    `;
    return rows.length > 0 ? rowToExpense(rows[0]) : null;
  } else {
    const res = await client.execute({
      sql: `SELECT * FROM expenses WHERE id = ? AND workspace_id = ? LIMIT 1;`,
      args: [String(id), targetWorkspace],
    });
    return res.rows.length > 0 ? rowToExpense(res.rows[0]) : null;
  }
}

/**
 * Save or update (upsert) an expense
 */
export async function saveExpense(exp, workspaceId = 'default', customUrl) {
  await ensureSchema(customUrl);
  const { client, type } = getDatabaseClient(customUrl);
  const targetWorkspace = String(workspaceId || 'default').trim();
  const now = new Date().toISOString();

  const id = String(exp.id || `exp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
  const date = String(exp.date || now.split('T')[0]);
  const amount = typeof exp.amount === 'number' && !isNaN(exp.amount) ? exp.amount : (Number(exp.amount) || 0);
  const category = String(exp.category || 'Other Expenses');
  const nature = exp.nature === 'CapEx' || exp.nature === 'OpEx' ? exp.nature : 'OpEx';
  const description = String(exp.description || 'Expense entry');
  const kioskTag = exp.kioskTag || exp.kiosk_tag || null;
  const paymentMode = String(exp.paymentMode || exp.payment_mode || 'Cash');
  const notes = exp.notes ? String(exp.notes) : null;
  const hasReceipt = exp.hasReceipt ? 1 : 0;
  const receiptName = exp.receiptName || exp.receipt_name || null;
  const receiptSize = typeof exp.receiptSize === 'number' ? exp.receiptSize : (typeof exp.receipt_size === 'number' ? exp.receipt_size : null);
  const createdAt = String(exp.createdAt || exp.created_at || now);
  const updatedAt = now;

  if (type === 'postgres') {
    // Clear any previous deletion tombstone since user is explicitly saving
    await client`DELETE FROM deleted_expenses WHERE id = ${id} AND workspace_id = ${targetWorkspace};`;

    await client`
      INSERT INTO expenses (
        id, workspace_id, date, amount, category, nature, description, kiosk_tag,
        payment_mode, notes, has_receipt, receipt_name, receipt_size, created_at, updated_at
      ) VALUES (
        ${id}, ${targetWorkspace}, ${date}, ${amount}, ${category}, ${nature}, ${description}, ${kioskTag},
        ${paymentMode}, ${notes}, ${hasReceipt}, ${receiptName}, ${receiptSize}, ${createdAt}, ${updatedAt}
      )
      ON CONFLICT(id) DO UPDATE SET
        workspace_id = excluded.workspace_id,
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
    `;
  } else {
    // Clear any previous deletion tombstone in SQLite
    await client.execute({
      sql: `DELETE FROM deleted_expenses WHERE id = ? AND workspace_id = ?;`,
      args: [id, targetWorkspace],
    });

    await client.execute({
      sql: `
        INSERT INTO expenses (
          id, workspace_id, date, amount, category, nature, description, kiosk_tag,
          payment_mode, notes, has_receipt, receipt_name, receipt_size, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          workspace_id = excluded.workspace_id,
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
      `,
      args: [
        id, targetWorkspace, date, amount, category, nature, description, kioskTag,
        paymentMode, notes, hasReceipt, receiptName, receiptSize, createdAt, updatedAt
      ],
    });
  }

  return await getExpenseById(id, targetWorkspace, customUrl);
}

/**
 * Delete expense by ID and register deletion tombstone
 */
export async function deleteExpense(id, workspaceId = 'default', customUrl) {
  await ensureSchema(customUrl);
  const { client, type } = getDatabaseClient(customUrl);
  const targetWorkspace = String(workspaceId || 'default').trim();
  const now = new Date().toISOString();

  await deleteReceipt(id, targetWorkspace, customUrl);

  if (type === 'postgres') {
    await client`
      DELETE FROM expenses
      WHERE id = ${String(id)} AND workspace_id = ${targetWorkspace};
    `;
    await client`
      INSERT INTO deleted_expenses (id, workspace_id, deleted_at)
      VALUES (${String(id)}, ${targetWorkspace}, ${now})
      ON CONFLICT(id) DO UPDATE SET deleted_at = ${now}, workspace_id = ${targetWorkspace};
    `;
  } else {
    await client.execute({
      sql: `DELETE FROM expenses WHERE id = ? AND workspace_id = ?;`,
      args: [String(id), targetWorkspace],
    });
    await client.execute({
      sql: `
        INSERT INTO deleted_expenses (id, workspace_id, deleted_at)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET deleted_at = excluded.deleted_at, workspace_id = excluded.workspace_id;
      `,
      args: [String(id), targetWorkspace, now],
    });
  }

  return true;
}

/**
 * Get map of deleted expense IDs (tombstones)
 */
export async function getDeletedExpenseIds(workspaceId = 'default', customUrl) {
  await ensureSchema(customUrl);
  const { client, type } = getDatabaseClient(customUrl);
  const targetWorkspace = String(workspaceId || 'default').trim();

  if (type === 'postgres') {
    const rows = await client`
      SELECT id, deleted_at FROM deleted_expenses
      WHERE workspace_id = ${targetWorkspace};
    `;
    const map = {};
    rows.forEach((r) => {
      map[r.id] = r.deleted_at;
    });
    return map;
  } else {
    const res = await client.execute({
      sql: `SELECT id, deleted_at FROM deleted_expenses WHERE workspace_id = ?;`,
      args: [targetWorkspace],
    });
    const map = {};
    res.rows.forEach((r) => {
      map[String(r.id)] = String(r.deleted_at);
    });
    return map;
  }
}

/**
 * Save receipt data for cross-device sync
 */
export async function saveReceipt(expenseId, dataUrl, filename = 'receipt.jpg', workspaceId = 'default', customUrl) {
  await ensureSchema(customUrl);
  const { client, type } = getDatabaseClient(customUrl);
  const targetWorkspace = String(workspaceId || 'default').trim();
  const now = new Date().toISOString();

  let mimeType = 'image/jpeg';
  if (dataUrl.includes('image/png')) mimeType = 'image/png';
  else if (dataUrl.includes('image/webp')) mimeType = 'image/webp';
  else if (dataUrl.includes('application/pdf')) mimeType = 'application/pdf';

  const sizeBytes = Math.round((dataUrl.length * 3) / 4);

  if (type === 'postgres') {
    await client`
      INSERT INTO receipts (expense_id, workspace_id, filename, mime_type, size_bytes, data_url, created_at)
      VALUES (${expenseId}, ${targetWorkspace}, ${filename}, ${mimeType}, ${sizeBytes}, ${dataUrl}, ${now})
      ON CONFLICT(expense_id) DO UPDATE SET
        workspace_id = excluded.workspace_id,
        filename = excluded.filename,
        mime_type = excluded.mime_type,
        size_bytes = excluded.size_bytes,
        data_url = excluded.data_url,
        created_at = excluded.created_at;
    `;

    await client`
      UPDATE expenses
      SET has_receipt = 1, receipt_name = ${filename}, receipt_size = ${sizeBytes}, updated_at = ${now}
      WHERE id = ${expenseId} AND workspace_id = ${targetWorkspace};
    `;
  } else {
    const relativePath = path.join('data', 'receipts', `${expenseId}-${filename}`);
    const RECEIPTS_DIR = path.join(DATA_DIR, 'receipts');
    if (fs.existsSync(RECEIPTS_DIR) && dataUrl.includes('base64,')) {
      try {
        const b = Buffer.from(dataUrl.split('base64,')[1], 'base64');
        fs.writeFileSync(path.join(ROOT_DIR, relativePath), b);
      } catch (e) {}
    }

    await client.execute({
      sql: `
        INSERT INTO receipts (expense_id, workspace_id, filename, mime_type, size_bytes, file_path, data_url, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(expense_id) DO UPDATE SET
          workspace_id = excluded.workspace_id,
          filename = excluded.filename,
          mime_type = excluded.mime_type,
          size_bytes = excluded.size_bytes,
          file_path = excluded.file_path,
          data_url = excluded.data_url,
          created_at = excluded.created_at;
      `,
      args: [expenseId, targetWorkspace, filename, mimeType, sizeBytes, relativePath, dataUrl, now],
    });

    await client.execute({
      sql: `
        UPDATE expenses
        SET has_receipt = 1, receipt_name = ?, receipt_size = ?, updated_at = ?
        WHERE id = ? AND workspace_id = ?;
      `,
      args: [filename, sizeBytes, now, expenseId, targetWorkspace],
    });
  }

  return {
    expenseId,
    workspaceId: targetWorkspace,
    filename,
    mimeType,
    sizeBytes,
    dataUrl,
    createdAt: now,
  };
}

/**
 * Get receipt data
 */
export async function getReceipt(expenseId, workspaceId = 'default', customUrl) {
  await ensureSchema(customUrl);
  const { client, type } = getDatabaseClient(customUrl);
  const targetWorkspace = String(workspaceId || 'default').trim();

  let row = null;
  if (type === 'postgres') {
    const rows = await client`
      SELECT * FROM receipts
      WHERE expense_id = ${String(expenseId)} AND workspace_id = ${targetWorkspace}
      LIMIT 1;
    `;
    if (rows.length > 0) row = rows[0];
  } else {
    const res = await client.execute({
      sql: `SELECT * FROM receipts WHERE expense_id = ? AND workspace_id = ? LIMIT 1;`,
      args: [String(expenseId), targetWorkspace],
    });
    if (res.rows.length > 0) row = res.rows[0];
  }

  if (!row) return null;

  let buffer = null;
  if (row.data_url && row.data_url.includes('base64,')) {
    const base64Str = row.data_url.split('base64,')[1];
    buffer = Buffer.from(base64Str, 'base64');
  }

  return {
    expenseId: row.expense_id,
    workspaceId: row.workspace_id || targetWorkspace,
    name: row.filename,
    mimeType: row.mime_type,
    size: Number(row.size_bytes || (buffer ? buffer.length : 0)),
    dataUrl: row.data_url,
    buffer,
    createdAt: row.created_at,
  };
}

/**
 * Delete receipt
 */
export async function deleteReceipt(expenseId, workspaceId = 'default', customUrl) {
  await ensureSchema(customUrl);
  const { client, type } = getDatabaseClient(customUrl);
  const targetWorkspace = String(workspaceId || 'default').trim();
  const now = new Date().toISOString();

  if (type === 'postgres') {
    await client`
      DELETE FROM receipts
      WHERE expense_id = ${String(expenseId)} AND workspace_id = ${targetWorkspace};
    `;
    await client`
      UPDATE expenses
      SET has_receipt = 0, receipt_name = NULL, receipt_size = NULL, updated_at = ${now}
      WHERE id = ${String(expenseId)} AND workspace_id = ${targetWorkspace};
    `;
  } else {
    await client.execute({
      sql: `DELETE FROM receipts WHERE expense_id = ? AND workspace_id = ?;`,
      args: [String(expenseId), targetWorkspace],
    });
    await client.execute({
      sql: `UPDATE expenses SET has_receipt = 0, receipt_name = NULL, receipt_size = NULL, updated_at = ? WHERE id = ? AND workspace_id = ?;`,
      args: [now, String(expenseId), targetWorkspace],
    });
  }

  return true;
}

/**
 * Batch sync expenses (respects deletion tombstones)
 */
export async function syncBatchExpenses(expenses, workspaceId = 'default', customUrl) {
  if (!Array.isArray(expenses) || expenses.length === 0) {
    return { savedCount: 0, errors: [] };
  }

  const deletedMap = await getDeletedExpenseIds(workspaceId, customUrl);
  let savedCount = 0;
  const errors = [];

  for (const item of expenses) {
    if (item && (item.id || item.description)) {
      const id = String(item.id || '');
      const deletedAt = deletedMap[id];
      // If this item was deleted and the incoming item's updatedAt is not strictly newer, skip it!
      if (deletedAt) {
        const itemTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
        const delTime = new Date(deletedAt).getTime();
        if (itemTime <= delTime) {
          continue;
        }
      }

      try {
        await saveExpense(item, workspaceId, customUrl);
        savedCount++;
      } catch (err) {
        errors.push(`Item ${item.id || 'new'}: ${err.message}`);
      }
    }
  }

  return { savedCount, errors };
}

/**
 * System and workspace storage health stats
 */
export async function getSystemStats(workspaceId = 'default', customUrl) {
  await ensureSchema(customUrl);
  const { client, type } = getDatabaseClient(customUrl);
  const targetWorkspace = String(workspaceId || 'default').trim();

  let engineName = 'Local SQLite (file:data/finch.db)';
  if (type === 'postgres') {
    engineName = 'Cloud PostgreSQL (Neon / Supabase / Vercel Postgres)';
  } else if (type === 'turso') {
    engineName = 'Cloud SQLite (Turso / LibSQL)';
  }

  let count = 0;
  let total = 0;
  let receiptCount = 0;

  if (type === 'postgres') {
    const expRow = await client`
      SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE workspace_id = ${targetWorkspace};
    `;
    const recRow = await client`
      SELECT COUNT(*) as count
      FROM receipts
      WHERE workspace_id = ${targetWorkspace};
    `;
    count = parseInt(expRow[0]?.count || '0', 10);
    total = parseFloat(expRow[0]?.total || '0');
    receiptCount = parseInt(recRow[0]?.count || '0', 10);
  } else {
    const expRow = await client.execute({
      sql: `SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM expenses WHERE workspace_id = ?;`,
      args: [targetWorkspace],
    });
    const recRow = await client.execute({
      sql: `SELECT COUNT(*) as count FROM receipts WHERE workspace_id = ?;`,
      args: [targetWorkspace],
    });
    count = Number(expRow.rows[0]?.count || 0);
    total = Number(expRow.rows[0]?.total || 0);
    receiptCount = Number(recRow.rows[0]?.count || 0);
  }

  let dbSize = 0;
  if (type === 'sqlite' && fs.existsSync(DB_PATH)) {
    try {
      dbSize = fs.statSync(DB_PATH).size;
    } catch (e) {}
  }

  return {
    status: 'connected',
    engine: engineName,
    engineType: type,
    workspaceId: targetWorkspace,
    databaseSizeBytes: dbSize,
    totalExpensesCount: count,
    totalSpendAmount: total,
    totalReceiptsCount: receiptCount,
  };
}
