import test from "node:test";import assert from "node:assert/strict";
import {bootstrapPdvFirstManager,authenticatePdvOperator,canReadPdvFinance} from "../apps/pdv-demo/src/financeAuthorization";
const cashier={id:"OP",name:"Caixa",role:"cashier" as const,active:true};
const manager={id:"GER",name:"Gerente",role:"manager" as const,active:true};
test("P5 operador não vira gerente por escolher nome; sessão exige PIN",()=>{
 const users=[cashier,{...manager,managerPassword:"nuncaCompartilhar"}];
 assert.equal(canReadPdvFinance(users[1],"OP"),false);
 assert.equal(canReadPdvFinance(users[1],null),false);
 assert.equal(canReadPdvFinance(users[0],"GER"),false);
 assert.throws(()=>authenticatePdvOperator(users,"GER","errado"),/PIN|Senha/);
 const checked=authenticatePdvOperator(users,"GER","nuncaCompartilhar");
 assert.equal(canReadPdvFinance(checked.user,checked.sessionManagerId),true);
 assert.equal(authenticatePdvOperator(users,"OP","").sessionManagerId,null);
});
test("P5 primeiro gerente exige PIN não padronizado e só configura uma vez",()=>{
 assert.throws(()=>bootstrapPdvFirstManager([cashier,manager],"123"),/6 caracteres/i);
 const result=bootstrapPdvFirstManager([cashier,manager],"segredoUnico");
 assert.equal(result.user.managerPassword,"segredoUnico");
 assert.equal(canReadPdvFinance(result.user,null),false);
 assert.throws(()=>bootstrapPdvFirstManager(result.users,"outraSenha"),/Já existe gerente/i);
 assert.equal(manager.managerPassword,undefined);
});
