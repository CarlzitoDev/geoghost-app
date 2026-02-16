import { type Waypoint } from "./route-utils";

/** Parse a GPX file string into an array of waypoints */
export function parseGpx(gpxString: string): Waypoint[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(gpxString, "application/xml");
  const points: Waypoint[] = [];

  // Try track points first
  const trkpts = doc.querySelectorAll("trkpt");
  if (trkpts.length > 0) {
    trkpts.forEach((pt) => {
      const lat = parseFloat(pt.getAttribute("lat") || "0");
      const lng = parseFloat(pt.getAttribute("lon") || "0");
      if (!isNaN(lat) && !isNaN(lng)) points.push({ lat, lng });
    });
    return points;
  }

  // Try route points
  const rtepts = doc.querySelectorAll("rtept");
  if (rtepts.length > 0) {
    rtepts.forEach((pt) => {
      const lat = parseFloat(pt.getAttribute("lat") || "0");
      const lng = parseFloat(pt.getAttribute("lon") || "0");
      if (!isNaN(lat) && !isNaN(lng)) points.push({ lat, lng });
    });
    return points;
  }

  // Try waypoints
  const wpts = doc.querySelectorAll("wpt");
  wpts.forEach((pt) => {
    const lat = parseFloat(pt.getAttribute("lat") || "0");
    const lng = parseFloat(pt.getAttribute("lon") || "0");
    if (!isNaN(lat) && !isNaN(lng)) points.push({ lat, lng });
  });

  return points;
}

/** Export waypoints to a GPX file string */
export function exportGpx(waypoints: Waypoint[], name = "geoghost-route"): string {
  const trkpts = waypoints
    .map((wp) => `      <trkpt lat="${wp.lat}" lon="${wp.lng}" />`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="geoghost">
  <trk>
    <name>${name}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

/** Trigger a file download */
export function downloadFile(content: string, filename: string, mimeType = "application/gpx+xml") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
