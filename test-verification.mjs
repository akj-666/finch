import { formatINR, formatINRCompact, formatDate, formatTimeline } from './src/utils/formatters.ts';
import { validateExpense, parseAndValidateImportJSON } from './src/utils/storage.ts';
import { INITIAL_EXPENSES } from './src/utils/seedData.ts';
import { EXPENSE_CATEGORIES, PAYMENT_MODES } from './src/types.ts';
import assert from 'assert';

console.log('=== RUNNING FINCH EXPENSE TRACKER VERIFICATION ===\n');

// 1. Currency Formatter Checks
console.log('1. Testing Currency & Date Formatters...');
assert.strictEqual(formatINR(125000), '₹1,25,000.00');
assert.strictEqual(formatINR(48500), '₹48,500.00');
assert.strictEqual(formatINR(0), '₹0.00');
assert.strictEqual(formatINR(99.5), '₹99.50');
console.log('  ✓ formatINR formats numbers in Indian numbering system: ₹1,25,000.00');

assert.strictEqual(formatINRCompact(125000), '₹1.25L');
assert.strictEqual(formatINRCompact(48500), '₹48.5K');
assert.strictEqual(formatINRCompact(10000000), '₹1Cr');
console.log('  ✓ formatINRCompact handles Lakhs, Crores, and Thousands');

assert.strictEqual(formatDate('2026-11-15'), '15 Nov 2026');
assert.strictEqual(formatTimeline('2026-11-01', '2026-11-30'), '01 Nov 2026 – 30 Nov 2026');
assert.strictEqual(formatTimeline('', ''), 'All Time');
console.log('  ✓ Date and Timeline formatters pass');

// 2. Seed Data Checks
console.log('\n2. Testing Seed Data Integrity...');
assert(INITIAL_EXPENSES.length >= 10, 'Should have rich sample data');
let totalSeedSpend = 0;
let capexSeed = 0;
let opexSeed = 0;

INITIAL_EXPENSES.forEach((exp, index) => {
  const res = validateExpense(exp);
  assert(res.isValid, `Seed expense ${index} (${exp.description}) must be valid: ${res.reason}`);
  assert(exp.amount > 0, 'Amount must be positive');
  assert(EXPENSE_CATEGORIES.includes(exp.category), `Invalid category ${exp.category}`);
  assert(exp.nature === 'CapEx' || exp.nature === 'OpEx', `Invalid nature ${exp.nature}`);
  assert(PAYMENT_MODES.includes(exp.paymentMode), `Invalid payment mode ${exp.paymentMode}`);
  totalSeedSpend += exp.amount;
  if (exp.nature === 'CapEx') capexSeed += exp.amount;
  else opexSeed += exp.amount;
});
console.log(`  ✓ ${INITIAL_EXPENSES.length} seed items validated.`);
console.log(`  ✓ Total Seed Spend: ${formatINR(totalSeedSpend)} (CapEx: ${formatINR(capexSeed)}, OpEx: ${formatINR(opexSeed)})`);

// 3. Validation Logic
console.log('\n3. Testing Expense Validation and Error Handling...');
// Missing description
assert.strictEqual(validateExpense({ amount: 100, date: '2026-11-15', category: 'Hardware & Electronics', nature: 'CapEx', paymentMode: 'UPI' }).isValid, false);
// Negative amount
assert.strictEqual(validateExpense({ description: 'Test', amount: -50, date: '2026-11-15', category: 'Hardware & Electronics', nature: 'CapEx', paymentMode: 'UPI' }).isValid, false);
// Zero amount
assert.strictEqual(validateExpense({ description: 'Test', amount: 0, date: '2026-11-15', category: 'Hardware & Electronics', nature: 'CapEx', paymentMode: 'UPI' }).isValid, false);
// Invalid category
assert.strictEqual(validateExpense({ description: 'Test', amount: 50, date: '2026-11-15', category: 'Random Invalid', nature: 'CapEx', paymentMode: 'UPI' }).isValid, false);
// Invalid nature
assert.strictEqual(validateExpense({ description: 'Test', amount: 50, date: '2026-11-15', category: 'Hardware & Electronics', nature: 'NonExistent', paymentMode: 'UPI' }).isValid, false);
// Valid item
const validCheck = validateExpense({ description: 'Paper ream', amount: 250, date: '2026-11-15', category: 'Consumables & Refills', nature: 'OpEx', paymentMode: 'Cash' });
assert.strictEqual(validCheck.isValid, true);
assert.strictEqual(validCheck.expense?.amount, 250);
console.log('  ✓ Strict field validation correctly rejects invalid and accepts valid items');

// 4. JSON Import/Export Parsing
console.log('\n4. Testing JSON Import Parsing & Recovery...');
const validFinchExport = JSON.stringify({
  appName: 'finch Expense Tracker',
  expenses: INITIAL_EXPENSES.slice(0, 3)
});
const importResult = parseAndValidateImportJSON(validFinchExport);
assert.strictEqual(importResult.success, true);
assert.strictEqual(importResult.expenses?.length, 3);

// Backwards-compatibility test with legacy Etchr backups
const legacyEtchrExport = JSON.stringify({
  appName: 'Etchr Expense Tracker',
  expenses: INITIAL_EXPENSES.slice(0, 2)
});
const legacyResult = parseAndValidateImportJSON(legacyEtchrExport);
assert.strictEqual(legacyResult.success, true);
assert.strictEqual(legacyResult.expenses?.length, 2);

// Corrupted JSON
const corruptResult = parseAndValidateImportJSON('{ broken json ...');
assert.strictEqual(corruptResult.success, false);
assert(corruptResult.error?.includes('JSON parse error'), 'Should report syntax error');

// JSON with bad records
const mixedJson = JSON.stringify([
  { description: 'Good record', amount: 500, date: '2026-11-10', category: 'Consumables & Refills', nature: 'OpEx', paymentMode: 'UPI' },
  { description: 'Bad amount', amount: -99, date: '2026-11-10', category: 'Consumables & Refills', nature: 'OpEx', paymentMode: 'UPI' }
]);
const mixedResult = parseAndValidateImportJSON(mixedJson);
assert.strictEqual(mixedResult.success, true);
assert.strictEqual(mixedResult.expenses?.length, 1);
assert(mixedResult.summary?.includes('skipped'), 'Should report skipped bad records without discarding good records');
console.log('  ✓ Import parser reliably validates, reports errors, and recovers valid items');

console.log('\nALL UNIT AND INTEGRATION CHECKS PASSED SUCCESSFULLY! ✅');
