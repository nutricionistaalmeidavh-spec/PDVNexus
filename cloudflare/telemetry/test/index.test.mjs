import assert from 'node:assert/strict';
import test from 'node:test';
import { database } from '../src/index.js';

test('collector aceita somente o binding D1 dedicado DB', () => {
  const dedicated = { prepare() {} };
  const operational = { prepare() {} };
  assert.equal(database({ DB: dedicated }), dedicated);
  assert.throws(() => database({ pdvnexus: operational }), /D1 dedicado/i);
  assert.throws(() => database({}), /D1 dedicado/i);
});
