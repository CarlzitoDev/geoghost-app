
## Route Simulation Modes + Settings Reorganization

### What's changing

Two new simulation modes (no "Instant"), cleaner grouped settings, and an immediate device name update in the top bar when switching devices.

---

### Simulation Modes

| Mode | How it works |
|---|---|
| **Smooth** (default) | Current behavior — marker glides continuously along the route at realistic speed (walk/bike/drive). Nothing changes here. |
| **Interval** | Marker teleports to the next position every N seconds. Configurable at 3s, 5s, or 10s. Useful for simulating apps that poll location infrequently rather than streaming it. |

"Instant" is excluded — it defeats the purpose of a route.

---

### Settings Layout

Sections are grouped visually with clear headers. No accordion — just clean dividers and consistent section labels.

```text
+----------------------------------+
|  APPEARANCE                      |
|    Map Style          [Dark v]   |
|    Coordinate Format  [Decimal]  |
+----------------------------------+
|  SIMULATION                      |
|    Transport Mode [Walk|Bike|Car] |
|    Movement Mode  [Smooth|Interval]|
|    Teleport Interval   [5s v]    |
|      (only shown for Interval)   |
+----------------------------------+
|  HISTORY                         |
|    Auto-save recents   [toggle]  |
|    Max recent locations [10 v]   |
+----------------------------------+
|  ADVANCED                        |
|    Tunnel Mode        [Auto v]   |
+----------------------------------+
|  [Reset to defaults]             |
+----------------------------------+
```

---

### Device Chip Fix

When you tap a device in the popover to switch, the chip in the top bar will immediately update to the new device name rather than waiting for the background refresh to complete.

---

### Technical Details

**`src/hooks/use-settings.ts`**
- Add `simulationMode: "smooth" | "interval"` (default: `"smooth"`)
- Add `intervalSeconds: 3 | 5 | 10` (default: `5`)
- Export `SimulationMode` type and a `SIMULATION_MODES` descriptor object with label + description for each mode

**`src/components/SettingsPanel.tsx`**
- Merge "Map" + "Coordinates" into a single **Appearance** section
- Add **Simulation** section with: transport mode cards (existing), movement mode cards (new — 2 cards styled same as transport), and a conditional interval selector that only appears when "Interval" is selected
- Keep **History** and **Advanced** sections as-is, just re-ordered

**`src/components/MapPanel.tsx`**
- Add `switchedDeviceName` local state; set it immediately on device switch; use it in the chip display with a `useEffect` to clear it once `deviceStatus.name` catches up
- In `toggleSimulation`, branch on `settings.simulationMode`:
  - `"smooth"` — existing `requestAnimationFrame` loop (no changes)
  - `"interval"` — use `setInterval` instead of `requestAnimationFrame`. Each tick advances to the next proportional position along the pre-computed steps array, jumping forward by `(totalSteps / (totalDistanceKm / speedKmh * 3600 / intervalSeconds))` steps per tick. Store the interval ID in `simulationRef` (reusing the same ref, just cast to `number`). Cancel with `clearInterval` on stop.
- The stop-simulation branch needs to handle both `cancelAnimationFrame` and `clearInterval` depending on current mode — tracked via a `simModeRef` ref to avoid stale closures.
