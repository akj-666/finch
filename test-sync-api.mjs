import assert from 'node:assert';
import { handleApiRequest } from './server/apiHandler.mjs';

function createMockReq({ url = '/api/status', method = 'GET', headers = {}, body = null } = {}) {
  const reqListeners = {};
  return {
    url,
    method,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body,
    on(event, cb) {
      reqListeners[event] = cb;
      if (event === 'data' && body) {
        cb(typeof body === 'string' ? body : JSON.stringify(body));
      }
      if (event === 'end') {
        setTimeout(cb, 5);
      }
    },
  };
}

function createMockRes() {
  let statusCode = 200;
  const headers = {};
  let body = '';

  return {
    setHeader(name, val) {
      headers[name.toLowerCase()] = val;
    },
    set statusCode(code) {
      statusCode = code;
    },
    get statusCode() {
      return statusCode;
    },
    end(data) {
      if (data) body = data;
    },
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      body = JSON.stringify(data);
      return this;
    },
    get response() {
      try {
        return { statusCode, headers, body: JSON.parse(body) };
      } catch (e) {
        return { statusCode, headers, rawBody: body };
      }
    },
  };
}

async function runTests() {
  console.log('=== STARTING SYNC & WORKSPACE API VERIFICATION ===\n');

  // Obtain a valid session token
  const testPassword = 'KottayamSuperSecret@2026';
  let sessionToken = null;

  // Try setup if not set, or login
  {
    const setupReq = createMockReq({
      url: '/api/auth/setup',
      method: 'POST',
      body: { password: testPassword },
    });
    const setupRes = createMockRes();
    await handleApiRequest(setupReq, setupRes);
    if (setupRes.response.statusCode === 201) {
      sessionToken = setupRes.response.body.token;
    } else {
      // Password already set, log in
      const loginReq = createMockReq({
        url: '/api/auth/login',
        method: 'POST',
        body: { password: testPassword },
      });
      const loginRes = createMockRes();
      await handleApiRequest(loginReq, loginRes);
      assert.strictEqual(loginRes.response.statusCode, 200, 'Login must succeed');
      sessionToken = loginRes.response.body.token;
    }
  }

  assert.ok(sessionToken, 'Must have a valid session token for tests');
  const authHeaders = {
    authorization: `Bearer ${sessionToken}`,
  };

  // Test 1: Health & Status
  {
    const req = createMockReq({
      url: '/api/status',
      method: 'GET',
      headers: { ...authHeaders, 'x-workspace-id': 'test-workspace' },
    });
    const res = createMockRes();
    const handled = await handleApiRequest(req, res);
    assert.strictEqual(handled, true);
    const result = res.response;
    assert.strictEqual(result.statusCode, 200);
    assert.strictEqual(result.body.workspaceId, 'test-workspace');
    console.log('✓ Test 1 Passed: /api/status reports connected status and workspace isolation');
  }

  // Test 2: Workspace Partitioning & Expense Insertion
  const testExpense = {
    id: `test-exp-${Date.now()}`,
    date: '2026-11-16',
    amount: 4500,
    category: 'Hardware & Electronics',
    nature: 'CapEx',
    description: 'Thermal Printer Roll Feed Mechanism',
    paymentMode: 'UPI',
    notes: 'Kottayam Workshop Prototype',
  };

  {
    const req = createMockReq({
      url: '/api/expenses',
      method: 'POST',
      headers: { ...authHeaders, 'x-workspace-id': 'test-workspace' },
      body: testExpense,
    });
    const res = createMockRes();
    await handleApiRequest(req, res);
    const result = res.response;
    assert.strictEqual(result.statusCode, 201);
    assert.strictEqual(result.body.success, true);
    assert.strictEqual(result.body.expense.id, testExpense.id);
    console.log('✓ Test 2 Passed: /api/expenses persists expense with workspace');
  }

  // Test 3: Expense Isolation between Workspaces
  {
    // Retrieve in test-workspace
    const req1 = createMockReq({ url: '/api/expenses', method: 'GET', headers: { ...authHeaders, 'x-workspace-id': 'test-workspace' } });
    const res1 = createMockRes();
    await handleApiRequest(req1, res1);
    const list1 = res1.response.body.expenses;
    const found = list1.find((e) => e.id === testExpense.id);
    assert.ok(found, 'Expense should exist in test-workspace');

    // Retrieve in separate workspace
    const req2 = createMockReq({ url: '/api/expenses', method: 'GET', headers: { ...authHeaders, 'x-workspace-id': 'different-workspace' } });
    const res2 = createMockRes();
    await handleApiRequest(req2, res2);
    const list2 = res2.response.body.expenses;
    const notFound = list2.find((e) => e.id === testExpense.id);
    assert.strictEqual(notFound, undefined, 'Expense MUST NOT leak into a different workspace');
    console.log('✓ Test 3 Passed: Workspaces are strictly partitioned and isolated');
  }

  // Test 4: Idempotent Updates / Edits
  {
    const updated = { ...testExpense, amount: 5200, notes: 'Updated price after invoice' };
    const req = createMockReq({
      url: '/api/expenses',
      method: 'POST',
      headers: { ...authHeaders, 'x-workspace-id': 'test-workspace' },
      body: updated,
    });
    const res = createMockRes();
    await handleApiRequest(req, res);
    assert.strictEqual(res.response.statusCode, 201);

    const checkReq = createMockReq({ url: '/api/expenses', method: 'GET', headers: { ...authHeaders, 'x-workspace-id': 'test-workspace' } });
    const checkRes = createMockRes();
    await handleApiRequest(checkReq, checkRes);
    const list = checkRes.response.body.expenses;
    const item = list.find((e) => e.id === testExpense.id);
    assert.strictEqual(item.amount, 5200);
    // Ensure no duplicate rows were created for the same id
    const count = list.filter((e) => e.id === testExpense.id).length;
    assert.strictEqual(count, 1);
    console.log('✓ Test 4 Passed: Edits and upserts are strictly idempotent with no duplicates');
  }

  // Test 5: Receipt Storage & Retrieval
  {
    const req = createMockReq({
      url: `/api/receipts/${testExpense.id}`,
      method: 'POST',
      headers: { ...authHeaders, 'x-workspace-id': 'test-workspace' },
      body: {
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        name: 'thermal-receipt.png',
        size: 70,
        mimeType: 'image/png',
      },
    });
    const res = createMockRes();
    await handleApiRequest(req, res);
    assert.strictEqual(res.response.statusCode, 200);

    const getReq = createMockReq({
      url: `/api/receipts/${testExpense.id}`,
      method: 'GET',
      headers: { ...authHeaders, 'x-workspace-id': 'test-workspace' },
    });
    const getRes = createMockRes();
    await handleApiRequest(getReq, getRes);
    assert.strictEqual(getRes.response.statusCode, 200);
    assert.strictEqual(getRes.response.body.receipt.name, 'thermal-receipt.png');
    console.log('✓ Test 5 Passed: Receipts are stored and retrievable cross-device via API');
  }

  // Test 6: Clean Deletion
  {
    const req = createMockReq({
      url: `/api/expenses/${testExpense.id}`,
      method: 'DELETE',
      headers: { ...authHeaders, 'x-workspace-id': 'test-workspace' },
    });
    const res = createMockRes();
    await handleApiRequest(req, res);
    assert.strictEqual(res.response.statusCode, 200);

    const checkReq = createMockReq({ url: '/api/expenses', method: 'GET', headers: { ...authHeaders, 'x-workspace-id': 'test-workspace' } });
    const checkRes = createMockRes();
    await handleApiRequest(checkReq, checkRes);
    const item = checkRes.response.body.expenses.find((e) => e.id === testExpense.id);
    assert.strictEqual(item, undefined);
    console.log('✓ Test 6 Passed: Deletion removes record from shared database cleanly');
  }

  console.log('\nALL 6 SYNC & WORKSPACE API TESTS PASSED! 🎉');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
