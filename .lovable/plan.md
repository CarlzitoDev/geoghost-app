
# Package GeoGhost as a Desktop .exe

Since Lovable is a web-based editor, it **cannot** run Electron, install native dependencies, or build `.exe` files. This needs to be done on your local machine. Here's the exact step-by-step:

## Prerequisites

- **Node.js** (v18+) installed on your PC
- **Git** installed
- **Python 3** + `pymobiledevice3` installed (`pip3 install pymobiledevice3`)

## Steps

### 1. Clone your repo

```text
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
```

### 2. Install dependencies

```text
npm install
npm install --save-dev electron electron-builder concurrently wait-on
```

### 3. Update `package.json`

Add these fields at the top level:

```text
"main": "electron/main.js",
```

Add/replace these scripts:

```text
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "electron:dev": "concurrently \"vite\" \"wait-on http://localhost:5173 && cross-env ELECTRON_DEV=true electron .\"",
  "electron:build": "vite build && electron-builder --win"
}
```

Add a `build` config for electron-builder:

```text
"build": {
  "appId": "com.geoghost.app",
  "productName": "GeoGhost",
  "directories": {
    "output": "release"
  },
  "files": [
    "dist/**/*",
    "electron/**/*"
  ],
  "win": {
    "target": "nsis",
    "icon": "public/favicon.ico"
  }
}
```

### 4. Fix Vite config for Electron

In `vite.config.ts`, change the dev server port to `5173` (or update the Electron `main.js` URL to match port `8080`). The simplest fix: in `electron/main.js`, change `http://localhost:5173` to `http://localhost:8080`.

Also add `base: "./"` to `vite.config.ts` so built files use relative paths:

```text
export default defineConfig(({ mode }) => ({
  base: "./",
  ...
}));
```

### 5. Test in dev mode

```text
npm run electron:dev
```

This opens your app in a native window. Connect your iPhone via USB to test real location spoofing.

### 6. Build the .exe

```text
npm run electron:build
```

Your installer will appear in the `release/` folder as a `.exe` file.

## Summary

| Step | Where | Command |
|------|-------|---------|
| Clone repo | Your PC terminal | `git clone ...` |
| Install deps | Your PC terminal | `npm install && npm install -D electron electron-builder concurrently wait-on` |
| Edit package.json | Your code editor | Add main, scripts, build config |
| Dev test | Your PC terminal | `npm run electron:dev` |
| Build .exe | Your PC terminal | `npm run electron:build` |

All the Electron files (`electron/main.js`, `electron/preload.js`) and the device API (`src/lib/device-api.ts`) are already in your GitHub repo from our earlier work. You just need to install the Electron packages locally and build.
