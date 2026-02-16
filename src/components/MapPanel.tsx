import { useRef, useEffect, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  Search, Star, Clock, MapPin, Navigation, Play, Pause,
  Trash2, Loader2, Undo2, Pencil, MousePointerClick,
  Upload, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { toast } from "sonner";
import { setLocation, resetLocation, type DeviceStatus } from "@/lib/mock-api";
import { type SavedLocation } from "@/hooks/use-location-storage";
import { useSettings, TRANSPORT_SPEEDS } from "@/hooks/use-settings";
import {
  type Waypoint,
  haversine,
  routeDistance,
  formatDistance,
  formatEta,
  snapToRoads,
  snapDrawnPath,
  transportToProfile,
} from "@/lib/route-utils";

import { parseGpx, exportGpx, downloadFile } from "@/lib/gpx-utils";

const MAPBOX_TOKEN = "pk.eyJ1IjoiY2FybHppdG8iLCJhIjoiY21scGRkMWRsMWFtODNlcXcwa25yNnprcSJ9.KE1oBQcON-JrySAX_HlKKg";
const DEFAULT_CENTER: [number, number] = [-122.4194, 37.7749];

interface MapPanelProps {
  deviceStatus: DeviceStatus | null;
  favorites: SavedLocation[];
  recents: SavedLocation[];
  onAddFavorite: (loc: { lat: number; lng: number; label: string }) => void;
  onRemoveFavorite: (id: string) => void;
  onAddRecent: (loc: { lat: number; lng: number; label: string }) => void;
}

export function MapPanel({ deviceStatus, favorites, recents, onAddFavorite, onRemoveFavorite, onAddRecent }: MapPanelProps) {
  const { settings } = useSettings();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const routeMarkersRef = useRef<mapboxgl.Marker[]>([]);

  const [coords, setCoords] = useState<Waypoint>({ lat: 37.7749, lng: -122.4194 });
  const [searchQuery, setSearchQuery] = useState("");
  const [settingLocation, setSettingLocation] = useState(false);
  const [resettingLocation, setResettingLocation] = useState(false);
  const [locationChanged, setLocationChanged] = useState(false);
  const [mode, setMode] = useState<"static" | "route">("static");
  const [favName, setFavName] = useState("");

  // Route state
  const [routeMode, setRouteMode] = useState<"tap" | "draw">("tap");
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [snappedRoute, setSnappedRoute] = useState<Waypoint[]>([]);
  const [isSnapping, setIsSnapping] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const drawPointsRef = useRef<Waypoint[]>([]);
  const [simulating, setSimulating] = useState(false);
  const [simProgress, setSimProgress] = useState(0);
  const simulationRef = useRef<number | null>(null);
  const gpxInputRef = useRef<HTMLInputElement>(null);
  const [undoStack, setUndoStack] = useState<Waypoint[][]>([]);

  const connected = deviceStatus?.connected ?? false;
  const devMode = deviceStatus?.developerMode ?? false;
  const canSpoof = connected && devMode;

  const profile = transportToProfile(settings.transportMode);

  // Init map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: DEFAULT_CENTER,
      zoom: 12,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");

    const marker = new mapboxgl.Marker({ color: "hsl(160, 55%, 49%)", draggable: true })
      .setLngLat(DEFAULT_CENTER)
      .addTo(map);

    marker.on("dragend", () => {
      const lngLat = marker.getLngLat();
      setCoords({ lat: parseFloat(lngLat.lat.toFixed(6)), lng: parseFloat(lngLat.lng.toFixed(6)) });
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Map style switcher
  const MAP_STYLES: Record<string, string> = {
    dark: "mapbox://styles/mapbox/dark-v11",
    satellite: "mapbox://styles/mapbox/satellite-streets-v12",
    streets: "mapbox://styles/mapbox/streets-v12",
  };

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setStyle(MAP_STYLES[settings.mapStyle] || MAP_STYLES.dark);
    }
  }, [settings.mapStyle]);

  // Handle map clicks — only in static mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleClick = (e: mapboxgl.MapMouseEvent) => {
      if (mode !== "static") return;
      const { lat, lng } = e.lngLat;
      const point: Waypoint = { lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)) };
      setCoords(point);
      markerRef.current?.setLngLat([point.lng, point.lat]);
    };

    map.on("click", handleClick);
    return () => { map.off("click", handleClick); };
  }, [mode]);

  // Use refs to avoid stale closures in map event handlers
  const waypointsRef = useRef<Waypoint[]>(waypoints);
  waypointsRef.current = waypoints;
  const snappedRouteRef = useRef<Waypoint[]>(snappedRoute);
  snappedRouteRef.current = snappedRoute;
  const profileRef = useRef(profile);
  profileRef.current = profile;

  // Route mode: handle map clicks to add waypoints in tap mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== "route" || routeMode !== "tap") return;

    const handleRouteClick = async (e: mapboxgl.MapMouseEvent) => {
      const { lat, lng } = e.lngLat;
      const wp: Waypoint = { lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)) };
      const currentWps = waypointsRef.current;

      setUndoStack((prev) => [...prev, [...currentWps]]);

      // Add marker
      const m = new mapboxgl.Marker({
        color: currentWps.length === 0 ? "hsl(160, 55%, 49%)" : "#a855f7",
        scale: 0.7,
      })
        .setLngLat([wp.lng, wp.lat])
        .addTo(map);
      routeMarkersRef.current.push(m);

      const newWaypoints = [...currentWps, wp];
      setWaypoints(newWaypoints);

      // Snap to road between last two waypoints
      if (newWaypoints.length >= 2) {
        setIsSnapping(true);
        const from = newWaypoints[newWaypoints.length - 2];
        const to = wp;
        const snapped = await snapToRoads(from, to, profileRef.current);

        setSnappedRoute((prev) => {
          const base = prev.length > 0 ? prev : [from];
          return [...base, ...snapped.slice(1)];
        });
        setIsSnapping(false);
      }
    };

    map.on("click", handleRouteClick);
    return () => { map.off("click", handleRouteClick); };
  }, [mode, routeMode]);

  // Draw preview line while drawing
  const drawPreviewLine = useCallback((points: Waypoint[]) => {
    const map = mapRef.current;
    if (!map || points.length < 2) return;
    const coords = points.map((p) => [p.lng, p.lat]);
    const sourceId = "draw-preview";

    if (map.getSource(sourceId)) {
      (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: coords },
      });
    } else {
      map.addSource(sourceId, {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } },
      });
      map.addLayer({
        id: "draw-preview-layer",
        type: "line",
        source: sourceId,
        paint: { "line-color": "#f97316", "line-width": 3, "line-opacity": 0.6 },
      });
    }
  }, []);

  const removePreviewLine = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.getLayer("draw-preview-layer")) map.removeLayer("draw-preview-layer");
    if (map.getSource("draw-preview")) map.removeSource("draw-preview");
  }, []);

  // Route mode: drawing — stable effect, no waypoints/profile dependency
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== "route" || routeMode !== "draw") return;

    let drawing = false;
    let drawingStarted = false;

    const onMouseDown = (e: mapboxgl.MapMouseEvent) => {
      if ((e.originalEvent.target as HTMLElement)?.closest?.("button, [role=dialog], .glass-strong")) return;
      e.preventDefault();
      drawing = true;
      drawingStarted = false;
      drawPointsRef.current = [{ lat: e.lngLat.lat, lng: e.lngLat.lng }];
      map.dragPan.disable();
      map.getCanvas().style.cursor = "crosshair";
    };

    const onMouseMove = (e: mapboxgl.MapMouseEvent) => {
      if (!drawing) return;
      drawingStarted = true;
      const pt = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      const last = drawPointsRef.current[drawPointsRef.current.length - 1];
      if (haversine(last, pt) > 0.005) {
        drawPointsRef.current.push(pt);
        drawPreviewLine(drawPointsRef.current);
      }
    };

    const onMouseUp = async () => {
      if (!drawing) return;
      drawing = false;
      map.dragPan.enable();
      map.getCanvas().style.cursor = "crosshair";

      const points = drawPointsRef.current;
      drawPointsRef.current = [];

      if (!drawingStarted || points.length < 3) {
        removePreviewLine();
        return;
      }

      setIsSnapping(true);
      const snapped = await snapDrawnPath(points, profileRef.current);
      setIsSnapping(false);

      const sampledWps: Waypoint[] = [];
      const totalDist = routeDistance(snapped);
      const numSamples = Math.max(2, Math.min(20, Math.ceil(totalDist / 0.1)));
      for (let i = 0; i < numSamples; i++) {
        const idx = Math.round((i / (numSamples - 1)) * (snapped.length - 1));
        sampledWps.push(snapped[idx]);
      }

      const currentWps = waypointsRef.current;
      setUndoStack((prev) => [...prev, [...currentWps]]);

      const startM = new mapboxgl.Marker({ color: currentWps.length === 0 ? "hsl(160, 55%, 49%)" : "#a855f7", scale: 0.7 })
        .setLngLat([sampledWps[0].lng, sampledWps[0].lat])
        .addTo(map);
      const endM = new mapboxgl.Marker({ color: "#a855f7", scale: 0.7 })
        .setLngLat([sampledWps[sampledWps.length - 1].lng, sampledWps[sampledWps.length - 1].lat])
        .addTo(map);
      routeMarkersRef.current.push(startM, endM);

      setWaypoints((prev) => [...prev, ...sampledWps]);
      setSnappedRoute((prev) => [...prev, ...snapped]);

      removePreviewLine();
    };

    map.on("mousedown", onMouseDown);
    map.on("mousemove", onMouseMove);
    map.on("mouseup", onMouseUp);

    map.getCanvas().style.cursor = "crosshair";

    return () => {
      map.off("mousedown", onMouseDown);
      map.off("mousemove", onMouseMove);
      map.off("mouseup", onMouseUp);
      map.dragPan.enable();
      map.getCanvas().style.cursor = "";
    };
  }, [mode, routeMode, drawPreviewLine, removePreviewLine]);

  // Draw the snapped route line
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const routePoints = snappedRoute.length >= 2 ? snappedRoute : waypoints;
    if (routePoints.length < 2) {
      // Remove line if exists
      if (map.getLayer("route-line-layer")) map.removeLayer("route-line-layer");
      if (map.getSource("route-line")) map.removeSource("route-line");
      return;
    }

    const coordinates = routePoints.map((w) => [w.lng, w.lat]);
    const sourceId = "route-line";

    // Wait for style to load
    const updateLine = () => {
      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates },
        });
      } else {
        map.addSource(sourceId, {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } },
        });
        map.addLayer({
          id: "route-line-layer",
          type: "line",
          source: sourceId,
          paint: { "line-color": "#a855f7", "line-width": 4, "line-opacity": 0.85 },
        });
      }
    };

    if (map.isStyleLoaded()) {
      updateLine();
    } else {
      map.once("styledata", updateLine);
    }
  }, [snappedRoute, waypoints]);

  const flyTo = useCallback((lat: number, lng: number) => {
    setCoords({ lat, lng });
    markerRef.current?.setLngLat([lng, lat]);
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 14 });
  }, []);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    const coordMatch = searchQuery.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
      flyTo(parseFloat(coordMatch[1]), parseFloat(coordMatch[2]));
      return;
    }
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${MAPBOX_TOKEN}&limit=1`
      );
      const data = await res.json();
      if (data.features?.length > 0) {
        const [lng, lat] = data.features[0].center;
        flyTo(lat, lng);
        toast.success(`Found: ${data.features[0].place_name}`);
      } else {
        toast.error("Location not found.");
      }
    } catch {
      toast.error("Search failed. Try coordinates (lat, lng).");
    }
  }, [searchQuery, flyTo]);

  const handleSetLocation = useCallback(async () => {
    if (!canSpoof) { toast.error(!connected ? "No device connected." : "Developer Mode is disabled."); return; }
    setSettingLocation(true);
    const res = await setLocation(coords.lat, coords.lng);
    setSettingLocation(false);
    if (res.ok) {
      toast.success("Location set successfully");
      setLocationChanged(true);
      onAddRecent({ lat: coords.lat, lng: coords.lng, label: `${coords.lat}, ${coords.lng}` });
    } else {
      toast.error(res.error || "Failed to set location");
    }
  }, [coords, connected, canSpoof, onAddRecent]);

  const handleResetLocation = useCallback(async () => {
    if (!canSpoof) { toast.error(!connected ? "No device connected." : "Developer Mode is disabled."); return; }
    setResettingLocation(true);
    const res = await resetLocation();
    setResettingLocation(false);
    if (res.ok) {
      toast.success("Location reset");
      setLocationChanged(false);
    } else {
      toast.error(res.error || "Failed to reset location");
    }
  }, [connected, canSpoof]);

  const clearRoute = useCallback(() => {
    routeMarkersRef.current.forEach((m) => m.remove());
    routeMarkersRef.current = [];
    setWaypoints([]);
    setSnappedRoute([]);
    setUndoStack([]);
    const map = mapRef.current;
    if (map?.getLayer("route-line-layer")) map.removeLayer("route-line-layer");
    if (map?.getSource("route-line")) map.removeSource("route-line");
    removePreviewLine();
    if (simulationRef.current) {
      cancelAnimationFrame(simulationRef.current);
      simulationRef.current = null;
    }
    setSimulating(false);
    setSimProgress(0);
  }, [removePreviewLine]);

  // GPX Import
  const handleGpxImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const points = parseGpx(text);
      if (points.length === 0) {
        toast.error("No points found in GPX file");
        return;
      }
      clearRoute();
      setMode("route");
      const map = mapRef.current;
      if (!map) return;

      points.forEach((wp, i) => {
        const m = new mapboxgl.Marker({
          color: i === 0 ? "hsl(160, 55%, 49%)" : "#a855f7",
          scale: 0.7,
        })
          .setLngLat([wp.lng, wp.lat])
          .addTo(map);
        routeMarkersRef.current.push(m);
      });

      setWaypoints(points);
      setSnappedRoute(points);
      map.fitBounds(
        points.reduce(
          (bounds, wp) => bounds.extend([wp.lng, wp.lat]),
          new mapboxgl.LngLatBounds([points[0].lng, points[0].lat], [points[0].lng, points[0].lat])
        ),
        { padding: 80 }
      );
      toast.success(`Imported ${points.length} points from GPX`);
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [clearRoute]);

  const handleGpxExport = useCallback(() => {
    const routePoints = snappedRoute.length >= 2 ? snappedRoute : waypoints;
    if (routePoints.length < 2) {
      toast.error("Add at least 2 waypoints to export");
      return;
    }
    const gpx = exportGpx(routePoints);
    downloadFile(gpx, "geoghost-route.gpx");
    toast.success("GPX file exported");
  }, [snappedRoute, waypoints]);

  const undoLastWaypoint = useCallback(() => {
    if (undoStack.length === 0) return;
    const prevWaypoints = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));

    // Remove excess markers
    const toRemove = routeMarkersRef.current.splice(prevWaypoints.length);
    toRemove.forEach((m) => m.remove());

    setWaypoints(prevWaypoints);
    // Rebuild snapped route
    if (prevWaypoints.length < 2) {
      setSnappedRoute([]);
    } else {
      // Re-snap entire route
      (async () => {
        setIsSnapping(true);
        let allSnapped: Waypoint[] = [prevWaypoints[0]];
        for (let i = 0; i < prevWaypoints.length - 1; i++) {
          const seg = await snapToRoads(prevWaypoints[i], prevWaypoints[i + 1], profile);
          allSnapped = [...allSnapped, ...seg.slice(1)];
        }
        setSnappedRoute(allSnapped);
        setIsSnapping(false);
      })();
    }
  }, [undoStack, profile]);

  const toggleSimulation = useCallback(() => {
    if (simulating) {
      if (simulationRef.current) cancelAnimationFrame(simulationRef.current);
      simulationRef.current = null;
      setSimulating(false);
      return;
    }

    const routePoints = snappedRoute.length >= 2 ? snappedRoute : waypoints;
    if (routePoints.length < 2) { toast.error("Add at least 2 waypoints"); return; }
    if (!canSpoof) { toast.error(!connected ? "No device connected." : "Developer Mode is disabled."); return; }

    const speedKmh = TRANSPORT_SPEEDS[settings.transportMode].speed;
    const TICK_MS = 200;
    const steps: Waypoint[] = [routePoints[0]];

    for (let i = 0; i < routePoints.length - 1; i++) {
      const from = routePoints[i];
      const to = routePoints[i + 1];
      const distKm = haversine(from, to);
      const timeMs = (distKm / speedKmh) * 3600 * 1000;
      const numSteps = Math.max(1, Math.round(timeMs / TICK_MS));
      for (let s = 1; s <= numSteps; s++) {
        const t = s / numSteps;
        steps.push({
          lat: from.lat + (to.lat - from.lat) * t,
          lng: from.lng + (to.lng - from.lng) * t,
        });
      }
    }

    setSimulating(true);
    setSimProgress(0);
    let stepIdx = 0;
    let lastTime = performance.now();

    const animate = (now: number) => {
      if (now - lastTime >= TICK_MS) {
        lastTime = now;
        if (stepIdx >= steps.length) {
          setSimulating(false);
          setSimProgress(100);
          simulationRef.current = null;
          toast.success("Route simulation complete");
          return;
        }
        const step = steps[stepIdx];
        const rounded = {
          lat: parseFloat(step.lat.toFixed(6)),
          lng: parseFloat(step.lng.toFixed(6)),
        };
        setCoords(rounded);
        markerRef.current?.setLngLat([rounded.lng, rounded.lat]);
        stepIdx++;
        setSimProgress(Math.round((stepIdx / steps.length) * 100));
      }
      simulationRef.current = requestAnimationFrame(animate);
    };

    simulationRef.current = requestAnimationFrame(animate);
  }, [simulating, snappedRoute, waypoints, connected, canSpoof, settings.transportMode]);

  // Route stats
  const routePoints = snappedRoute.length >= 2 ? snappedRoute : waypoints;
  const totalKm = routeDistance(routePoints);
  const speed = TRANSPORT_SPEEDS[settings.transportMode].speed;

  return (
    <div className="relative flex-1 overflow-hidden rounded-2xl border border-border/40">
      {/* Search bar */}
      <div className="absolute left-1/2 top-4 z-10 flex w-72 -translate-x-1/2 gap-1.5">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search address or lat, lng..."
          className="h-8 glass text-xs placeholder:text-muted-foreground/60 focus-visible:ring-primary/30"
        />
        <Button size="sm" variant="secondary" onClick={handleSearch} className="h-8 w-8 p-0 glass border-border/60 hover:border-primary/40">
          <Search className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Fav / Recents icons */}
      <div className="absolute right-4 top-4 z-10 flex gap-1.5">
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="secondary" className="h-8 w-8 p-0 glass border-border/60 hover:border-primary/40">
              <Star className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-60 glass-strong p-3" align="end">
            <h4 className="mb-2 text-[11px] font-semibold text-primary tracking-wide uppercase">Favorites</h4>
            {favorites.length === 0 ? (
              <p className="text-xs text-muted-foreground">No favorites yet</p>
            ) : (
              <ul className="max-h-48 space-y-0.5 overflow-y-auto">
                {favorites.map((f) => (
                  <li key={f.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-secondary/60 cursor-pointer transition-colors" onClick={() => flyTo(f.lat, f.lng)}>
                    <span className="truncate text-foreground">{f.label}</span>
                    <button onClick={(e) => { e.stopPropagation(); onRemoveFavorite(f.id); }} className="ml-1 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="secondary" className="h-8 w-8 p-0 glass border-border/60 hover:border-primary/40">
              <Clock className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-60 glass-strong p-3" align="end">
            <h4 className="mb-2 text-[11px] font-semibold text-primary tracking-wide uppercase">Recent</h4>
            {recents.length === 0 ? (
              <p className="text-xs text-muted-foreground">No recent locations</p>
            ) : (
              <ul className="max-h-48 space-y-0.5 overflow-y-auto">
                {recents.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-secondary/60 cursor-pointer text-foreground transition-colors" onClick={() => flyTo(r.lat, r.lng)}>
                    <MapPin className="h-3 w-3 text-primary/60 shrink-0" />
                    <span className="truncate">{r.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Route mode indicator overlay */}
      {mode === "route" && waypoints.length === 0 && !simulating && (
        <div className="absolute left-1/2 top-16 z-10 -translate-x-1/2 pointer-events-none">
          <div className="glass-strong rounded-xl px-4 py-2 text-center animate-fade-in">
            <p className="text-xs text-foreground font-medium">
              {routeMode === "tap" ? "Tap the map to add points to your route" : "Click & drag to draw your route"}
            </p>
          </div>
        </div>
      )}

      {/* Snapping indicator */}
      {isSnapping && (
        <div className="absolute left-1/2 top-16 z-10 -translate-x-1/2">
          <div className="glass-strong rounded-lg px-3 py-1.5 flex items-center gap-2 animate-fade-in">
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
            <span className="text-[11px] text-muted-foreground">Snapping to road...</span>
          </div>
        </div>
      )}

      {/* Map */}
      <div ref={mapContainer} className={`h-full w-full ${mode === "route" && routeMode === "draw" ? "cursor-crosshair" : ""}`} />

      {/* Route mode floating tools */}
      {mode === "route" && !simulating && (
        <div className="absolute bottom-[200px] left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
          <Button
            size="sm"
            variant={routeMode === "tap" ? "default" : "secondary"}
            onClick={() => setRouteMode("tap")}
            className={`h-9 w-9 p-0 rounded-full ${routeMode === "tap" ? "glow-sm" : "glass"}`}
            title="Tap to add points"
          >
            <MousePointerClick className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant={routeMode === "draw" ? "default" : "secondary"}
            onClick={() => setRouteMode("draw")}
            className={`h-9 w-9 p-0 rounded-full ${routeMode === "draw" ? "glow-sm" : "glass"}`}
            title="Draw route"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {undoStack.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={undoLastWaypoint}
              className="h-9 w-9 p-0 rounded-full glass"
              title="Undo"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Bottom controls */}
      <div className="absolute bottom-4 left-4 right-4 z-10">
        <div className="rounded-2xl glass-strong p-4 space-y-3 shadow-2xl shadow-black/30">
          {/* Coordinates */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 rounded-md bg-secondary/50 px-2 py-1">
              <span className="text-muted-foreground text-[10px] uppercase tracking-wider">Lat</span>
              <span className="font-mono text-primary text-[11px]">{coords.lat}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-md bg-secondary/50 px-2 py-1">
              <span className="text-muted-foreground text-[10px] uppercase tracking-wider">Lng</span>
              <span className="font-mono text-primary text-[11px]">{coords.lng}</span>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-7 text-[11px] text-muted-foreground hover:text-primary"
                >
                  <Star className="h-3 w-3 mr-1" /> Save
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 glass-strong p-3" align="end">
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-foreground">Save to Favorites</p>
                  <Input
                    value={favName}
                    onChange={(e) => setFavName(e.target.value)}
                    placeholder="Location name..."
                    className="h-7 text-xs bg-secondary/50 border-border/60"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        onAddFavorite({ lat: coords.lat, lng: coords.lng, label: favName.trim() || `${coords.lat}, ${coords.lng}` });
                        setFavName("");
                        toast.success("Saved to favorites");
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className="w-full h-7 text-[11px]"
                    onClick={() => {
                      onAddFavorite({ lat: coords.lat, lng: coords.lng, label: favName.trim() || `${coords.lat}, ${coords.lng}` });
                      setFavName("");
                      toast.success("Saved to favorites");
                    }}
                  >
                    Save
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Tabs */}
          <Tabs value={mode} onValueChange={(v) => { setMode(v as "static" | "route"); if (v === "static") clearRoute(); }}>
            <TabsList className="h-8 bg-secondary/50 rounded-lg">
              <TabsTrigger value="static" className="text-[11px] h-6 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:glow-sm">Static</TabsTrigger>
              <TabsTrigger value="route" className="text-[11px] h-6 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:glow-sm">Route</TabsTrigger>
            </TabsList>

            <TabsContent value="static" className="mt-2.5">
              <div className="flex gap-2">
                <Button onClick={handleSetLocation} disabled={settingLocation || !canSpoof} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/85 h-9 glow-primary font-medium text-xs">
                  {settingLocation ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
                  Change Location
                </Button>
                {locationChanged && (
                  <Button onClick={handleResetLocation} disabled={resettingLocation || !canSpoof} variant="destructive" className="h-9 text-xs">
                    {resettingLocation ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Reset
                  </Button>
                )}
              </div>
            </TabsContent>

            <TabsContent value="route" className="mt-2.5 space-y-2.5">
              {/* Simulation progress */}
              {simulating && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">Simulating...</span>
                    <span className="text-primary font-mono">{simProgress}%</span>
                  </div>
                  <Progress value={simProgress} className="h-1.5" />
                </div>
              )}

              {/* Stats bar */}
              {waypoints.length >= 2 && !simulating && (
                <div className="flex items-center gap-3 rounded-lg bg-secondary/40 px-3 py-2">
                  <div className="text-center">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Distance</p>
                    <p className="text-sm font-semibold text-foreground">{formatDistance(totalKm)}</p>
                  </div>
                  <div className="h-6 w-px bg-border/40" />
                  <div className="text-center">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Est. Time</p>
                    <p className="text-sm font-semibold text-foreground">{formatEta(totalKm, speed)}</p>
                  </div>
                  <div className="h-6 w-px bg-border/40" />
                  <div className="text-center">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Mode</p>
                    <p className="text-xs font-medium text-foreground">{TRANSPORT_SPEEDS[settings.transportMode].label}</p>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant={simulating ? "destructive" : "default"}
                  onClick={toggleSimulation}
                  disabled={!canSpoof || waypoints.length < 2}
                  className={`flex-1 text-[11px] h-9 ${!simulating ? "glow-sm" : ""}`}
                >
                  {simulating ? <Pause className="h-3.5 w-3.5 mr-1" /> : <Play className="h-3.5 w-3.5 mr-1" />}
                  {simulating ? "Stop" : "Simulate Route"}
                </Button>
                {waypoints.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={clearRoute} className="text-[11px] h-9 text-muted-foreground">
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear
                  </Button>
                )}
              </div>

              {/* GPX Import/Export */}
              <div className="flex gap-1.5">
                <input
                  ref={gpxInputRef}
                  type="file"
                  accept=".gpx"
                  className="hidden"
                  onChange={handleGpxImport}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => gpxInputRef.current?.click()}
                  className="flex-1 text-[11px] h-8 bg-secondary/50"
                >
                  <Upload className="h-3 w-3 mr-1" /> Import GPX
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleGpxExport}
                  disabled={waypoints.length < 2}
                  className="flex-1 text-[11px] h-8 bg-secondary/50"
                >
                  <Download className="h-3 w-3 mr-1" /> Export GPX
                </Button>
              </div>

              <p className="text-[10px] text-muted-foreground">
                {waypoints.length} point{waypoints.length !== 1 ? "s" : ""} · Routes snap to nearby roads
              </p>
            </TabsContent>
          </Tabs>

          {/* Error state */}
          {!canSpoof && (
            <p className="text-[11px] text-destructive/90 rounded-md bg-destructive/8 px-2.5 py-1.5">
              {!connected ? "No device connected." : "Developer Mode is disabled."} Actions disabled.
            </p>
          )}

          
        </div>
      </div>
    </div>
  );
}
