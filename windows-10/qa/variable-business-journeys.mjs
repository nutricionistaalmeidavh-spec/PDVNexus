// Jornadas E2E compostas, com ordens e quantidades reproduziveis por seed.
// A mesma instancia Electron/SQLite executa varias operacoes; nao ha reset entre etapas.
const KEY="nexus-core:pdv-store:v1";
const scan='input[placeholder*="Bipe"]';
const itemByCode={
  keyboard:{code:"00101",barcode:"7895555441971",index:2,stock:8,price:100,payment:"cash"},
  mouse:{code:"00102",barcode:"7894123412341",index:3,stock:14,price:49.9,payment:"pix"}
};
const s=(action,fields={})=>({action,...fields});
const store=(path,expected,name)=>s("expectDesktopStoreJson",{key:KEY,path,expected,name});
const click=(selector,name)=>s("click",{selector,name});
const fill=(selector,value,name)=>s("fill",{selector,value:String(value),name});
const press=(key,name)=>s("press",{selector:scan,key,name,holdMs:key==="F8"?650:175});
const wait=(name)=>s("waitForTimeout",{timeoutMs:400,name});
const currency=(n)=>"R$ "+n.toFixed(2).replace(".",",");
function checkpoint(steps,tag,model,{report=true}={}){
  // Dados verificados antes E depois da recarga, sem mutacoes ocultas de fixtures.
  function checks(marker){
    steps.push(store("catalogProducts."+model.product.index+".stock",model.stock,marker+"-estoque"));
    steps.push(store("completedSales.length",model.sales,marker+"-vendas"));
    steps.push(store("extensions.cancelledSales.length",model.cancelled,marker+"-cancelamentos"));
    steps.push(store("cashSession.initialAmount",150,marker+"-caixa"));
  }
  steps.push(wait(tag+"-persistir"));
  checks(tag);
  steps.push(s("reload",{name:tag+"-recarregar"}));
  steps.push(s("waitFor",{selector:'a[href="#/caixa"]',timeoutMs:20000,name:tag+"-inicializado"}));
  checks(tag+"-apos-reload");
  if(report){
    steps.push(click('a[href="#/financeiro"]',tag+"-abrir-relatorio"));
    steps.push(s("expectVisible",{text:"Relatórios e dashboard",exact:true,name:tag+"-dashboard"}));
    // Os valores apresentados devem coincidir com o estado canonico do SQLite.
    steps.push(s("expectText",{
      selector:'article:has(h2:text-is("Relatórios e dashboard")) div:has(> span:text-is("Vendas")) > strong',
      expected:String(model.sales),name:tag+"-relatorio-vendas"
    }));
    steps.push(s("expectText",{
      selector:'article:has(h2:text-is("Relatórios e dashboard")) div:has(> span:text-is("Total vendido")) > strong',
      expected:currency(model.total),name:tag+"-relatorio-total"
    }));
    steps.push(s("screenshot",{name:tag+"-evidencia"}));
  }
}
function openCash(steps){
  steps.push(click('a[href="#/financeiro"]',"abrir-financeiro"));
  steps.push(fill('input[placeholder="Caixa inicial"]',150,"troco-inicial"));
  steps.push(s("click",{text:"Abrir Caixa",exact:true,name:"abrir-caixa"}));
  steps.push(s("expectVisible",{text:"Status: ABERTO",exact:true,name:"caixa-aberto"}));
}
function stockEntry(steps,model,qty){
  steps.push(click('a[href="#/produtos"]',"abrir-produtos"));
  steps.push(s("click",{selector:'article:has(h2:text-is("Estoque")) button[aria-expanded="false"]',name:"abrir-form-estoque"}));
  steps.push(s("selectOption",{selector:'select:has(option[value="'+model.product.code+'"])',value:model.product.code,name:"selecionar-produto"}));
  steps.push(s("selectOption",{selector:'select:has(option[value="entry"])',value:"entry",name:"selecionar-entrada"}));
  steps.push(fill('input[placeholder="Quantidade"]',qty,"quantidade-entrada"));
  steps.push(fill('input[placeholder="Motivo"]',"Compra QA sequencial "+qty,"motivo-entrada"));
  steps.push(s("click",{text:"Registrar Movimento",exact:true,name:"registrar-entrada"}));
  model.stock+=qty;
  checkpoint(steps,"entrada",model);
}
function sale(steps,model){
  steps.push(click('a[href="#/caixa"]',"abrir-tela-caixa"));
  steps.push(press("F2","nova-venda"));
  steps.push(fill(scan,model.product.barcode,"ler-codigo"));
  steps.push(press("Enter","confirmar-codigo"));
  if(model.product.payment==="pix"){
    steps.push(s("expectVisible",{text:"Pagamento por produto",exact:true,name:"pagamento-visivel"}));
    steps.push(s("click",{text:"PIX",exact:true,name:"selecionar-pix"}));
  }else steps.push(press("F6","pagamento-dinheiro"));
  steps.push(press("F8","finalizar-venda"));
  steps.push(s("expectVisible",{selector:'[role="dialog"][aria-label="Comprovante da venda"]',name:"comprovante"}));
  steps.push(s("click",{text:"Fechar",exact:true,name:"fechar-comprovante"}));
  model.stock-=1;model.sales=1;model.total=model.product.price;
  steps.push(store("completedSales.0.netTotal",model.total,"total-gravado"));
  if(model.product.payment==="pix")steps.push(store("completedSales.0.payments.0.method","PIX","pagamento-gravado"));
  checkpoint(steps,"venda",model);
}
function cancelSale(steps,model){
  steps.push(click('a[href="#/financeiro"]',"abrir-cancelamento"));
  steps.push(s("selectOption",{selector:'select:has(option[value="000001"])',value:"000001",name:"selecionar-venda"}));
  steps.push(fill('input[placeholder="Senha do gerente"]',"123456","autorizacao-gerente"));
  steps.push(fill('input[placeholder="Motivo do cancelamento"]',"QA sequencial","motivo-cancelamento"));
  steps.push(s("click",{text:"Cancelar/Estornar venda",exact:true,name:"confirmar-cancelamento"}));
  model.stock+=1;model.sales=0;model.cancelled=1;model.total=0;
  steps.push(store("extensions.cancelledSales.0.number","000001","cancelada-no-historico"));
  checkpoint(steps,"cancelamento",model);
}
export function planVariableJourneys(seeds=[1101,1102,1103,1104]){
  if(!Array.isArray(seeds)||seeds.length<2||new Set(seeds).size!==seeds.length||seeds.some(x=>!Number.isSafeInteger(x)||x<=0)) throw Error("Seeds positivas e distintas obrigatorias");
  return seeds.map(seed=>{
    const product=(seed&2)?itemByCode.mouse:itemByCode.keyboard;
    const order=seed&1?["entry","sale"]:["sale","entry"];
    const quantity=2+(seed%4);
    const steps=[
      s("waitFor",{selector:'a[href="#/caixa"]',name:"pdv-inicializado",timeoutMs:20000}),
      s("desktopStoreSet",{key:KEY,name:"seed-inicial-unica",value:{extensions:{users:[
        {id:"OP-001",name:"Operador Caixa",role:"cashier",active:true},
        {id:"GER-001",name:"Gerente",role:"manager",active:true,managerPassword:"123456"}
      ],currentOperatorId:"OP-001"}}}),
      s("reload",{name:"carregar-seed-inicial"}),
      s("waitFor",{selector:'a[href="#/caixa"]',name:"pdv-carregado",timeoutMs:20000})
    ];
    const model={product,stock:product.stock,sales:0,cancelled:0,total:0};
    openCash(steps);
    checkpoint(steps,"abertura",model);
    for(const op of order){if(op==="entry")stockEntry(steps,model,quantity);else sale(steps,model);}
    cancelSale(steps,model);
    // Conferencia/fechamento do caixa ocorre apos venda e estorno no MESMO banco.
    steps.push(fill('input[placeholder="Dinheiro contado"]',"150","conferencia-dinheiro"));
    steps.push(fill('input[placeholder="PIX conferido"]',"0","conferencia-pix"));
    steps.push(fill('input[placeholder="Cartões conferidos"]',"0","conferencia-cartao"));
    steps.push(s("click",{text:"Fechar com conferência",exact:true,name:"fechar-caixa"}));
    steps.push(wait("fechamento-persistir"));
    steps.push(store("extensions.cashClosings.0.status","balanced","fechamento-equilibrado"));
    steps.push(s("reload",{name:"apos-fechamento-reload"}));
    steps.push(store("extensions.cashClosings.0.status","balanced","fechamento-reabre"));
    return {id:"sequence-"+seed,seed,product:product.code,operations:order.concat(["cancel","cash-close"]),
      quantity,expectedFinalStock:product.stock+quantity,expectedSales:0,expectedCancelled:1,
      steps};
  });
}
