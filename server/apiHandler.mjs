import {
  getAllExpenses,
  getExpenseById,
  saveExpense,
  deleteExpense,
  saveReceipt,
  getReceipt,
  deleteReceipt,
  getSystemStats,
} from './db.mjs';

function readBody(req) {
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(obj));
}

export async function handleApiRequest(req, res) {
  const urlObj = new URL(req.url, 'http://localhost');
  const pathname = urlObj.pathname;
  const method = req.method.toUpperCase();

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.end();
    return true;
  }

  // Only handle /api routes
  if (!pathname.startsWith('/api')) {
    return false;
  }

  try {
    // 1. System Health & Storage Stats
    if (pathname === '/api/status' && method === 'GET') {
      const stats = getSystemStats();
      sendJson(res, 200, stats);
      return true;
    }

    // 2. Expenses CRUD
    if (pathname === '/api/expenses' && method === 'GET') {
      const expenses = getAllExpenses();
      sendJson(res, 200, { expenses });
      return true;
    }

    if (pathname === '/api/expenses' && method === 'POST') {
      const body = await readBody(req);
      if (!body.description || !body.amount || !body.date) {
        sendJson(res, 400, { error: 'Missing required expense fields' });
        return true;
      }
      const saved = saveExpense(body);
      sendJson(res, 201, { success: true, expense: saved });
      return true;
    }

    if (pathname.startsWith('/api/expenses/') && method === 'DELETE') {
      const id = pathname.replace('/api/expenses/', '');
      deleteExpense(id);
      sendJson(res, 200, { success: true, deletedId: id });
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
      const result = saveReceipt(expenseId, body.dataUrl, body.name || 'receipt.jpg');
      sendJson(res, 200, { success: true, receipt: result });
      return true;
    }

    if (pathname.startsWith('/api/receipts/') && method === 'GET') {
      const expenseId = pathname.replace('/api/receipts/', '');
      const receipt = getReceipt(expenseId);
      if (!receipt) {
        sendJson(res, 404, { error: 'Receipt not found' });
        return true;
      }

      // If client requests raw binary image
      if (urlObj.searchParams.get('raw') === 'true') {
        res.statusCode = 200;
        res.setHeader('Content-Type', receipt.mimeType);
        res.setHeader('Content-Length', receipt.size);
        res.end(receipt.buffer);
        return true;
      }

      sendJson(res, 200, { receipt });
      return true;
    }

    if (pathname.startsWith('/api/receipts/') && method === 'DELETE') {
      const expenseId = pathname.replace('/api/receipts/', '');
      deleteReceipt(expenseId);
      sendJson(res, 200, { success: true, deletedExpenseId: expenseId });
      return true;
    }

    // 4. Batch Sync / Import (e.g. migrate localStorage data to SQLite)
    if (pathname === '/api/sync' && method === 'POST') {
      const body = await readBody(req);
      const items = Array.isArray(body.expenses) ? body.expenses : [];
      let savedCount = 0;
      const errors = [];
      for (const item of items) {
        if (item && (item.id || item.description)) {
          try {
            saveExpense(item);
            savedCount++;
          } catch (itemErr) {
            console.error('Failed to sync item:', item, itemErr);
            errors.push(itemErr.message);
          }
        }
      }
      sendJson(res, 200, { success: true, syncedCount: savedCount, errors });
      return true;
    }

    sendJson(res, 404, { error: 'Endpoint not found' });
    return true;
  } catch (err) {
    console.error('API Error:', err);
    sendJson(res, 500, { error: err.message || 'Internal server error' });
    return true;
  }
}
