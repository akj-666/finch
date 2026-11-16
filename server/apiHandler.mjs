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
  getDeletedExpenseIds,
  isMasterPasswordSet,
  setMasterPassword,
  verifyMasterPassword,
  createAuthSession,
  validateAuthSession,
  revokeAuthSession,
  checkRateLimit,
  recordFailedAttempt,
  resetFailedAttempts,
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-workspace-id, x-database-url, Authorization, x-session-token');
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(statusCode).json(obj);
  } else {
    res.end(JSON.stringify(obj));
  }
}

function extractSessionToken(req, urlObj) {
  const authHeader = (req.headers && req.headers['authorization']) || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  if (req.headers && req.headers['x-session-token']) {
    return String(req.headers['x-session-token']).trim();
  }
  return urlObj.searchParams.get('token') || (req.query && req.query.token) || null;
}

function getClientIp(req) {
  const forwarded = req.headers && req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'default_ip';
}

export async function handleApiRequest(req, res) {
  const method = (req.method || 'GET').toUpperCase();

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-workspace-id, x-database-url, Authorization, x-session-token');
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
    // -------------------------------------------------------------
    // Public Auth Endpoints (Status, Setup, Login, Logout)
    // -------------------------------------------------------------

    // Check system password status
    if (pathname === '/api/auth/status' && method === 'GET') {
      const isPasswordSet = await isMasterPasswordSet(customUrl);
      const token = extractSessionToken(req, urlObj);
      const authenticated = isPasswordSet ? await validateAuthSession(token, customUrl) : false;
      sendJson(res, 200, {
        isPasswordSet,
        authenticated,
        locked: isPasswordSet && !authenticated,
      });
      return true;
    }

    // Set Master Access Password (First-Time Permanent Setup Only)
    if (pathname === '/api/auth/setup' && method === 'POST') {
      const isPasswordSet = await isMasterPasswordSet(customUrl);
      if (isPasswordSet) {
        sendJson(res, 403, {
          error: 'Master password has already been set and is permanent. It cannot be changed or reset.',
        });
        return true;
      }

      const body = await readBody(req);
      if (!body.password || typeof body.password !== 'string' || body.password.length < 6) {
        sendJson(res, 400, { error: 'Master password must be at least 6 characters long.' });
        return true;
      }

      await setMasterPassword(body.password, customUrl);
      // Automatically log the creator in with a session token
      const session = await createAuthSession(customUrl);
      sendJson(res, 201, {
        success: true,
        message: 'Master password set permanently. Access is now strictly restricted.',
        token: session.token,
        expiresAt: session.expiresAt,
      });
      return true;
    }

    // Unlock / Login with Master Password
    if (pathname === '/api/auth/login' && method === 'POST') {
      const isPasswordSet = await isMasterPasswordSet(customUrl);
      if (!isPasswordSet) {
        sendJson(res, 400, { error: 'Master password has not been configured yet. Please complete setup.' });
        return true;
      }

      const clientIp = getClientIp(req);
      const rateStatus = await checkRateLimit(clientIp, customUrl);
      if (!rateStatus.allowed) {
        sendJson(res, 429, {
          error: `Too many failed attempts. Access is temporarily locked. Please wait ${rateStatus.cooldownSeconds} seconds.`,
          cooldownSeconds: rateStatus.cooldownSeconds,
        });
        return true;
      }

      const body = await readBody(req);
      const valid = await verifyMasterPassword(body.password, customUrl);

      if (!valid) {
        const failedResult = await recordFailedAttempt(clientIp, customUrl);
        const remaining = Math.max(0, 5 - failedResult.attempts);
        sendJson(res, 401, {
          error: failedResult.isLocked
            ? 'Too many failed attempts. Temporary 60-second cooldown active.'
            : `Incorrect master password. ${remaining} attempt(s) remaining before temporary lockout.`,
          cooldownSeconds: failedResult.cooldownSeconds,
        });
        return true;
      }

      await resetFailedAttempts(clientIp, customUrl);
      const session = await createAuthSession(customUrl);
      sendJson(res, 200, {
        success: true,
        token: session.token,
        expiresAt: session.expiresAt,
      });
      return true;
    }

    // Lock / Logout session
    if (pathname === '/api/auth/logout' && method === 'POST') {
      const token = extractSessionToken(req, urlObj);
      if (token) {
        await revokeAuthSession(token, customUrl);
      }
      sendJson(res, 200, { success: true, message: 'Expense tracker locked.' });
      return true;
    }

    // -------------------------------------------------------------
    // STRICT ACCESS GATEWAY FOR ALL DATA ENDPOINTS
    // -------------------------------------------------------------
    const passwordSet = await isMasterPasswordSet(customUrl);
    if (passwordSet) {
      const token = extractSessionToken(req, urlObj);
      const isSessionValid = await validateAuthSession(token, customUrl);
      if (!isSessionValid) {
        sendJson(res, 401, {
          error: 'Restricted Access: Valid master password session required.',
          locked: true,
          isPasswordSet: true,
        });
        return true;
      }
    }

    // 1. System Health & Storage Stats
    if (pathname === '/api/status' && method === 'GET') {
      const stats = await getSystemStats(workspaceId, customUrl);
      sendJson(res, 200, stats);
      return true;
    }

    // 2. Expenses CRUD
    if (pathname === '/api/expenses' && method === 'GET') {
      const expenses = await getAllExpenses(workspaceId, customUrl);
      const deletedIds = await getDeletedExpenseIds(workspaceId, customUrl);
      sendJson(res, 200, { expenses, deletedIds, workspaceId });
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
