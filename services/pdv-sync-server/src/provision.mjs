import pg from "pg";
import { migrate, provisionTerminal } from "./storage.mjs";
if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL obrigatório.");
const [companyId,companyName,branchId,branchName,terminalId]=process.argv.slice(2);
if(![companyId,companyName,branchId,branchName,terminalId].every(Boolean)){
 console.error("Uso: node src/provision.mjs <id-empresa> <nome-empresa> <id-filial> <nome-filial> <id-terminal>");
 process.exit(2);
}
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
try{
 await migrate(pool);
 const created=await provisionTerminal(pool,{companyId,companyName,branchId,branchName,terminalId});
 console.log("Credencial do terminal (mostrada uma única vez; guarde em local seguro):\n"+created.token);
 console.log("Empresa: "+created.companyId+", filial: "+created.branchId+", terminal: "+created.terminalId);
}finally{await pool.end();}
