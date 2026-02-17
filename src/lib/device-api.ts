// Device API — uses Electron IPC when available, falls back to mock for web preview

export interface DeviceStatus {
  connected: boolean;
  name: string;
  ios: string;
  connection: string;
  developerMode: boolean;
  error?: string;
}

export interface DeviceInfo {
  udid: string;
  name: string;
  ios: string;
  connection: string;
}

// Type-safe access to the Electron bridge injected by preload.js
interface ElectronAPI {
  getDeviceStatus: () => Promise<DeviceStatus>;
  listDevices: () => Promise<{ devices: DeviceInfo[]; error?: string }>;
  selectDevice: (udid: string) => Promise<{ ok: boolean }>;
  setLocation: (lat: number, lng: number) => Promise<{ ok: boolean; error?: string }>;
  resetLocation: () => Promise<{ ok: boolean; error?: string }>;
  startTunnel: () => Promise<{ ok: boolean; host?: string; port?: string; error?: string }>;
  getTunnelStatus: () => Promise<{ active: boolean; host: string | null; port: string | null }>;
  checkTunneld: () => Promise<{ needsPassword: boolean }>;
  startTunneld: (password: string) => Promise<{ ok: boolean; alreadyRunning?: boolean; error?: string }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

const isElectron = typeof window !== "undefined" && !!window.electronAPI;

// ─── Mock fallback (used in browser / Lovable preview) ───
let mockConnected = true;
let mockDevMode = true;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function toggleDeviceConnection() {
  mockConnected = !mockConnected;
}

export function toggleDevMode() {
  mockDevMode = !mockDevMode;
}

export function setDeviceConnected(val: boolean) {
  mockConnected = val;
}

// ─── Unified API ───

export async function listDevices(): Promise<DeviceInfo[]> {
  if (isElectron) {
    const res = await window.electronAPI!.listDevices();
    return res.devices || [];
  }
  // Mock fallback
  await delay(300);
  return mockConnected
    ? [
        { udid: "mock-udid-1", name: "iPhone 15 Pro", ios: "17.4.1", connection: "USB" },
        { udid: "mock-udid-2", name: "iPhone 14", ios: "16.7.2", connection: "USB" },
      ]
    : [];
}

export async function selectDevice(udid: string): Promise<{ ok: boolean }> {
  if (isElectron) {
    return window.electronAPI!.selectDevice(udid);
  }
  return { ok: true };
}

export async function getDeviceStatus(): Promise<DeviceStatus> {
  if (isElectron) {
    return window.electronAPI!.getDeviceStatus();
  }
  // Mock fallback
  await delay(400 + Math.random() * 300);
  return {
    connected: mockConnected,
    name: mockConnected ? "iPhone 15 Pro" : "",
    ios: mockConnected ? "17.4.1" : "",
    connection: mockConnected ? "USB" : "",
    developerMode: mockConnected ? mockDevMode : false,
  };
}

export async function setLocation(lat: number, lng: number): Promise<{ ok: boolean; error?: string; method?: string }> {
  if (isElectron) {
    const res = await window.electronAPI!.setLocation(lat, lng);
    console.log("[geoghost] setLocation result:", JSON.stringify(res));
    return res;
  }
  // Mock fallback
  await delay(600 + Math.random() * 400);
  if (!mockConnected) return { ok: false, error: "No device connected." };
  return { ok: true };
}

export async function resetLocation(): Promise<{ ok: boolean; error?: string }> {
  if (isElectron) {
    const res = await window.electronAPI!.resetLocation();
    console.log("[geoghost] resetLocation result:", JSON.stringify(res));
    return res;
  }
  // Mock fallback
  await delay(500 + Math.random() * 300);
  if (!mockConnected) return { ok: false, error: "No device connected." };
  return { ok: true };
}

export async function checkTunneld(): Promise<{ needsPassword: boolean }> {
  if (isElectron) {
    return window.electronAPI!.checkTunneld();
  }
  return { needsPassword: false };
}

export async function startTunneld(password: string): Promise<{ ok: boolean; error?: string }> {
  if (isElectron) {
    return window.electronAPI!.startTunneld(password);
  }
  return { ok: true };
}
