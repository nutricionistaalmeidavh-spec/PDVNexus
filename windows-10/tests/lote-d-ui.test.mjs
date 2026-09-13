import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const theme = fs.readFileSync(new URL('../apps/pdv-demo/src/lote-d-theme.css', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../apps/pdv-demo/src/main.tsx', import.meta.url), 'utf8');

test('Lote D PDV theme uses the approved commercial green identity', () => {
  assert.match(theme, /--pdv-primary:#166534/i);
  assert.match(theme, /--pdv-action:#22c55e/i);
  assert.match(theme, /--pdv-ink:#18181b/i);
  assert.match(theme, /--pdv-cream:#fafaf5/i);
  assert.match(main, /lote-d-theme\.css/);
});
