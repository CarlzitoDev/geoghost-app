import { useState, useCallback, useSyncExternalStore } from "react";

export type TransportMode = "walk" | "bike" | "drive";
export type TunnelMode = "auto" | "quic" | "sudo";
export type SimulationMode = "smooth" | "interval";

export interface AppSettings {
  mapStyle: "dark" | "satellite" | "streets";
  coordinateFormat: "decimal" | "dms";
  transportMode: TransportMode;
  simulationMode: SimulationMode;
  intervalSeconds: 3 | 5 | 10;
  autoSaveRecents: boolean;
  maxRecents: number;
  tunnelMode: TunnelMode;
}

export const SIMULATION_MODES: Record<SimulationMode, { label: string; description: string; icon: string }> = {
  smooth: {
    label: "Smooth",
    description: "Marker glides continuously at realistic speed",
    icon: "wave",
  },
  interval: {
    label: "Interval",
    description: "Teleports to next position every few seconds",
    icon: "timer",
  },
};

/** Speeds in km/h */
export const TRANSPORT_SPEEDS: Record<TransportMode, { speed: number; label: string; icon: string }> = {
  walk: { speed: 5, label: "Walking", icon: "footprints" },
  bike: { speed: 15, label: "Cycling", icon: "bike" },
  drive: { speed: 50, label: "Driving", icon: "car" },
};

const STORAGE_KEY = "geoghost-settings";

const defaultSettings: AppSettings = {
  mapStyle: "dark",
  coordinateFormat: "decimal",
  transportMode: "walk",
  simulationMode: "smooth",
  intervalSeconds: 5,
  autoSaveRecents: true,
  maxRecents: 10,
  tunnelMode: "auto",
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = { ...defaultSettings, ...JSON.parse(raw) };
      // Migrate old simulationSpeed setting
      if ("simulationSpeed" in parsed && !("transportMode" in JSON.parse(raw))) {
        parsed.transportMode = "walk";
      }
      delete (parsed as any).simulationSpeed;
      return parsed;
    }
  } catch {}
  return defaultSettings;
}

function saveSettings(settings: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

let currentSettings = loadSettings();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function getSnapshot() {
  return currentSettings;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettings() {
  const settings = useSyncExternalStore(subscribe, getSnapshot);

  const update = useCallback((partial: Partial<AppSettings>) => {
    currentSettings = { ...currentSettings, ...partial };
    saveSettings(currentSettings);
    notify();
  }, []);

  const reset = useCallback(() => {
    currentSettings = { ...defaultSettings };
    saveSettings(currentSettings);
    notify();
  }, []);

  return { settings, update, reset };
}
