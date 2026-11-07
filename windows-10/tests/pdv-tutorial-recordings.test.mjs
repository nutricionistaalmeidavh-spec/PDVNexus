import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const qa = path.resolve('qa');
const manifest = JSON.parse(fs.readFileSync(path.join(qa, 'artisys-qa.tutorials.config.json'), 'utf8'));
const required = [
  'produto-primeira-venda',
  'abrir-fechar-caixa',
  'cliente-cadastro',
  'consulta-ajuste-estoque',
  'historico-vendas',
  'relatorios-negocio',
];

test('seis tutoriais usam ações reais do aplicativo e não sequências de imagens', () => {
  assert.equal(manifest.mode, 'electron');
  assert.equal(manifest.capture.video, true);
  assert.deepEqual(Object.keys(manifest.demos).sort(), required.sort());
  for (const name of required) {
    const definition = manifest.demos[name];
    const data = JSON.parse(fs.readFileSync(path.join(qa, definition.file), 'utf8'));
    const actions = data.steps.map(x => x.action);
    assert.ok(actions.includes('click') || actions.includes('clickIfVisible'), name);
    assert.ok(actions.includes('expectVisible') || actions.includes('expectDesktopStoreJson'), name);
    if (!['historico-vendas', 'relatorios-negocio'].includes(name)) {
      assert.ok(actions.includes('fill') || actions.includes('press') || actions.includes('selectOption'), name);
    }
    assert.ok(!actions.every(action => ['screenshot', 'waitFor', 'waitForTimeout'].includes(action)), name);
    assert.ok(definition.durationTargetSec >= 25, name);
  }
});

test('os tutoriais críticos validam transações, persistência ou fechamento', () => {
  const read = name => JSON.parse(fs.readFileSync(path.join(qa, manifest.demos[name].file), 'utf8'));
  assert.ok(read('produto-primeira-venda').steps.some(x => x.name === 'finalizar-venda-tutorial'));
  assert.ok(read('abrir-fechar-caixa').steps.some(x => x.name === 'fechamento-conferido'));
  assert.ok(read('cliente-cadastro').steps.some(x => x.name === 'cliente-persistido'));
  assert.ok(read('consulta-ajuste-estoque').steps.some(x => x.name === 'estoque-entrada'));
});
