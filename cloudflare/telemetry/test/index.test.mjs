import assert from 'node:assert/strict';
import test from 'node:test';
import { database } from '../src/index.js';

test('collector usa o binding D1 configurado no painel e aceita DB legado', () => {
  const current = { prepare() {} };
  const legacy = { prepare() {} };
  assert.equal(database({ pdvnexus: current }), current);
  assert.equal(database({ DB: legacy }), legacy);
  assert.throws(() => database({}), /D1/i);
});
