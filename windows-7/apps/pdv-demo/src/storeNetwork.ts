// Registro local de filiais: aditivo e compatível com a chave original da matriz.
// O PostgreSQL central e a sincronização automática pertencem aos marcos P2/P3.
export const LEGACY_PDV_STORE_KEY = "nexus-core:pdv-store:v1";
export const STORE_NETWORK_KEY = "nexus-core:pdv-store-network:v1";
export const ACTIVE_STORE_BRANCH_KEY = "nexus-core:pdv-active-branch:v1";
export const MAIN_BRANCH_ID = "matriz";

export type StoreOperator = { id: string; role: "cashier" | "manager" | "admin" };
export type StoreBranch = {
  id: string;
  name: string;
  active: boolean;
  storeKey: string;
  allowedOperatorIds: string[];
};
export type StoreNetwork = {
  version: 1;
  company: { id: string; name: string };
  branches: StoreBranch[];
};
export type StoreNetworkStorage = Pick<Storage, "getItem" | "setItem">;

export function createDefaultStoreNetwork(): StoreNetwork {
  return {
    version: 1,
    company: { id: "empresa-local", name: "Minha empresa" },
    branches: [{ id: MAIN_BRANCH_ID, name: "Matriz", active: true, storeKey: LEGACY_PDV_STORE_KEY, allowedOperatorIds: [] }]
  };
}

function resolveStorage(storage?: StoreNetworkStorage): StoreNetworkStorage | null {
  if (storage) return storage;
  try { return typeof window === "undefined" ? null : window.localStorage; }
  catch { return null; }
}

export function parseStoreNetwork(raw: string | null): StoreNetwork {
  if (raw === null) return createDefaultStoreNetwork();
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("Registro de filiais inválido ou corrompido. Preserve o backup antes de continuar."); }
  const value = parsed as Partial<StoreNetwork> | null;
  if (!value || value.version !== 1 || !value.company || typeof value.company.name !== "string" ||
    !Array.isArray(value.branches) || !value.branches.length ||
    value.branches.some((branch) => !branch || typeof branch.id !== "string" ||
      typeof branch.name !== "string" || typeof branch.storeKey !== "string" ||
      typeof branch.active !== "boolean" || !Array.isArray(branch.allowedOperatorIds) ||
      branch.allowedOperatorIds.some((id) => typeof id !== "string")) ||
    new Set(value.branches.map((branch) => branch.id)).size !== value.branches.length ||
    new Set(value.branches.map((branch) => branch.storeKey)).size !== value.branches.length ||
    !value.branches.some((branch) => branch.id === MAIN_BRANCH_ID && branch.storeKey === LEGACY_PDV_STORE_KEY && branch.active)) {
    throw new Error("Registro de filiais inválido ou corrompido. Os dados existentes não foram alterados.");
  }
  return value as StoreNetwork;
}

export function readStoreNetwork(storage?: StoreNetworkStorage): StoreNetwork {
  return parseStoreNetwork(resolveStorage(storage)?.getItem(STORE_NETWORK_KEY) ?? null);
}

export function saveStoreNetwork(storage: StoreNetworkStorage, registry: StoreNetwork): void {
  const raw = JSON.stringify(registry);
  parseStoreNetwork(raw);
  storage.setItem(STORE_NETWORK_KEY, raw);
}

export function normalizeBranchName(value: string): string {
  const name = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!name || name.length > 80) throw new Error("Informe um nome de filial de até 80 caracteres.");
  return name;
}

export function registerStoreBranch(registry: StoreNetwork, input: { name: string; operatorId: string }): StoreNetwork {
  const name = normalizeBranchName(input.name);
  const operatorId = String(input.operatorId ?? "").trim();
  if (!operatorId) throw new Error("Operador responsável obrigatório.");
  if (registry.branches.some((branch) => branch.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) {
    throw new Error("Já existe uma loja com esse nome.");
  }
  const slug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36);
  const id = "loja-" + (slug || "unidade");
  if (registry.branches.some((branch) => branch.id === id)) throw new Error("Já existe uma filial com este identificador.");
  return {
    ...registry,
    branches: [...registry.branches, {
      id, name, active: true,
      storeKey: `${LEGACY_PDV_STORE_KEY}:filial:${id}`,
      allowedOperatorIds: [operatorId]
    }]
  };
}

export function renameStoreBranch(registry: StoreNetwork, branchId: string, nameInput: string): StoreNetwork {
  const name = normalizeBranchName(nameInput);
  if (!registry.branches.some((branch) => branch.id === branchId)) throw new Error("Filial não encontrada.");
  if (registry.branches.some((branch) => branch.id !== branchId && branch.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) {
    throw new Error("Já existe uma loja com esse nome.");
  }
  return { ...registry, branches: registry.branches.map((branch) => branch.id === branchId ? { ...branch, name } : branch) };
}

export function deactivateStoreBranch(registry: StoreNetwork, branchId: string): StoreNetwork {
  if (branchId === MAIN_BRANCH_ID) throw new Error("A matriz não pode ser desativada.");
  if (!registry.branches.some((branch) => branch.id === branchId)) throw new Error("Filial não encontrada.");
  return { ...registry, branches: registry.branches.map((branch) => branch.id === branchId ? { ...branch, active: false } : branch) };
}

export function grantStoreBranchOperator(registry: StoreNetwork, branchId: string, operatorId: string, allowed: boolean): StoreNetwork {
  const id = operatorId.trim();
  if (!id) throw new Error("Informe o código do operador.");
  if (!registry.branches.some((branch) => branch.id === branchId)) throw new Error("Filial não encontrada.");
  return {
    ...registry,
    branches: registry.branches.map((branch) => branch.id === branchId
      ? { ...branch, allowedOperatorIds: allowed ? Array.from(new Set([...branch.allowedOperatorIds, id])) : branch.allowedOperatorIds.filter((current) => current !== id) }
      : branch)
  };
}

export function canAccessStoreBranch(branch: StoreBranch, operator: StoreOperator): boolean {
  if (!branch.active) return false;
  return operator.role === "admin" ||
    (branch.id === MAIN_BRANCH_ID && branch.allowedOperatorIds.length === 0) ||
    branch.allowedOperatorIds.includes(operator.id);
}

export function currentStoreBranch(registry: StoreNetwork, storage?: StoreNetworkStorage): StoreBranch {
  const selected = resolveStorage(storage)?.getItem(ACTIVE_STORE_BRANCH_KEY) || MAIN_BRANCH_ID;
  return registry.branches.find((branch) => branch.id === selected && branch.active)
    ?? registry.branches.find((branch) => branch.id === MAIN_BRANCH_ID)!;
}

export function selectActiveStoreBranch(storage: StoreNetworkStorage, registry: StoreNetwork, branchId: string, operator: StoreOperator): void {
  const branch = registry.branches.find((item) => item.id === branchId);
  if (!branch) throw new Error("Filial não encontrada.");
  if (!branch.active) throw new Error("Filial inativa.");
  if (!canAccessStoreBranch(branch, operator)) throw new Error("Operador sem permissão para esta filial.");
  storage.setItem(ACTIVE_STORE_BRANCH_KEY, branch.id);
}

export function getActivePdvStoreKey(storage?: StoreNetworkStorage): string {
  const source = resolveStorage(storage);
  if (!source) return LEGACY_PDV_STORE_KEY;
  return currentStoreBranch(readStoreNetwork(source), source).storeKey;
}

export function getScopedBranchStorageKey(legacyKey: string, storage?: StoreNetworkStorage): string {
  const branch = currentStoreBranch(readStoreNetwork(storage), storage);
  return branch.id === MAIN_BRANCH_ID ? legacyKey : `${legacyKey}:filial:${branch.id}`;
}
