import { verifyPdvUserPassword, type PdvUser } from "../../../packages/database/src/pdv";
export function canReadPdvFinance(user:PdvUser,sessionManagerId:string|null):boolean {
  return Boolean(user.active && (user.role==="manager"||user.role==="admin")
    && sessionManagerId===user.id);
}
export function authenticatePdvOperator(users:readonly PdvUser[],id:string,password:string):{user:PdvUser;sessionManagerId:string|null}{
  const user=users.find(x=>x.id===id&&x.active);
  if(!user)throw new Error("Operador não encontrado ou inativo.");
  const configured=Boolean(user.password||user.managerPassword);
  if(configured){
    const valid=verifyPdvUserPassword({user,password}).ok;
    if(!valid)throw new Error("Senha/PIN inválido para o operador.");
  }else if(user.role!=="cashier"){
    throw new Error("Gerente sem PIN configurado. Faça a configuração inicial neste computador.");
  }
  return {user,sessionManagerId:user.role==="cashier"?null:user.id};
}
export function bootstrapPdvFirstManager(users:readonly PdvUser[],password:string):{users:PdvUser[];user:PdvUser}{
  if(users.some(x=>x.active&&(x.role==="manager"||x.role==="admin")&&Boolean(x.managerPassword||x.password)))
    throw new Error("Já existe gerente com PIN. Entre com a credencial existente.");
  if(password.trim().length<6)throw new Error("Defina PIN inicial com pelo menos 6 caracteres.");
  const selected=users.find(x=>x.active&&(x.role==="manager"||x.role==="admin"));
  if(!selected)throw new Error("Cadastre um perfil de gerente antes da configuração inicial.");
  const user={...selected,managerPassword:password};
  return {user,users:users.map(x=>x.id===selected.id?user:x)};
}
