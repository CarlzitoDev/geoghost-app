const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { exec, execSync, spawn } = require("child_process");

let mainWindow;
let tunnelProcess = null;
let rsdHost = null;
let rsdPort = null;

const PMD_PATH_EXTRAS = ":/usr/local/bin:/opt/homebrew/bin:/Library/Frameworks/Python.framework/Versions/3.14/bin";

function getEnv() {
  return {
    ...process.env,
    PATH: `${process.env.PATH}${PMD_PATH_EXTRAS}:/Users/${process.env.USER}/.local/bin:/Users/${process.env.USER}/Library/Python/3.11/bin:/Users/${process.env.USER}/Library/Python/3.12/bin:/Users/${process.env.USER}/Library/Python/3.13/bin:/Users/${process.env.USER}/Library/Python/3.14/bin`,
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "geoghost",
    backgroundColor: "#080808",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = process.env.ELECTRON_DEV === "true";
  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_URL || "http://localhost:8080");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on("before-quit", () => {
  if (tunnelProcess) {
    tunnelProcess.kill();
    tunnelProcess = null;
  }
});

// ─── Helper: run a shell command and return stdout ───
function run(cmd, timeout = 15000) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout, env: getEnv() }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout.trim());
    });
  });
}

// ─── Check if pymobiledevice3 is installed ───
function hasPyMobileDevice() {
  try {
    execSync("pymobiledevice3 --help", { stdio: "ignore", env: getEnv() });
    return true;
  } catch {
    return false;
  }
}

// ─── Tunnel management for iOS 17+ ───
function startTunnel() {
  return new Promise((resolve, reject) => {
    if (tunnelProcess) {
      // Already running
      if (rsdHost && rsdPort) return resolve({ host: rsdHost, port: rsdPort });
      tunnelProcess.kill();
      tunnelProcess = null;
    }

    console.log("Starting pymobiledevice3 remote tunnel...");

    // Try without sudo first using start-quic-tunnel, fall back to start-tunnel
    const tryStart = (useQuic) => {
      const cmd = useQuic ? "start-quic-tunnel" : "start-tunnel";
      const proc = spawn("pymobiledevice3", ["remote", cmd], {
        env: getEnv(),
        stdio: ["ignore", "pipe", "pipe"],
      });

      let output = "";
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          // If we got output but couldn't parse, try sudo start-tunnel
          if (!useQuic) {
            proc.kill();
            reject(new Error("Tunnel timed out. You may need to run: sudo pymobiledevice3 remote start-tunnel"));
          } else {
            proc.kill();
            tryStart(false);
          }
        }
      }, 10000);

      proc.stdout.on("data", (data) => {
        output += data.toString();
        console.log("Tunnel stdout:", data.toString());

        // Parse RSD Address and Port from output
        const hostMatch = output.match(/RSD Address:\s*(\S+)/);
        const portMatch = output.match(/RSD Port:\s*(\d+)/);

        if (hostMatch && portMatch && !resolved) {
          resolved = true;
          clearTimeout(timeout);
          rsdHost = hostMatch[1];
          rsdPort = portMatch[1];
          tunnelProcess = proc;
          console.log(`Tunnel established: --rsd ${rsdHost} ${rsdPort}`);
          resolve({ host: rsdHost, port: rsdPort });
        }
      });

      proc.stderr.on("data", (data) => {
        console.log("Tunnel stderr:", data.toString());
      });

      proc.on("close", (code) => {
        console.log(`Tunnel process exited with code ${code}`);
        if (tunnelProcess === proc) {
          tunnelProcess = null;
          rsdHost = null;
          rsdPort = null;
        }
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          if (useQuic) {
            // Try non-quic
            tryStart(false);
          } else {
            reject(new Error("Tunnel closed. Try running manually: sudo pymobiledevice3 remote start-tunnel"));
          }
        }
      });
    };

    tryStart(true);
  });
}

// ─── Helper: get device UDID ───
let cachedUDID = null;

async function getDeviceUDID() {
  if (cachedUDID) return cachedUDID;
  try {
    const output = await run("pymobiledevice3 usbmux list --no-color -o json");
    const devices = JSON.parse(output);
    const list = Array.isArray(devices) ? devices : [devices];
    if (list.length > 0) {
      cachedUDID = list[0].UniqueDeviceID || list[0].SerialNumber || list[0].UDID || null;
      return cachedUDID;
    }
  } catch {}
  return null;
}

// ─── Helper: discover external tunnel RSD params ───
async function discoverExternalTunnel() {
  // Try querying tunneld HTTP API (if user runs `pymobiledevice3 remote tunneld`)
  try {
    const http = require("http");
    const data = await new Promise((resolve, reject) => {
      const req = http.get("http://127.0.0.1:49151/tunnels", { timeout: 2000 }, (res) => {
        let body = "";
        res.on("data", (chunk) => body += chunk);
        res.on("end", () => resolve(body));
      });
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    });
    const tunnels = JSON.parse(data);
    // tunneld returns a list/dict of active tunnels with host/port
    if (Array.isArray(tunnels) && tunnels.length > 0) {
      const t = tunnels[0];
      if (t.address && t.port) {
        console.log(`[geoghost] Discovered tunnel via tunneld: ${t.address} ${t.port}`);
        return { host: t.address, port: t.port };
      }
    } else if (tunnels && typeof tunnels === "object") {
      const keys = Object.keys(tunnels);
      if (keys.length > 0) {
        const t = tunnels[keys[0]];
        if (t && t.address && t.port) {
          console.log(`[geoghost] Discovered tunnel via tunneld: ${t.address} ${t.port}`);
          return { host: t.address, port: t.port };
        }
      }
    }
  } catch (err) {
    console.log("[geoghost] tunneld not running or not responding:", err.message);
  }

  // Try parsing network interfaces for fd-prefixed IPv6 on utun (external start-tunnel)
  try {
    const ifOutput = await run("ifconfig", 5000);
    const utunBlocks = ifOutput.split(/(?=^utun)/m);
    for (const block of utunBlocks) {
      if (!block.startsWith("utun")) continue;
      const fdMatch = block.match(/inet6\s+(fd[0-9a-f:]+)\s/i);
      if (fdMatch) {
        console.log(`[geoghost] Found potential tunnel interface: ${fdMatch[1]}`);
        // We have the address but not the port — we can't use this alone
        // Store for informational purposes
        return { host: fdMatch[1], port: null };
      }
    }
  } catch {}

  return null;
}

// ─── IPC Handlers ───

ipcMain.handle("device:status", async () => {
  if (!hasPyMobileDevice()) {
    return {
      connected: false,
      name: "",
      ios: "",
      connection: "",
      developerMode: false,
      error: "pymobiledevice3 not installed. Run: pip3 install pymobiledevice3",
    };
  }

  try {
    let output;
    try {
      output = await run("pymobiledevice3 usbmux list --no-color -o json");
    } catch {
      output = await run("pymobiledevice3 usbmux list");
    }

    let devices;
    try {
      devices = JSON.parse(output);
    } catch {
      console.log("pymobiledevice3 raw output:", output);
      if (output && output.length > 0) {
        return {
          connected: true,
          name: "iOS Device",
          ios: "",
          connection: "USB",
          developerMode: true,
        };
      }
      return { connected: false, name: "", ios: "", connection: "", developerMode: false };
    }

    const deviceList = Array.isArray(devices) ? devices : [devices];
    if (!deviceList || deviceList.length === 0) {
      return { connected: false, name: "", ios: "", connection: "", developerMode: false };
    }

    const device = deviceList[0];
    // Cache UDID for tunnel discovery
    cachedUDID = device.UniqueDeviceID || device.SerialNumber || device.UDID || null;
    return {
      connected: true,
      name: device.DeviceName || device.ProductType || device.Name || "iOS Device",
      ios: device.ProductVersion || device.iOSVersion || "",
      connection: device.ConnectionType || "USB",
      developerMode: true,
    };
  } catch (err) {
    console.error("device:status error:", err.message);
    return {
      connected: false,
      name: "",
      ios: "",
      connection: "",
      developerMode: false,
      error: err.message,
    };
  }
});

// Start tunnel (called from renderer before setting location)
ipcMain.handle("tunnel:start", async () => {
  try {
    const { host, port } = await startTunnel();
    return { ok: true, host, port };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("tunnel:status", async () => {
  return {
    active: !!(tunnelProcess && rsdHost && rsdPort),
    host: rsdHost,
    port: rsdPort,
  };
});

// Set simulated location — tries tunnel (iOS 17+) first, falls back to legacy
ipcMain.handle("location:set", async (_event, { lat, lng }) => {
  console.log(`[geoghost] location:set called with lat=${lat}, lng=${lng}`);
  console.log(`[geoghost] Current tunnel state: rsdHost=${rsdHost}, rsdPort=${rsdPort}, tunnelProcess=${!!tunnelProcess}`);

  // Try with existing tunnel first (iOS 17+)
  if (rsdHost && rsdPort) {
    try {
      const cmd = `pymobiledevice3 developer dvt simulate-location set --rsd ${rsdHost} ${rsdPort} -- ${lat} ${lng}`;
      console.log(`[geoghost] Trying RSD: ${cmd}`);
      const output = await run(cmd);
      console.log(`[geoghost] RSD success, output: "${output}"`);
      return { ok: true, method: "rsd-tunnel" };
    } catch (err) {
      console.error("[geoghost] RSD simulate-location failed:", err.message);
    }
  }

  // Try discovering external tunnel (tunneld or start-tunnel)
  try {
    console.log("[geoghost] Trying to discover external tunnel...");
    const discovered = await discoverExternalTunnel();
    if (discovered && discovered.host && discovered.port) {
      const cmd = `pymobiledevice3 developer dvt simulate-location set --rsd ${discovered.host} ${discovered.port} -- ${lat} ${lng}`;
      console.log(`[geoghost] Trying discovered tunnel: ${cmd}`);
      const output = await run(cmd);
      console.log(`[geoghost] Discovered tunnel success, output: "${output}"`);
      // Cache for future use
      rsdHost = discovered.host;
      rsdPort = discovered.port;
      return { ok: true, method: "discovered-tunnel" };
    }
  } catch (err) {
    console.error("[geoghost] Discovered tunnel failed:", err.message);
  }

  // Try --tunnel UDID (works with tunneld daemon)
  try {
    const udid = await getDeviceUDID();
    if (udid) {
      const cmd = `pymobiledevice3 developer dvt simulate-location set --tunnel ${udid} -- ${lat} ${lng}`;
      console.log(`[geoghost] Trying --tunnel ${udid}: ${cmd}`);
      const output = await run(cmd, 20000);
      console.log(`[geoghost] --tunnel success, output: "${output}"`);
      return { ok: true, method: "tunnel-udid" };
    }
  } catch (err) {
    console.error("[geoghost] --tunnel UDID failed:", err.message);
  }

  // Try starting tunnel automatically (needs sudo, likely fails)
  try {
    console.log("[geoghost] Attempting to start own tunnel...");
    const tunnel = await startTunnel();
    const cmd = `pymobiledevice3 developer dvt simulate-location set --rsd ${tunnel.host} ${tunnel.port} -- ${lat} ${lng}`;
    console.log(`[geoghost] Trying new tunnel: ${cmd}`);
    const output = await run(cmd);
    console.log(`[geoghost] New tunnel success, output: "${output}"`);
    return { ok: true, method: "new-tunnel" };
  } catch (err) {
    console.error("[geoghost] Own tunnel failed:", err.message);
  }

  // Legacy fallback (iOS < 17 only)
  const legacyCmds = [
    `pymobiledevice3 developer dvt simulate-location set -- ${lat} ${lng}`,
    `pymobiledevice3 developer simulate-location set -- ${lat} ${lng}`,
  ];

  for (const cmd of legacyCmds) {
    try {
      console.log(`[geoghost] Trying legacy: ${cmd}`);
      const output = await run(cmd);
      console.log(`[geoghost] Legacy success, output: "${output}"`);
      return { ok: true, method: "legacy" };
    } catch (err) {
      console.error(`[geoghost] Legacy failed: ${err.message}`);
    }
  }

  return {
    ok: false,
    error: `All methods failed. For iOS 17+, try one of:\n1. sudo pymobiledevice3 remote tunneld (recommended)\n2. sudo pymobiledevice3 remote start-tunnel\nThen retry in the app.`,
  };
});

// Reset (clear) simulated location
ipcMain.handle("location:reset", async () => {
  // Try with cached tunnel first
  if (rsdHost && rsdPort) {
    try {
      await run(`pymobiledevice3 developer dvt simulate-location clear --rsd ${rsdHost} ${rsdPort}`);
      return { ok: true };
    } catch (err) {
      console.error("RSD clear location failed:", err.message);
    }
  }

  // Try discovering external tunnel
  try {
    const discovered = await discoverExternalTunnel();
    if (discovered && discovered.host && discovered.port) {
      await run(`pymobiledevice3 developer dvt simulate-location clear --rsd ${discovered.host} ${discovered.port}`);
      return { ok: true };
    }
  } catch {}

  // Try --tunnel UDID
  try {
    const udid = await getDeviceUDID();
    if (udid) {
      await run(`pymobiledevice3 developer dvt simulate-location clear --tunnel ${udid}`, 20000);
      return { ok: true };
    }
  } catch {}

  // Legacy fallbacks
  try {
    await run("pymobiledevice3 developer dvt simulate-location clear");
    return { ok: true };
  } catch {
    try {
      await run("pymobiledevice3 developer simulate-location clear");
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
});

