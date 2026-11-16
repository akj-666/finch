import assert from 'node:assert';
import { handleApiRequest } from './server/apiHandler.mjs';

function createMockReq({ url = '/api/auth/status', method = 'GET', headers = {}, body = null } = {}) {
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

async function runAuthTests() {
  console.log('=== STARTING STRICT MASTER PASSWORD SECURITY VERIFICATION ===\n');

  // 1. Initial status check
  {
    const req = createMockReq({ url: '/api/auth/status', method: 'GET' });
    const res = createMockRes();
    await handleApiRequest(req, res);
    assert.strictEqual(res.response.statusCode, 200);
    console.log(`✓ Test 1: /api/auth/status returns public status (isPasswordSet: ${res.response.body.isPasswordSet})`);
  }

  // 2. Set master password (first time setup)
  const masterPassword = 'KottayamSuperSecret@2026';
  let sessionToken = null;

  {
    const req = createMockReq({
      url: '/api/auth/setup',
      method: 'POST',
      body: { password: masterPassword },
    });
    const res = createMockRes();
    await handleApiRequest(req, res);

    if (res.response.statusCode === 201) {
      sessionToken = res.response.body.token;
      assert.ok(sessionToken, 'Setup must return an active session token');
      console.log('✓ Test 2: First-time setup successfully saved permanent master password hash');
    } else if (res.response.statusCode === 403) {
      console.log('✓ Test 2: Master password was already permanently set (locked)');
    }
  }

  // 3. Second setup call MUST BE FORBIDDEN (One-Time Permanent Lock)
  {
    const req = createMockReq({
      url: '/api/auth/setup',
      method: 'POST',
      body: { password: 'HackerTryingToChangePassword123' },
    });
    const res = createMockRes();
    await handleApiRequest(req, res);
    assert.strictEqual(res.response.statusCode, 403, 'Subsequent setup calls MUST return 403 Forbidden');
    assert.ok(res.response.body.error.includes('permanent'), 'Error message must specify password is permanent');
    console.log('✓ Test 3: One-time setup is permanently locked and cannot be re-run or overwritten');
  }

  // 4. Unauthenticated access to /api/expenses MUST BE BLOCKED
  {
    const req = createMockReq({ url: '/api/expenses', method: 'GET' });
    const res = createMockRes();
    await handleApiRequest(req, res);
    assert.strictEqual(res.response.statusCode, 401, 'Unauthenticated request must return 401 Unauthorized');
    assert.strictEqual(res.response.body.locked, true);
    console.log('✓ Test 4: Unauthenticated access to expense ledger is strictly blocked (HTTP 401)');
  }

  // 5. Wrong password login attempt
  {
    const req = createMockReq({
      url: '/api/auth/login',
      method: 'POST',
      body: { password: 'WrongPasswordXYZ' },
    });
    const res = createMockRes();
    await handleApiRequest(req, res);
    assert.strictEqual(res.response.statusCode, 401, 'Incorrect password must be rejected');
    assert.ok(res.response.body.error.includes('Incorrect'), 'Error must specify incorrect password');
    console.log('✓ Test 5: Incorrect password login is rejected');
  }

  // 6. Valid password login returns session token
  {
    const req = createMockReq({
      url: '/api/auth/login',
      method: 'POST',
      body: { password: masterPassword },
    });
    const res = createMockRes();
    await handleApiRequest(req, res);
    assert.strictEqual(res.response.statusCode, 200, 'Correct password must return 200 OK');
    sessionToken = res.response.body.token;
    assert.ok(sessionToken, 'Login must yield a valid session token');
    console.log('✓ Test 6: Valid master password successfully generates authenticated session token');
  }

  // 7. Authenticated access to /api/expenses with Bearer token SUCCEEDS
  {
    const req = createMockReq({
      url: '/api/expenses',
      method: 'GET',
      headers: { authorization: `Bearer ${sessionToken}` },
    });
    const res = createMockRes();
    await handleApiRequest(req, res);
    assert.strictEqual(res.response.statusCode, 200, 'Authenticated request must succeed with 200 OK');
    assert.ok(Array.isArray(res.response.body.expenses), 'Response must contain expenses array');
    console.log('✓ Test 7: Authenticated request with session token retrieves expense ledger');
  }

  // 8. Logout revokes session token
  {
    const req = createMockReq({
      url: '/api/auth/logout',
      method: 'POST',
      headers: { authorization: `Bearer ${sessionToken}` },
    });
    const res = createMockRes();
    await handleApiRequest(req, res);
    assert.strictEqual(res.response.statusCode, 200);

    // Request with the revoked token must now FAIL
    const checkReq = createMockReq({
      url: '/api/expenses',
      method: 'GET',
      headers: { authorization: `Bearer ${sessionToken}` },
    });
    const checkRes = createMockRes();
    await handleApiRequest(checkReq, checkRes);
    assert.strictEqual(checkRes.response.statusCode, 401, 'Revoked token must be rejected');
    console.log('✓ Test 8: Logout revokes session; subsequent requests with revoked token are blocked');
  }

  console.log('\nALL 8 STRICT PASSWORD & SECURITY TESTS PASSED! 🔒🎉');
}

runAuthTests().catch((err) => {
  console.error('Auth test failed:', err);
  process.exit(1);
});
