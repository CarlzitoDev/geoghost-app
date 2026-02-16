

# geoghost — Location Spoofing Developer Tool

A dark-themed, desktop-style web app for developer/QA testing of location-based iOS apps. Sleek dark UI with neon green map accents and a minimal sidebar.

---

## Layout & Navigation

### Sidebar (slim, always visible)
- **App name "geoghost"** with a ghost icon at top
- **App** — main page (active by default)
- **Settings icon** at the bottom — clicking it opens a slide-out panel or popover containing Help content (setup guide, troubleshooting, contact)
- Dark background, icon + text items, neon green active indicator

### Settings / Help Panel
- Opens as a slide-out drawer or popover from the settings icon (not a separate page)
- **Getting Started**: step-by-step guide (connect via USB, Trust, Developer Mode)
- **Troubleshooting**: device not detected, permission denied, connection drops
- **Contact**: "Open an issue on GitHub" placeholder link
- Can be dismissed by clicking outside or a close button

---

## App Page (single main page)

### 1. Device Status Indicator
- Compact status chip in the top area showing connection state
- **Connected**: green dot + device name
- **Not Connected**: red/yellow dot + "No Device"
- Clicking expands a **Device Detail Card** with:
  - Device name, iOS version, connection type (USB)
  - Refresh button
  - When disconnected: checklist (USB, Trust, Developer Mode)
- Mock API: simulates `GET /api/device/status`

### 2. Map Panel (full main area)
- **Mapbox GL JS** map with dark/neon-green styling
- Draggable pin/marker to select location
- **Search bar** at top center for city/address/coordinates
- **Coordinates display** showing selected lat/lng
- **Static / Route toggle** tabs:
  - **Static**: set a single GPS coordinate
  - **Route**: define waypoints, see route line, play/pause movement simulation
- **"Change Location"** button (green) and **"Reset Location"** button (pink/red)
- Loading spinners and toast notifications on success/error
- If device not connected: inline error "No device connected."
- Small disclaimer: "For developer/QA testing only."

### 3. Favorites & Recents
- Accessible via bookmark/history icons on the map
- **Favorites**: saved locations with add/remove, persisted in localStorage
- **Recents**: last 10 auto-saved, persisted in localStorage
- Clicking an item moves the pin and updates coordinates

---

## Mock API Layer
- All calls simulated client-side, no backend
- `GET /api/device/status` — mock device info, toggleable state
- `POST /api/location/set` — accepts `{ lat, lng, label? }`, returns `{ ok: true }`
- `POST /api/location/reset` — returns `{ ok: true }`
- Error states when device disconnected

## Design & UX
- Dark theme throughout, neon green accents
- Rounded cards, soft shadows, clean spacing
- Toast notifications (sonner) for all actions
- Loading states on buttons
- Mapbox dark style matching mockup aesthetic
- localStorage persistence for favorites and recents

