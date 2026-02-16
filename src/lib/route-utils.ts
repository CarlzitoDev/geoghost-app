import mapboxgl from "mapbox-gl";

const MAPBOX_TOKEN = "pk.eyJ1IjoiY2FybHppdG8iLCJhIjoiY21scGRkMWRsMWFtODNlcXcwa25yNnprcSJ9.KE1oBQcON-JrySAX_HlKKg";

export type Waypoint = { lat: number; lng: number };

/** Haversine distance between two points in km */
export function haversine(a: Waypoint, b: Waypoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Total route distance in km */
export function routeDistance(wps: Waypoint[]): number {
  return wps.reduce((sum, wp, i) => (i === 0 ? 0 : sum + haversine(wps[i - 1], wp)), 0);
}

/** Format distance for display */
export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/** Format ETA for display */
export function formatEta(km: number, speedKmh: number): string {
  const totalMin = Math.round((km / speedKmh) * 60);
  if (totalMin < 1) return "<1 min";
  if (totalMin < 60) return `${totalMin} min`;
  return `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`;
}

/**
 * Snap a route segment to roads using Mapbox Directions API.
 * Returns the snapped coordinates, or falls back to straight line.
 */
export async function snapToRoads(
  from: Waypoint,
  to: Waypoint,
  profile: "walking" | "cycling" | "driving" = "walking"
): Promise<Waypoint[]> {
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
      const coords = data.routes[0].geometry.coordinates as [number, number][];
      return coords.map(([lng, lat]) => ({ lat, lng }));
    }
  } catch {
    // Fall back to straight line
  }
  return [from, to];
}

/** 
 * Snap a freehand drawn path to roads using Mapbox Map Matching API.
 * Samples the path to max 100 points (API limit).
 */
export async function snapDrawnPath(
  points: Waypoint[],
  profile: "walking" | "cycling" | "driving" = "walking"
): Promise<Waypoint[]> {
  if (points.length < 2) return points;
  
  // Sample down to max 100 points
  let sampled = points;
  if (points.length > 100) {
    const step = (points.length - 1) / 99;
    sampled = Array.from({ length: 100 }, (_, i) => points[Math.round(i * step)]);
  }
  
  const coordStr = sampled.map((p) => `${p.lng},${p.lat}`).join(";");
  const radiuses = sampled.map(() => "25").join(";");
  
  try {
    const url = `https://api.mapbox.com/matching/v5/mapbox/${profile}/${coordStr}?geometries=geojson&overview=full&radiuses=${radiuses}&access_token=${MAPBOX_TOKEN}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.matchings && data.matchings.length > 0) {
      const coords = data.matchings[0].geometry.coordinates as [number, number][];
      return coords.map(([lng, lat]) => ({ lat, lng }));
    }
  } catch {
    // Fall back to raw points
  }
  return points;
}

/** Map transport mode to Mapbox profile */
export function transportToProfile(mode: string): "walking" | "cycling" | "driving" {
  switch (mode) {
    case "bike": return "cycling";
    case "drive": return "driving";
    default: return "walking";
  }
}
