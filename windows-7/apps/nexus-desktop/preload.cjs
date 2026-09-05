const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nexusDesktop", {
  secrets: {
    get: (key) => ipcRenderer.invoke("nexus-secret:get", key),
    set: (key, value) => ipcRenderer.invoke("nexus-secret:set", key, value),
    remove: (key) => ipcRenderer.invoke("nexus-secret:remove", key),
    isEncryptionAvailable: () => ipcRenderer.invoke("nexus-secret:encryption-available")
  },
  serial: {
    list: () => ipcRenderer.invoke("nexus-serial:list"),
    open: (options) => ipcRenderer.invoke("nexus-serial:open", options),
    write: (path, value) => ipcRenderer.invoke("nexus-serial:write", path, value),
    close: (path) => ipcRenderer.invoke("nexus-serial:close", path),
    onData: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on("nexus-serial:data", listener);
      return () => ipcRenderer.removeListener("nexus-serial:data", listener);
    },
    onError: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on("nexus-serial:error", listener);
      return () => ipcRenderer.removeListener("nexus-serial:error", listener);
    }
  },
  pdvStore: {
    status: () => ipcRenderer.invoke("nexus-pdv-store:status"),
    load: (storeKey) => ipcRenderer.invoke("nexus-pdv-store:load", storeKey),
    save: (storeKey, snapshotJson) => ipcRenderer.invoke("nexus-pdv-store:save", storeKey, snapshotJson)
  },
  store: {
    status: () => ipcRenderer.invoke("app-store:status"),
    load: (storeKey) => ipcRenderer.invoke("app-store:load", storeKey),
    save: (storeKey, snapshotJson) => ipcRenderer.invoke("app-store:save", storeKey, snapshotJson)
  },
  backup: {
    list: (scope) => ipcRenderer.invoke("app-backup:list", scope),
    write: (options) => ipcRenderer.invoke("app-backup:write", options)
  },
  pdvSync: {
    status: () => ipcRenderer.invoke("nexus-pdv-sync:status"),
    start: (options) => ipcRenderer.invoke("nexus-pdv-sync:start", options),
    stop: () => ipcRenderer.invoke("nexus-pdv-sync:stop")
  },
  pdvBackup: {
    list: () => ipcRenderer.invoke("nexus-pdv-backup:list"),
    write: (options) => ipcRenderer.invoke("nexus-pdv-backup:write", options)
  },
  printing: {
    receipt: (options) => ipcRenderer.invoke("nexus-print:receipt", options)
  }
});
