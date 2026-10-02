import assert from 'node:assert/strict';import test from 'node:test';
import {normalizeLicenseEmail,normalizeLicenseCode,generateLicenseCode} from '../src/licensing.js';
test('normaliza credenciais de licença',()=>{assert.equal(normalizeLicenseEmail(' Cliente@Example.COM '),'cliente@example.com');assert.equal(normalizeLicenseCode(' nx-ab12-cd34 '),'NX-AB12-CD34');assert.throws(()=>normalizeLicenseEmail('x'),/E-mail/i);});
test('gera código sem caracteres ambíguos',()=>{const code=generateLicenseCode();assert.match(code,/^NX-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);assert.doesNotMatch(code,/[01IO]/);});
