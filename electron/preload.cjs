const { contextBridge, ipcRenderer } = require("electron");

// Expose a safe bridge to the renderer (your React app)
contextBridge.exposeInMainWorld("electronAPI", {
  getDeviceStatus: () => ipcRenderer.invoke("device:status"),
  getDeviceLocation: () => ipcRenderer.invoke("location:get"),
  setLocation: (lat, lng) => ipcRenderer.invoke("location:set", { lat, lng }),
  resetLocation: () => ipcRenderer.invoke("location:reset"),
  startTunnel: () => ipcRenderer.invoke("tunnel:start"),
  getTunnelStatus: () => ipcRenderer.invoke("tunnel:status"),
});
