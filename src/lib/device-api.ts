// Device API — uses Electron IPC when available, falls back to mock for web preview

export interface DeviceStatus {
  connected: boolean;
  name: string;
  ios: string;
  connection: string;
  developerMode: boolean;
  error?: string;
}

// Type-safe access to the Electron bridge injected by preload.js
interface ElectronAPI {
  getDeviceStatus: () => Promise<DeviceStatus>;
  setLocation: (lat: number, lng: number) => Promise<{ ok: boolean; error?: string }>;
  resetLocation: () => Promise<{ ok: boolean; error?: string }>;
  startTunnel: () => Promise<{ ok: boolean; host?: string; port?: string; error?: string }>;
  getTunnelStatus: () => Promise<{ active: boolean; host: string | null; port: string | null }>;
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
