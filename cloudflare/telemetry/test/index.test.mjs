import assert from 'node:assert/strict';
import test from 'node:test';
import { database } from '../src/index.js';

test('collector usa o binding DB ligado ao D1 pdvnexus compartilhado', () => {
  const shared = { prepare() {} };
  assert.equal(database({ DB: shared }), shared);
  assert.throws(() => database({}), /D1 dedicado|D1/i);
});
