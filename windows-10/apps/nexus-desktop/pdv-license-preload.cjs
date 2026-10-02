'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pdvLicense', {
  activate: payload => ipcRenderer.invoke('pdv-license:activate', payload),
  close: () => ipcRenderer.invoke('pdv-license:close')
});
