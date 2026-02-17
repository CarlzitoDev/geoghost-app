

## Route Simulation Modes and Settings Reorganization

### 1. New Route Simulation Modes

Adding a new `simulationMode` setting with three distinct movement behaviors:

- **Smooth** (default) -- The current behavior. The marker moves fluidly along the route at a realistic pace based on transport speed. Best for apps that track continuous movement.
- **Interval** -- Teleports the marker to the next point along the route every few seconds (configurable: 3s, 5s, 10s). Simulates how some apps poll location infrequently. Useful for check-in style apps.
- **Instant** -- Jumps directly to the final destination with no animation. Fastest option for when you just need to appear somewhere without simulating travel.

A new `intervalSeconds` setting (default: 5) controls the teleport frequency for Interval mode.

### 2. Settings Panel Reorganization

Grouping settings into cleaner, collapsible categories using accordion sections:

```text
+----------------------------------+
|  APPEARANCE                      |
|    Map Style          [Dark v]   |
|    Coordinate Format  [Decimal]  |
+----------------------------------+
|  SIMULATION                      |
|    Transport Mode  [Walk|Bike|Car]|
|    Simulation Mode [Smooth|...]  |
|    Teleport Interval  [5s v]     |
|      (only visible in Interval)  |
+----------------------------------+
|  HISTORY                         |
|    Auto-save recents   [toggle]  |
|    Max recent locations [10 v]   |
+----------------------------------+
|  ADVANCED (destructive border)   |
|    Tunnel Mode        [Auto v]   |
+----------------------------------+
|  [Reset to defaults]             |
+----------------------------------+
```

### Technical Details

**File: `src/hooks/use-settings.ts`**
- Add `simulationMode: "smooth" | "interval" | "instant"` to `AppSettings` (default: `"smooth"`)
- Add `intervalSeconds: number` to `AppSettings` (default: `5`)
- Export `SimulationMode` type and a `SIMULATION_MODES` descriptor record (similar to `TRANSPORT_SPEEDS`)

**File: `src/components/SettingsPanel.tsx`**
- Reorganize into four visual groups: Appearance, Simulation, History, Advanced
- Move Map Style and Coordinate Format under "Appearance"
- Move Transport Mode under "Simulation" and add the new Simulation Mode selector (3 styled cards similar to transport mode) and a conditional Interval selector
- Keep History and Advanced sections as they are
- Use cleaner section headers with consistent spacing

**File: `src/components/MapPanel.tsx`**
- Update `toggleSimulation` to read `settings.simulationMode`:
  - **smooth**: Current `requestAnimationFrame` loop with 200ms ticks (no changes)
  - **interval**: Use `setInterval` at `settings.intervalSeconds * 1000`. Each tick jumps to the proportionally next point along the route (skipping intermediate steps)
  - **instant**: Immediately set location to the last waypoint, update marker, show success toast. No animation loop at all
