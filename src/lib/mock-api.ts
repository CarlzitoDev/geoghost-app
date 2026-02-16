// Mock API layer — simulates device + location endpoints client-side

export interface DeviceStatus {
  connected: boolean;
  name: string;
  ios: string;
  connection: string;
  developerMode: boolean;
}

let mockConnected = true;
let mockDevMode = true;

export function toggleDeviceConnection() {
  mockConnected = !mockConnected;
}

export function toggleDevMode() {
  mockDevMode = !mockDevMode;
}

export function setDeviceConnected(val: boolean) {
  mockConnected = val;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getDeviceStatus(): Promise<DeviceStatus> {
  await delay(400 + Math.random() * 300);
  return {
    connected: mockConnected,
    name: mockConnected ? "iPhone 15 Pro" : "",
    ios: mockConnected ? "17.4.1" : "",
    connection: mockConnected ? "USB" : "",
    developerMode: mockConnected ? mockDevMode : false,
  };
}

export async function setLocation(lat: number, lng: number, label?: string): Promise<{ ok: boolean; error?: string }> {
  await delay(600 + Math.random() * 400);
  if (!mockConnected) return { ok: false, error: "No device connected." };
  return { ok: true };
}

export async function resetLocation(): Promise<{ ok: boolean; error?: string }> {
  await delay(500 + Math.random() * 300);
  if (!mockConnected) return { ok: false, error: "No device connected." };
  return { ok: true };
}
