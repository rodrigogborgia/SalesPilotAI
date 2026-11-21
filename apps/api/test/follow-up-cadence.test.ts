import assert from 'node:assert/strict';
import test from 'node:test';

import { rebaseCadenceDates, shiftCadenceDate } from '../src/modules/follow-ups/cadence';

test('rescheduling a cadence step shifts its due date by the selected delta', () => {
  const dueAt = new Date('2026-03-10T15:00:00.000Z');

  assert.equal(
    shiftCadenceDate(dueAt, 3 * 24 * 60 * 60 * 1000).toISOString(),
    '2026-03-13T15:00:00.000Z'
  );
});

test('completing a cadence step rebases only upcoming offsets from the actual completion date', () => {
  const completedAt = new Date('2026-03-15T10:30:00.000Z');
  const rebased = rebaseCadenceDates(completedAt, 7, [
    { id: 'next', dueAt: new Date('2026-03-20T10:30:00.000Z'), cadenceOffsetDays: 14 },
    { id: 'last', dueAt: new Date('2026-04-04T10:30:00.000Z'), cadenceOffsetDays: 30 }
  ]);

  assert.deepEqual(rebased.map(({ id, newDueAt }) => [id, newDueAt.toISOString()]), [
    ['next', '2026-03-22T10:30:00.000Z'],
    ['last', '2026-04-07T10:30:00.000Z']
  ]);
});
