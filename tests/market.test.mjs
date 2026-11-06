import assert from 'node:assert/strict';
import test from 'node:test';
import { allocateMarket } from '../dist/esm/index.js';

test('allocates higher-priority requests before lower-priority tiers', () => {
  const result = allocateMarket(7, [
    { id: 'low', demand: 9, priority: 1 },
    { id: 'high-a', demand: 3, priority: 5 },
    { id: 'high-b', demand: 3, priority: 5 },
  ]);
  assert.deepEqual(
    result.requests.map(({ id, allocated, reasons }) => [id, allocated, reasons]),
    [
      ['low', 1, ['capacity']],
      ['high-a', 3, []],
      ['high-b', 3, []],
    ],
  );
  assert.equal(result.allocated, 7);
});

test('uses exact largest-remainder quotas for equal-priority demand', () => {
  const result = allocateMarket(5, [
    { id: 'a', demand: 3, priority: 0 },
    { id: 'b', demand: 3, priority: 0 },
    { id: 'c', demand: 3, priority: 0 },
  ]);
  assert.deepEqual(
    result.requests.map(({ allocated }) => allocated),
    [2, 2, 1],
  );
  assert.equal(
    result.requests.reduce((sum, item) => sum + item.allocated, 0),
    5,
  );
});

test('caps individual quota, redistributes tier capacity and explains unmet demand', () => {
  const result = allocateMarket(8, [
    { id: 'capped', demand: 10, priority: 3, quota: 2 },
    { id: 'open', demand: 10, priority: 3 },
  ]);
  assert.deepEqual(
    result.requests.map(({ allocated, unfilled, reasons }) => [allocated, unfilled, reasons]),
    [
      [1, 9, ['quota', 'capacity']],
      [7, 3, ['capacity']],
    ],
  );
  assert.equal(result.unusedCapacity, 0);
});

test('leaves capacity unused when requests are fulfilled or quota-capped', () => {
  const result = allocateMarket(20, [{ id: 'only', demand: 4, priority: 1, quota: 3 }]);
  assert.deepEqual([result.allocated, result.unusedCapacity], [3, 17]);
  assert.deepEqual(result.requests[0].reasons, ['quota']);
});

test('preserves exact safe integer counts up to configured cap', () => {
  const capacity = 1_000_000_000;
  const result = allocateMarket(capacity, [
    { id: 'large', demand: capacity, priority: 0 },
    { id: 'zero', demand: 0, priority: 0 },
  ]);
  assert.equal(result.requests[0].allocated, capacity);
  assert.equal(result.requests[1].allocated, 0);
});

test('rejects invalid counts, duplicate IDs, unsafe aggregate demand and malformed records', () => {
  assert.throws(() => allocateMarket(-1, []), /capacity/);
  assert.throws(() => allocateMarket(1, [{ id: 'x', demand: 1, priority: 0.5 }]), /priority/);
  assert.throws(
    () =>
      allocateMarket(1, [
        { id: 'x', demand: 1, priority: 0 },
        { id: 'x', demand: 1, priority: 0 },
      ]),
    /Duplicate request ID/,
  );
  assert.throws(
    () =>
      allocateMarket(1, [
        { id: 'a', demand: 600_000_000, priority: 0 },
        { id: 'b', demand: 600_000_000, priority: 0 },
      ]),
    /Combined demand/,
  );
  assert.throws(
    () => allocateMarket(1, [{ id: 'x', demand: 1, priority: 0, extra: true }]),
    /unsupported/,
  );
});
