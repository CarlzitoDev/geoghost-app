import { useState, useCallback, useSyncExternalStore } from "react";

export interface AppSettings {
  mapStyle: "dark" | "satellite" | "streets";
  coordinateFormat: "decimal" | "dms";
  simulationSpeed: number;
  autoSaveRecents: boolean;
  maxRecents: number;
}

const STORAGE_KEY = "geoghost-settings";

const defaultSettings: AppSettings = {
  mapStyle: "dark",
  coordinateFormat: "decimal",
  simulationSpeed: 1.5,
  autoSaveRecents: true,
  maxRecents: 10,
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
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
