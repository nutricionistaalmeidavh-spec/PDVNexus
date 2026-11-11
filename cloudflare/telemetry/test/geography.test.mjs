import assert from 'node:assert/strict';
import test from 'node:test';
import { geographicArea, recordGeographicObservation, geographicSummary } from '../src/geography.js';
import { geographyDashboard } from '../src/geography-dashboard.js';
import { handleRequest } from '../src/index.js';

test('usa exclusivamente request.cf e rejeita cabecalhos adulterados', () => {
  const req = new Request('https://example.com/v1/events',{headers:{'CF-IPCountry':'US','X-City':'Fake'}});
  Object.defineProperty(req,'cf',{value:{country:'BR',regionCode:'SP',city:'  Ribeirão Preto  '}});
  assert.deepEqual(geographicArea(req),{country:'BR',region_code:'SP',city:'Ribeirão Preto'});
  assert.equal(geographicArea(new Request('https://example.com')),null);
});

test('rejeita metadados invalidos e nao armazena endereco detalhado', () => {
  assert.deepEqual(geographicArea({cf:{country:'BR',regionCode:'SP',city:'Rua <script> endereço 148'}}),{country:'BR',region_code:'SP',city:'Desconhecida'});
  assert.equal(geographicArea({cf:{country:'x',regionCode:'SP',city:'A'}}),null);
});

test('agrega um evento sem identificar a instalacao',async()=>{
  const writes=[];
  const db={prepare(sql){return {values:[],bind(...values){this.values=values;return this},async run(){writes.push({sql,values:this.values})}}}};
  await recordGeographicObservation(db,{country:'BR',region_code:'MG',city:'Uberaba'},'2.0.1','2026-10-12T21:00:00.000Z');
  assert.equal(writes.length,3);
  assert.deepEqual(writes[1].values,['2026-10-12','BR','MG','Uberaba','2.0.1','2026-10-12T21:00:00.000Z']);
  assert.doesNotMatch(JSON.stringify(writes),/installation_id|ip_address|session_id|email/i);
});

test('limita consulta a 30 dias e informa que nao conta usuarios unicos',async()=>{
  const queries=[];
  const db={prepare(sql){return {bind(...args){queries.push({sql,args});return this},async run(){},async first(){return {observations:3,last_seen_at:'2026-10-12T00:00:00Z'}},async all(){return {results:[{country:'BR',region_code:'SP',city:'Ribeirão Preto',app_version:'2.0.1',observations:3,last_seen_at:'2026-10-12T00:00:00Z'}]}}}}};
  const result=await geographicSummary(db,'2026-10-12T22:00:00.000Z',100);
  assert.equal(result.days,30);
  assert.equal(result.observations,3);
  assert.equal(result.cities[0].city,'Ribeirão Preto');
  assert.equal(result.unique_installations_available,false);
  assert.equal(queries.length,4);
});

test('geographic admin API exige token antes de tocar no banco',async()=>{
  const response=await handleRequest(new Request('https://pdv.example/v1/admin/geography?days=30'),{DB:{prepare(){throw new Error('acesso indevido')}}});
  assert.equal(response.status,401);
});

test('painel usa token apenas em memoria e nunca insere HTML dos resultados',()=>{
  const html=geographyDashboard('secure-nonce');
  assert.match(html,/nonce="secure-nonce"/);
  assert.match(html,/Authorization:'Bearer '/);
  assert.match(html,/textContent=String\(row\[key\]/);
  assert.doesNotMatch(html,/localStorage|sessionStorage|<script src=|https:\/\//);
});
