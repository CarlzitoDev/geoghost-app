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
import { useSettings } from "@/hooks/use-settings";

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

  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: 37.7749, lng: -122.4194 });
  const [searchQuery, setSearchQuery] = useState("");
  const [settingLocation, setSettingLocation] = useState(false);
  const [resettingLocation, setResettingLocation] = useState(false);
  const [locationChanged, setLocationChanged] = useState(false);
  const [mode, setMode] = useState<"static" | "route">("static");
  const [waypoints, setWaypoints] = useState<{ lat: number; lng: number }[]>([]);
  const [simulating, setSimulating] = useState(false);
  const simulationRef = useRef<number | null>(null);
  const simulationIndex = useRef(0);

  const connected = deviceStatus?.connected ?? false;
  const devMode = deviceStatus?.developerMode ?? false;
  const canSpoof = connected && devMode;

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

  // Switch map style when setting changes
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

  const flyTo = useCallback((lat: number, lng: number) => {
    setCoords({ lat, lng });
    markerRef.current?.setLngLat([lng, lat]);
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 14 });
  }, []);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    // Try parsing coordinates first
    const coordMatch = searchQuery.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      flyTo(lat, lng);
      return;
    }
    // Use Mapbox Geocoding API
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${MAPBOX_TOKEN}&limit=1`
      );
      const data = await res.json();
      if (data.features && data.features.length > 0) {
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
  }, [coords, connected, onAddRecent]);

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
    if (!canSpoof) { toast.error(!connected ? "No device connected." : "Developer Mode is disabled."); return; }
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
    }, settings.simulationSpeed * 1000);
  }, [simulating, waypoints, connected, flyTo]);

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

      {/* Map */}
      <div ref={mapContainer} className="h-full w-full" />

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
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-7 text-[11px] text-muted-foreground hover:text-primary"
              onClick={() => onAddFavorite({ lat: coords.lat, lng: coords.lng, label: `${coords.lat}, ${coords.lng}` })}
            >
              <Star className="h-3 w-3 mr-1" /> Save
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as "static" | "route")}>
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

            <TabsContent value="route" className="mt-2.5 space-y-2">
              <div className="flex gap-1.5">
                <Button size="sm" variant="secondary" onClick={addWaypoint} className="text-[11px] h-8">
                  <Plus className="h-3 w-3 mr-1" /> Waypoint
                </Button>
                <Button size="sm" variant={simulating ? "destructive" : "default"} onClick={toggleSimulation} disabled={!canSpoof} className={`text-[11px] h-8 ${!simulating ? "glow-sm" : ""}`}>
                  {simulating ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                  {simulating ? "Stop" : "Simulate"}
                </Button>
                {waypoints.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={clearRoute} className="text-[11px] h-8 text-muted-foreground">
                    <Trash2 className="h-3 w-3 mr-1" /> Clear
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">{waypoints.length} waypoint{waypoints.length !== 1 ? "s" : ""}</p>
            </TabsContent>
          </Tabs>

          {/* Error state */}
          {!canSpoof && (
            <p className="text-[11px] text-destructive/90 rounded-md bg-destructive/8 px-2.5 py-1.5">
              {!connected ? "⚠ No device connected." : "⚠ Developer Mode is disabled."} Actions disabled.
            </p>
          )}

          <p className="text-[9px] text-muted-foreground/60 text-center tracking-wide uppercase">For developer/QA testing only</p>
        </div>
      </div>
    </div>
  );
}
