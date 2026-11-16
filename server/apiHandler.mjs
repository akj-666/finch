import {
  getAllExpenses,
  getExpenseById,
  saveExpense,
  deleteExpense,
  saveReceipt,
  getReceipt,
  deleteReceipt,
  syncBatchExpenses,
  getSystemStats,
} from './db.mjs';

async function readBody(req) {
  if (req.body !== undefined) {
    if (typeof req.body === 'object' && req.body !== null) {
      return req.body;
    }
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch (e) {
        return {};
      }
    }
  }

  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, obj) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-workspace-id, x-database-url, Authorization');
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(statusCode).json(obj);
  } else {
    res.end(JSON.stringify(obj));
  }
}

export async function handleApiRequest(req, res) {
  const method = (req.method || 'GET').toUpperCase();

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-workspace-id, x-database-url, Authorization');
    res.end();
    return true;
  }

  let reqUrl = req.url || '/api';
  if (req.headers && req.headers['x-matched-path']) {
    reqUrl = req.headers['x-matched-path'];
  }
  const urlObj = new URL(reqUrl, 'http://localhost');
  let pathname = urlObj.pathname;

  // Handle Vercel catch-all route if present
  if ((pathname === '/api' || pathname === '/api/' || pathname === '/api/index') && req.query?.path) {
    const p = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path;
    pathname = `/api/${p}`;
  }

  // Only handle /api routes
  if (!pathname.startsWith('/api')) {
    return false;
  }

  // Extract workspace ID and custom database URL
  const workspaceId =
    (req.headers && req.headers['x-workspace-id']) ||
    urlObj.searchParams.get('workspace') ||
    (req.query && req.query.workspace) ||
    'default';

  const customUrl =
    (req.headers && req.headers['x-database-url']) ||
    urlObj.searchParams.get('database_url') ||
    (req.query && req.query.database_url) ||
    undefined;

  try {
    // 1. System Health & Storage Stats
    if (pathname === '/api/status' && method === 'GET') {
      const stats = await getSystemStats(workspaceId, customUrl);
      sendJson(res, 200, stats);
      return true;
    }

    // 2. Expenses CRUD
    if (pathname === '/api/expenses' && method === 'GET') {
      const expenses = await getAllExpenses(workspaceId, customUrl);
      sendJson(res, 200, { expenses, workspaceId });
      return true;
    }

    if (pathname === '/api/expenses' && method === 'POST') {
      const body = await readBody(req);
      if (!body.description || !body.amount || !body.date) {
        sendJson(res, 400, { error: 'Missing required expense fields (description, amount, date)' });
        return true;
      }
      const saved = await saveExpense(body, workspaceId, customUrl);
      sendJson(res, 201, { success: true, expense: saved, workspaceId });
      return true;
    }

    if (pathname.startsWith('/api/expenses/') && method === 'DELETE') {
      const id = pathname.replace('/api/expenses/', '');
      await deleteExpense(id, workspaceId, customUrl);
      sendJson(res, 200, { success: true, deletedId: id, workspaceId });
      return true;
    }

    // 3. Receipts
    if (pathname.startsWith('/api/receipts/') && method === 'POST') {
      const expenseId = pathname.replace('/api/receipts/', '');
      const body = await readBody(req);
      if (!body.dataUrl) {
        sendJson(res, 400, { error: 'Missing dataUrl for receipt' });
        return true;
      }
      const result = await saveReceipt(
        expenseId,
        body.dataUrl,
        body.name || 'receipt.jpg',
        workspaceId,
        customUrl
      );
      sendJson(res, 200, { success: true, receipt: result, workspaceId });
      return true;
    }

    if (pathname.startsWith('/api/receipts/') && method === 'GET') {
      const expenseId = pathname.replace('/api/receipts/', '');
      const receipt = await getReceipt(expenseId, workspaceId, customUrl);
      if (!receipt) {
        sendJson(res, 404, { error: 'Receipt not found' });
        return true;
      }

      // If client requests raw binary image
      if (urlObj.searchParams.get('raw') === 'true' && receipt.buffer) {
        res.statusCode = 200;
        res.setHeader('Content-Type', receipt.mimeType || 'image/jpeg');
        res.setHeader('Content-Length', receipt.size || receipt.buffer.length);
        res.end(receipt.buffer);
        return true;
      }

      sendJson(res, 200, { receipt, workspaceId });
      return true;
    }

    if (pathname.startsWith('/api/receipts/') && method === 'DELETE') {
      const expenseId = pathname.replace('/api/receipts/', '');
      await deleteReceipt(expenseId, workspaceId, customUrl);
      sendJson(res, 200, { success: true, deletedExpenseId: expenseId, workspaceId });
      return true;
    }

    // 4. Batch Sync / Import
    if (pathname === '/api/sync' && method === 'POST') {
      const body = await readBody(req);
      const items = Array.isArray(body.expenses) ? body.expenses : [];
      const result = await syncBatchExpenses(items, workspaceId, customUrl);
      sendJson(res, 200, { success: true, workspaceId, ...result });
      return true;
    }

    sendJson(res, 404, { error: `Endpoint not found: ${pathname}` });
    return true;
  } catch (err) {
    console.error('API Error:', err);
    sendJson(res, 500, { error: err.message || 'Internal server error' });
    return true;
  }
}
