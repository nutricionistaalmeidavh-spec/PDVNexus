export interface UserSecretStore {
  get(key: string): Promise<string>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  pnpId?: string;
  locationId?: string;
  productId?: string;
  vendorId?: string;
}

export interface SerialOpenOptions {
  path: string;
  baudRate?: number;
}

export interface SerialDataEvent {
  path: string;
  data: string;
}

export interface SerialErrorEvent {
  path: string;
  message: string;
}

export interface DesktopSerialBridge {
  list(): Promise<SerialPortInfo[]>;
  open(options: SerialOpenOptions): Promise<boolean>;
  write(path: string, value: string): Promise<boolean>;
  close(path: string): Promise<boolean>;
  onData(callback: (event: SerialDataEvent) => void): () => void;
  onError(callback: (event: SerialErrorEvent) => void): () => void;
}

export interface DesktopPdvStoreStatus {
  available: boolean;
  path: string;
  machineName: string;
}

export interface DesktopPdvStoreRow {
  snapshotJson: string;
  updatedAt: string;
}

export interface DesktopPdvStoreBridge {
  status(): Promise<DesktopPdvStoreStatus>;
  load(storeKey: string): Promise<DesktopPdvStoreRow | null>;
  save(storeKey: string, snapshotJson: string): Promise<{ updatedAt: string }>;
}

export type DesktopStoreStatus = DesktopPdvStoreStatus;
export type DesktopStoreRow = DesktopPdvStoreRow;

export interface DesktopStoreBridge {
  status(): Promise<DesktopStoreStatus>;
  load(storeKey: string): Promise<DesktopStoreRow | null>;
  save(storeKey: string, snapshotJson: string): Promise<{ updatedAt: string }>;
}

export interface DesktopBackupFile {
  name: string;
  path: string;
  createdAt: string;
  size: number;
}

export interface DesktopBackupBridge {
  list(scope: string): Promise<{ directory: string; files: DesktopBackupFile[] }>;
  write(options: { scope: string; snapshotJson: string; reason: string; retention: number }): Promise<{ path: string; createdAt: string; files: DesktopBackupFile[] }>;
}

export interface DesktopPdvSyncServerStatus {
  running: boolean;
  host?: string;
  port?: number;
  url?: string;
  storeKey?: string;
  tokenRequired?: boolean;
}

export interface DesktopPdvSyncServerOptions {
  port?: number;
  token?: string;
  storeKey?: string;
}

export interface DesktopPdvSyncBridge {
  status(): Promise<DesktopPdvSyncServerStatus>;
  start(options: DesktopPdvSyncServerOptions): Promise<DesktopPdvSyncServerStatus>;
  stop(): Promise<DesktopPdvSyncServerStatus>;
}

export interface DesktopPdvBackupFile {
  name: string;
  path: string;
  createdAt: string;
  size: number;
}

export interface DesktopPdvBackupBridge {
  list(): Promise<{ directory: string; files: DesktopPdvBackupFile[] }>;
  write(options: { snapshotJson: string; reason: string; retention: number }): Promise<{ path: string; createdAt: string; files: DesktopPdvBackupFile[] }>;
}

export interface DesktopReceiptPrintOptions {
  text: string;
  width?: number;
  paperFormat?: "58mm" | "80mm" | "a4-half";
  printerName?: string;
}

export interface DesktopPrintingBridge {
  receipt(options: DesktopReceiptPrintOptions): Promise<{ success: boolean; failureReason: string }>;
}

declare global {
  interface Window {
    nexusDesktop?: {
      secrets: {
        get(key: string): Promise<string>;
        set(key: string, value: string): Promise<boolean>;
        remove(key: string): Promise<boolean>;
        isEncryptionAvailable(): Promise<boolean>;
      };
      serial?: DesktopSerialBridge;
      store?: DesktopStoreBridge;
      backup?: DesktopBackupBridge;
      pdvStore?: DesktopPdvStoreBridge;
      pdvSync?: DesktopPdvSyncBridge;
      pdvBackup?: DesktopPdvBackupBridge;
      printing?: DesktopPrintingBridge;
    };
  }
}

const memoryFallback = new Map<string, string>();
const STORAGE_PREFIX = "nexus-core:";

class BrowserSecretStore implements UserSecretStore {
  async get(key: string): Promise<string> {
    try {
      return window.localStorage.getItem(`${STORAGE_PREFIX}${key}`) ?? "";
    } catch {
      return memoryFallback.get(key) ?? "";
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, value);
    } catch {
      memoryFallback.set(key, value);
    }
  }

  async remove(key: string): Promise<void> {
    try {
      window.localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    } catch {
      memoryFallback.delete(key);
    }
  }
}

class ElectronSecretStore implements UserSecretStore {
  async get(key: string): Promise<string> {
    return window.nexusDesktop?.secrets.get(key) ?? "";
  }

  async set(key: string, value: string): Promise<void> {
    await window.nexusDesktop?.secrets.set(key, value);
  }

  async remove(key: string): Promise<void> {
    await window.nexusDesktop?.secrets.remove(key);
  }
}

export function createUserSecretStore(): UserSecretStore {
  if (typeof window !== "undefined" && window.nexusDesktop?.secrets) {
    return new ElectronSecretStore();
  }

  return new BrowserSecretStore();
}

export function getDesktopSerialBridge(): DesktopSerialBridge | undefined {
  return window.nexusDesktop?.serial;
}

export function getDesktopPdvStoreBridge(): DesktopPdvStoreBridge | undefined {
  return window.nexusDesktop?.pdvStore;
}

export function getDesktopStoreBridge(): DesktopStoreBridge | undefined {
  return window.nexusDesktop?.store ?? window.nexusDesktop?.pdvStore;
}

export function getDesktopBackupBridge(): DesktopBackupBridge | undefined {
  return window.nexusDesktop?.backup;
}

export function getDesktopPdvSyncBridge(): DesktopPdvSyncBridge | undefined {
  return window.nexusDesktop?.pdvSync;
}

export function getDesktopPdvBackupBridge(): DesktopPdvBackupBridge | undefined {
  return window.nexusDesktop?.pdvBackup;
}

export function getDesktopPrintingBridge(): DesktopPrintingBridge | undefined {
  return window.nexusDesktop?.printing;
}

export async function isDesktopSecretEncryptionAvailable() {
  return window.nexusDesktop?.secrets.isEncryptionAvailable?.() ?? false;
}
