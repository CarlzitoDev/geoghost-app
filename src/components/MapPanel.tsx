import { useRef, useEffect, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Search, Star, Clock, MapPin, Navigation, Play, Pause, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { toast } from "sonner";
import { setLocation, resetLocation, type DeviceStatus } from "@/lib/mock-api";
import { type SavedLocation } from "@/hooks/use-location-storage";

const MAPBOX_TOKEN = "YOUR_MAPBOX_TOKEN";
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
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const routeMarkersRef = useRef<mapboxgl.Marker[]>([]);

  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: 37.7749, lng: -122.4194 });
  const [searchQuery, setSearchQuery] = useState("");
  const [settingLocation, setSettingLocation] = useState(false);
  const [resettingLocation, setResettingLocation] = useState(false);
  const [mode, setMode] = useState<"static" | "route">("static");
  const [waypoints, setWaypoints] = useState<{ lat: number; lng: number }[]>([]);
  const [simulating, setSimulating] = useState(false);
  const simulationRef = useRef<number | null>(null);
  const simulationIndex = useRef(0);

  const connected = deviceStatus?.connected ?? false;

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

    const marker = new mapboxgl.Marker({ color: "#39e75f", draggable: true })
      .setLngLat(DEFAULT_CENTER)
      .addTo(map);

    marker.on("dragend", () => {
      const lngLat = marker.getLngLat();
      setCoords({ lat: parseFloat(lngLat.lat.toFixed(6)), lng: parseFloat(lngLat.lng.toFixed(6)) });
    });

    map.on("click", (e) => {
      const { lat, lng } = e.lngLat;
      marker.setLngLat([lng, lat]);
      setCoords({ lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)) });
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  const flyTo = useCallback((lat: number, lng: number) => {
    setCoords({ lat, lng });
    markerRef.current?.setLngLat([lng, lat]);
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 14 });
  }, []);

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return;
    // Try parsing coordinates
    const coordMatch = searchQuery.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      flyTo(lat, lng);
      return;
    }
    // Mock geocoding
    const mockLocations: Record<string, [number, number]> = {
      "san francisco": [37.7749, -122.4194],
      "new york": [40.7128, -74.006],
      "london": [51.5074, -0.1278],
      "tokyo": [35.6762, 139.6503],
      "paris": [48.8566, 2.3522],
      "sydney": [-33.8688, 151.2093],
      "berlin": [52.52, 13.405],
      "los angeles": [34.0522, -118.2437],
    };
    const key = searchQuery.toLowerCase().trim();
    const found = Object.entries(mockLocations).find(([k]) => key.includes(k));
    if (found) {
      flyTo(found[1][0], found[1][1]);
      toast.success(`Found: ${found[0]}`);
    } else {
      toast.error("Location not found. Try coordinates (lat, lng).");
    }
  }, [searchQuery, flyTo]);

  const handleSetLocation = useCallback(async () => {
    if (!connected) { toast.error("No device connected."); return; }
    setSettingLocation(true);
    const res = await setLocation(coords.lat, coords.lng);
    setSettingLocation(false);
    if (res.ok) {
      toast.success("Location set successfully");
      onAddRecent({ lat: coords.lat, lng: coords.lng, label: `${coords.lat}, ${coords.lng}` });
    } else {
      toast.error(res.error || "Failed to set location");
    }
  }, [coords, connected, onAddRecent]);

  const handleResetLocation = useCallback(async () => {
    if (!connected) { toast.error("No device connected."); return; }
    setResettingLocation(true);
    const res = await resetLocation();
    setResettingLocation(false);
    if (res.ok) {
      toast.success("Location reset");
    } else {
      toast.error(res.error || "Failed to reset location");
    }
  }, [connected]);

  // Route mode: add waypoint
  const addWaypoint = useCallback(() => {
    const wp = { lat: coords.lat, lng: coords.lng };
    setWaypoints((prev) => [...prev, wp]);
    if (mapRef.current) {
      const m = new mapboxgl.Marker({ color: "#a855f7", scale: 0.7 })
        .setLngLat([wp.lng, wp.lat])
        .addTo(mapRef.current);
      routeMarkersRef.current.push(m);
      // Draw route line
      drawRoute([...waypoints, wp]);
    }
  }, [coords, waypoints]);

  const drawRoute = useCallback((wps: { lat: number; lng: number }[]) => {
    const map = mapRef.current;
    if (!map || wps.length < 2) return;
    const sourceId = "route-line";
    const coordinates = wps.map((w) => [w.lng, w.lat]);
    if (map.getSource(sourceId)) {
      (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates },
      });
    } else {
      map.addSource(sourceId, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates },
        },
      });
      map.addLayer({
        id: "route-line-layer",
        type: "line",
        source: sourceId,
        paint: {
          "line-color": "#a855f7",
          "line-width": 3,
          "line-dasharray": [2, 2],
        },
      });
    }
  }, []);

  const clearRoute = useCallback(() => {
    routeMarkersRef.current.forEach((m) => m.remove());
    routeMarkersRef.current = [];
    setWaypoints([]);
    const map = mapRef.current;
    if (map?.getLayer("route-line-layer")) map.removeLayer("route-line-layer");
    if (map?.getSource("route-line")) map.removeSource("route-line");
    if (simulationRef.current) {
      clearInterval(simulationRef.current);
      simulationRef.current = null;
    }
    setSimulating(false);
  }, []);

  const toggleSimulation = useCallback(() => {
    if (simulating) {
      if (simulationRef.current) clearInterval(simulationRef.current);
      simulationRef.current = null;
      setSimulating(false);
      return;
    }
    if (waypoints.length < 2) { toast.error("Add at least 2 waypoints"); return; }
    if (!connected) { toast.error("No device connected."); return; }
    setSimulating(true);
    simulationIndex.current = 0;
    simulationRef.current = window.setInterval(() => {
      const idx = simulationIndex.current;
      if (idx >= waypoints.length) {
        clearInterval(simulationRef.current!);
        simulationRef.current = null;
        setSimulating(false);
        toast.success("Route simulation complete");
        return;
      }
      const wp = waypoints[idx];
      flyTo(wp.lat, wp.lng);
      simulationIndex.current++;
    }, 1500);
  }, [simulating, waypoints, connected, flyTo]);

  return (
    <div className="relative flex-1 overflow-hidden rounded-xl border border-border">
      {/* Search bar */}
      <div className="absolute left-1/2 top-4 z-10 flex w-80 -translate-x-1/2 gap-1">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search city or lat, lng..."
          className="h-9 bg-card/90 backdrop-blur-sm text-sm border-border"
        />
        <Button size="sm" variant="secondary" onClick={handleSearch} className="h-9 w-9 p-0">
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {/* Fav / Recents icons */}
      <div className="absolute right-4 top-4 z-10 flex gap-1">
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="secondary" className="h-9 w-9 p-0">
              <Star className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 bg-card border-border p-3" align="end">
            <h4 className="mb-2 text-xs font-semibold text-primary">Favorites</h4>
            {favorites.length === 0 ? (
              <p className="text-xs text-muted-foreground">No favorites yet</p>
            ) : (
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {favorites.map((f) => (
                  <li key={f.id} className="flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-secondary cursor-pointer" onClick={() => flyTo(f.lat, f.lng)}>
                    <span className="truncate text-foreground">{f.label}</span>
                    <button onClick={(e) => { e.stopPropagation(); onRemoveFavorite(f.id); }} className="ml-1 text-muted-foreground hover:text-destructive">
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
            <Button size="sm" variant="secondary" className="h-9 w-9 p-0">
              <Clock className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 bg-card border-border p-3" align="end">
            <h4 className="mb-2 text-xs font-semibold text-primary">Recent Locations</h4>
            {recents.length === 0 ? (
              <p className="text-xs text-muted-foreground">No recent locations</p>
            ) : (
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {recents.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-secondary cursor-pointer text-foreground" onClick={() => flyTo(r.lat, r.lng)}>
                    <MapPin className="h-3 w-3 text-primary shrink-0" />
                    <span className="truncate">{r.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Map */}
      <div ref={mapContainer} className="h-full w-full" />

      {/* Bottom controls */}
      <div className="absolute bottom-4 left-4 right-4 z-10">
        <div className="rounded-xl border border-border bg-card/95 backdrop-blur-sm p-4 space-y-3">
          {/* Coordinates */}
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">Lat:</span>
            <span className="font-mono text-primary">{coords.lat}</span>
            <span className="text-muted-foreground">Lng:</span>
            <span className="font-mono text-primary">{coords.lng}</span>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-7 text-xs text-muted-foreground"
              onClick={() => onAddFavorite({ lat: coords.lat, lng: coords.lng, label: `${coords.lat}, ${coords.lng}` })}
            >
              <Star className="h-3 w-3 mr-1" /> Save
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as "static" | "route")}>
            <TabsList className="h-8 bg-secondary">
              <TabsTrigger value="static" className="text-xs h-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Static</TabsTrigger>
              <TabsTrigger value="route" className="text-xs h-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Route</TabsTrigger>
            </TabsList>

            <TabsContent value="static" className="mt-2">
              <div className="flex gap-2">
                <Button onClick={handleSetLocation} disabled={settingLocation} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 h-9">
                  {settingLocation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
                  Change Location
                </Button>
                <Button onClick={handleResetLocation} disabled={resettingLocation} variant="destructive" className="h-9">
                  {resettingLocation ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Reset
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="route" className="mt-2 space-y-2">
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={addWaypoint} className="text-xs h-8">
                  <Plus className="h-3 w-3 mr-1" /> Add Waypoint
                </Button>
                <Button size="sm" variant={simulating ? "destructive" : "default"} onClick={toggleSimulation} className="text-xs h-8">
                  {simulating ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                  {simulating ? "Stop" : "Simulate"}
                </Button>
                {waypoints.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={clearRoute} className="text-xs h-8 text-muted-foreground">
                    <Trash2 className="h-3 w-3 mr-1" /> Clear
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">{waypoints.length} waypoint{waypoints.length !== 1 ? "s" : ""} added</p>
            </TabsContent>
          </Tabs>

          {/* Error state */}
          {!connected && (
            <p className="text-xs text-destructive">⚠ No device connected. Set/Reset disabled.</p>
          )}

          <p className="text-[10px] text-muted-foreground text-center">For developer/QA testing only.</p>
        </div>
      </div>
    </div>
  );
}
