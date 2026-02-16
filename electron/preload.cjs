const { contextBridge, ipcRenderer } = require("electron");

// Expose a safe bridge to the renderer (your React app)
contextBridge.exposeInMainWorld("electronAPI", {
  getDeviceStatus: () => ipcRenderer.invoke("device:status"),
  setLocation: (lat, lng) => ipcRenderer.invoke("location:set", { lat, lng }),
  resetLocation: () => ipcRenderer.invoke("location:reset"),
  startTunnel: () => ipcRenderer.invoke("tunnel:start"),
  getTunnelStatus: () => ipcRenderer.invoke("tunnel:status"),
  checkTunneld: () => ipcRenderer.invoke("tunneld:check"),
  startTunneld: (password) => ipcRenderer.invoke("tunneld:start", { password }),
});
