import assert from 'node:assert';
import { reconcileExpenses } from './src/utils/apiSync.ts';

console.log('=== RUNNING CLIENT RECONCILIATION & MERGE TESTS ===\n');

// 1. Local expense not on remote -> must be kept and flagged for push
const localOnly = [
  {
    id: 'exp-local-1',
    date: '2026-11-15',
    amount: 1500,
    category: 'Consumables & Refills',
    nature: 'OpEx',
    description: 'A4 Thermal Paper 80mm (entered on phone offline)',
    paymentMode: 'Cash',
    createdAt: '2026-11-15T10:00:00.000Z',
    updatedAt: '2026-11-15T10:00:00.000Z',
  },
];

const remoteOnly = [
  {
    id: 'exp-remote-1',
    date: '2026-11-14',
    amount: 12000,
    category: 'Hardware & Electronics',
    nature: 'CapEx',
    description: 'Laser Scanner Module (entered on laptop)',
    paymentMode: 'UPI',
    createdAt: '2026-11-14T12:00:00.000Z',
    updatedAt: '2026-11-14T12:00:00.000Z',
  },
];

const result1 = reconcileExpenses(localOnly, remoteOnly);
assert.strictEqual(result1.merged.length, 2, 'Merged list should contain both records');
assert.strictEqual(result1.needsPush.length, 1, 'Local offline record must be pushed to remote');
assert.strictEqual(result1.needsPush[0].id, 'exp-local-1');
console.log('✓ Test 1: Offline phone expenses are preserved and scheduled for upload');

// 2. Both have same ID, but local was edited with newer timestamp
const olderRemote = [
  {
    id: 'exp-common-1',
    date: '2026-11-10',
    amount: 500,
    category: 'Logistics, Transport & Travel',
    nature: 'OpEx',
    description: 'Auto Rickshaw to Kiosk Site',
    paymentMode: 'Cash',
    createdAt: '2026-11-10T08:00:00.000Z',
    updatedAt: '2026-11-10T08:00:00.000Z',
  },
];

const newerLocal = [
  {
    id: 'exp-common-1',
    date: '2026-11-10',
    amount: 650, // edited on phone
    category: 'Logistics, Transport & Travel',
    nature: 'OpEx',
    description: 'Auto Rickshaw to Kiosk Site + Return Trip',
    paymentMode: 'UPI',
    createdAt: '2026-11-10T08:00:00.000Z',
    updatedAt: '2026-11-10T14:30:00.000Z', // later timestamp
  },
];

const result2 = reconcileExpenses(newerLocal, olderRemote);
assert.strictEqual(result2.merged.length, 1);
assert.strictEqual(result2.merged[0].amount, 650, 'Newer edit must take precedence');
assert.strictEqual(result2.needsPush.length, 1, 'Newer local edit must be scheduled to push to remote');
console.log('✓ Test 2: Timestamp-based conflict resolution takes latest edit with zero data loss');

// 3. No duplicates on repeated runs
const result3 = reconcileExpenses(result2.merged, result2.merged);
assert.strictEqual(result3.merged.length, 1);
assert.strictEqual(result3.needsPush.length, 0);
console.log('✓ Test 3: Idempotent merge produces zero duplicate records');

// 4. Deleted expense on remote is tombstoned and never resurrected into merged
const deletedRemoteId = 'exp-deleted-on-phone';
const remoteWithDeleted = [
  {
    id: deletedRemoteId,
    date: '2026-11-12',
    amount: 300,
    category: 'Consumables & Refills',
    nature: 'OpEx',
    description: 'Deleted record test',
    paymentMode: 'Cash',
    createdAt: '2026-11-12T10:00:00.000Z',
    updatedAt: '2026-11-12T10:00:00.000Z',
  },
];
const result4 = reconcileExpenses([], remoteWithDeleted, { [deletedRemoteId]: '2026-11-12T12:00:00.000Z' });
assert.strictEqual(result4.merged.length, 0, 'Tombstoned record must NOT appear in merged results');
assert.strictEqual(result4.needsRemoteDelete.includes(deletedRemoteId), true, 'Tombstoned record must be scheduled for remote delete');
console.log('✓ Test 4: Deletion tombstones prevent deleted items from reappearing from remote');

// 5. Deleted expense on local device is never re-uploaded to remote
const localWithDeleted = [
  {
    id: 'exp-deleted-locally',
    date: '2026-11-11',
    amount: 1000,
    category: 'Hardware & Electronics',
    nature: 'CapEx',
    description: 'Deleted locally',
    paymentMode: 'UPI',
    createdAt: '2026-11-11T10:00:00.000Z',
    updatedAt: '2026-11-11T10:00:00.000Z',
  },
];
const result5 = reconcileExpenses(localWithDeleted, [], { 'exp-deleted-locally': '2026-11-11T11:00:00.000Z' });
assert.strictEqual(result5.merged.length, 0, 'Locally deleted record must NOT appear in merged results');
assert.strictEqual(result5.needsPush.length, 0, 'Locally deleted record must NOT be scheduled to re-upload');
console.log('✓ Test 5: Locally deleted items are never re-uploaded on refresh or sync');

console.log('\nALL CLIENT SYNC TESTS PASSED! 🎉');
