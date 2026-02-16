const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { exec, execSync, spawn } = require("child_process");

let mainWindow;
let tunnelProcess = null;
let tunneldProcess = null; // The sudo tunneld daemon process
let simLocationProcess = null; // Keep-alive process for simulate-location
let rsdHost = null;
let rsdPort = null;
let tunneldStarted = false; // Track if we already started tunneld

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
  if (simLocationProcess) {
    simLocationProcess.kill();
    simLocationProcess = null;
  }
  if (tunnelProcess) {
    tunnelProcess.kill();
    tunnelProcess = null;
  }
  // Kill tunneld — it runs as root so we need sudo kill
  if (tunneldProcess && tunneldProcess.pid) {
    try {
      execSync(`kill ${tunneldProcess.pid}`, { stdio: "ignore" });
    } catch {}
    tunneldProcess = null;
  }
});

// ─── Auto-start tunneld with sudo ───
function isTunneldRunning() {
  return new Promise((resolve) => {
    const http = require("http");
    const req = http.get("http://127.0.0.1:49151/tunnels", { timeout: 1500 }, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => resolve(true));
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

function startTunneldWithPassword(password) {
  return new Promise(async (resolve, reject) => {
    // Check if already running
    if (await isTunneldRunning()) {
      tunneldStarted = true;
      return resolve({ alreadyRunning: true });
    }

    console.log("[geoghost] Starting tunneld with provided password...");
    const pymPath = getEnv().PATH;

    // Use sudo -S to read password from stdin
    const proc = spawn("sudo", ["-S", "env", `PATH=${pymPath}`, "pymobiledevice3", "remote", "tunneld"], {
      env: getEnv(),
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stderr = "";
    let resolved = false;

    // Write password to stdin
    proc.stdin.write(password + "\n");
    proc.stdin.end();

    // Wait for tunneld to start (check HTTP API)
    const checkInterval = setInterval(async () => {
      if (resolved) return;
      if (await isTunneldRunning()) {
        resolved = true;
        clearInterval(checkInterval);
        clearTimeout(failTimeout);
        tunneldProcess = proc;
        tunneldStarted = true;
        console.log("[geoghost] tunneld is now running");
        resolve({ alreadyRunning: false });
      }
    }, 1000);

    const failTimeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        clearInterval(checkInterval);
        proc.kill();
        reject(new Error(stderr.includes("Sorry") ? "Incorrect password" : stderr || "tunneld failed to start within 15s"));
      }
    }, 15000);

    proc.stderr.on("data", (data) => {
      const text = data.toString();
      // Filter out the password prompt itself
      if (!text.includes("Password:")) {
        stderr += text;
        console.log("[geoghost] tunneld stderr:", text);
      }
      // Detect wrong password immediately
      if (text.includes("Sorry, try again") || text.includes("incorrect password")) {
        resolved = true;
        clearInterval(checkInterval);
        clearTimeout(failTimeout);
        proc.kill();
        reject(new Error("Incorrect password"));
      }
    });

    proc.stdout.on("data", (data) => {
      console.log("[geoghost] tunneld stdout:", data.toString());
    });

    proc.on("close", (code) => {
      console.log(`[geoghost] tunneld process exited with code ${code}`);
      if (tunneldProcess === proc) {
        tunneldProcess = null;
        tunneldStarted = false;
      }
      if (!resolved) {
        resolved = true;
        clearInterval(checkInterval);
        clearTimeout(failTimeout);
        reject(new Error(stderr || `tunneld exited with code ${code}`));
      }
    });
  });
}
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
    console.log("[geoghost] usbmux list raw output:", output.substring(0, 1000));
    const devices = JSON.parse(output);
    const list = Array.isArray(devices) ? devices : [devices];
    console.log("[geoghost] usbmux devices:", JSON.stringify(list.map(d => ({
      UDID: d.UniqueDeviceID || d.UDID,
      Serial: d.SerialNumber,
      Name: d.DeviceName || d.Name,
      Type: d.ProductType || d.DeviceClass,
    }))));
    if (list.length > 0) {
      cachedUDID = list[0].UniqueDeviceID || list[0].SerialNumber || list[0].UDID || null;
      console.log("[geoghost] Cached UDID:", cachedUDID);
      return cachedUDID;
    }
  } catch (err) {
    console.log("[geoghost] getDeviceUDID error:", err.message);
  }
  return null;
}

// ─── Helper: discover external tunnel RSD params ───
async function discoverExternalTunnel() {
  const udid = await getDeviceUDID();
  console.log(`[geoghost] discoverExternalTunnel: looking for UDID=${udid}`);
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
    console.log("[geoghost] tunneld full response:", JSON.stringify(tunnels).substring(0, 2000));

    // tunneld returns an object keyed by UDID or a list
    let tunnelList = [];
    if (Array.isArray(tunnels)) {
      tunnelList = tunnels;
    } else if (tunnels && typeof tunnels === "object") {
      for (const [key, val] of Object.entries(tunnels)) {
        if (val && typeof val === "object") {
          tunnelList.push({ ...val, _key: key });
        }
      }
    }

    console.log(`[geoghost] Found ${tunnelList.length} tunnels. Keys: ${tunnelList.map(t => t._key || "?").join(", ")}`);

    // STRICT: Only match by our USB-connected iPhone's UDID — never fall back to random device
    let match = null;
    if (udid) {
      match = tunnelList.find(t => t._key === udid || t.udid === udid || t.identifier === udid);
    }

    // If no UDID match, try to filter out non-iPhone devices (Macs, AirPods, etc.)
    if (!match && tunnelList.length > 0) {
      // Look for entries that look like an iPhone (exclude keys that look like Mac UDIDs or have no tunnel)
      // Only pick if there's exactly ONE tunnel left after filtering — avoid guessing
      const candidates = tunnelList.filter(t => {
        const key = (t._key || "").toLowerCase();
        const name = (t.name || t.deviceName || "").toLowerCase();
        // Skip entries clearly not an iPhone
        if (name.includes("macbook") || name.includes("imac") || name.includes("mac")) return false;
        if (name.includes("airpods") || name.includes("watch")) return false;
        return t.address && t.port;
      });
      if (candidates.length === 1) {
        match = candidates[0];
        console.log(`[geoghost] Single non-Mac/AirPods candidate found: ${match._key}`);
      } else {
        console.log(`[geoghost] ${candidates.length} candidates after filtering — not picking to avoid wrong device`);
      }
    }

    if (match && match.address && match.port) {
      console.log(`[geoghost] Discovered tunnel via tunneld: ${match.address} ${match.port} (key: ${match._key || "n/a"})`);
      return { host: match.address, port: match.port };
    } else {
      console.log("[geoghost] No matching iPhone tunnel found");
    }
  } catch (err) {
    console.log("[geoghost] tunneld not running or not responding:", err.message);
  }

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

// Check if tunneld is needed (not already running)
ipcMain.handle("tunneld:check", async () => {
  const running = await isTunneldRunning();
  return { needsPassword: !running };
});

// Start tunneld with user-provided password
ipcMain.handle("tunneld:start", async (_event, { password }) => {
  try {
    const result = await startTunneldWithPassword(password);
    return { ok: true, alreadyRunning: result.alreadyRunning };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ─── Helper: spawn a persistent simulate-location process ───
function spawnSimLocation(args) {
  return new Promise((resolve, reject) => {
    // Kill any existing sim-location process
    if (simLocationProcess) {
      simLocationProcess.kill();
      simLocationProcess = null;
    }

    console.log(`[geoghost] Spawning: pymobiledevice3 ${args.join(" ")}`);
    const proc = spawn("pymobiledevice3", args, {
      env: getEnv(),
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    let resolved = false;

    // The process staying alive IS success — give it a moment to error or settle
    const successTimeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        simLocationProcess = proc;
        console.log("[geoghost] simulate-location process is running (kept alive)");
        resolve();
      }
    }, 3000);

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
      console.log("[geoghost] sim-loc stderr:", data.toString());
    });

    proc.stdout.on("data", (data) => {
      console.log("[geoghost] sim-loc stdout:", data.toString());
    });

    proc.on("close", (code) => {
      console.log(`[geoghost] sim-loc process exited with code ${code}`);
      if (simLocationProcess === proc) simLocationProcess = null;
      if (!resolved) {
        resolved = true;
        clearTimeout(successTimeout);
        // Exit code 0 with no stderr is success (legacy mode)
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(stderr || `simulate-location exited with code ${code}`));
        }
      }
    });
  });
}

// Set simulated location — tries tunnel (iOS 17+) first, falls back to legacy
ipcMain.handle("location:set", async (_event, { lat, lng }) => {
  console.log(`[geoghost] location:set called with lat=${lat}, lng=${lng}`);
  console.log(`[geoghost] Current tunnel state: rsdHost=${rsdHost}, rsdPort=${rsdPort}, tunnelProcess=${!!tunnelProcess}`);

  const udid = await getDeviceUDID();
  console.log(`[geoghost] Device UDID for targeting: ${udid}`);

  // Try with existing cached RSD params (iOS 17+)
  if (rsdHost && rsdPort) {
    try {
      const args = ["developer", "dvt", "simulate-location", "set", "--rsd", rsdHost, rsdPort, "--", String(lat), String(lng)];
      console.log(`[geoghost] Trying RSD: pymobiledevice3 ${args.join(" ")}`);
      await spawnSimLocation(args);
      return { ok: true, method: "rsd-tunnel" };
    } catch (err) {
      console.error("[geoghost] RSD simulate-location failed:", err.message);
    }
  }

  // Try discovering external tunnel (tunneld) — ONLY for our iPhone
  try {
    console.log("[geoghost] Trying to discover external tunnel...");
    const discovered = await discoverExternalTunnel();
    if (discovered && discovered.host && discovered.port) {
      const args = ["developer", "dvt", "simulate-location", "set", "--rsd", discovered.host, String(discovered.port), "--", String(lat), String(lng)];
      console.log(`[geoghost] Trying discovered tunnel: pymobiledevice3 ${args.join(" ")}`);
      await spawnSimLocation(args);
      rsdHost = discovered.host;
      rsdPort = discovered.port;
      return { ok: true, method: "discovered-tunnel" };
    }
  } catch (err) {
    console.error("[geoghost] Discovered tunnel failed:", err.message);
  }

  // Try --tunnel UDID (works with tunneld daemon) — ONLY if we have a specific UDID
  if (udid) {
    try {
      const args = ["developer", "dvt", "simulate-location", "set", "--tunnel", udid, "--", String(lat), String(lng)];
      console.log(`[geoghost] Trying --tunnel UDID: pymobiledevice3 ${args.join(" ")}`);
      await spawnSimLocation(args);
      return { ok: true, method: "tunnel-udid" };
    } catch (err) {
      console.error("[geoghost] --tunnel UDID failed:", err.message);
    }
  }

  // Legacy fallback (iOS < 17 only)
  const legacyArgSets = [
    ["developer", "dvt", "simulate-location", "set", "--", String(lat), String(lng)],
    ["developer", "simulate-location", "set", "--", String(lat), String(lng)],
  ];

  for (const args of legacyArgSets) {
    try {
      console.log(`[geoghost] Trying legacy: pymobiledevice3 ${args.join(" ")}`);
      await spawnSimLocation(args);
      return { ok: true, method: "legacy" };
    } catch (err) {
      console.error(`[geoghost] Legacy failed: ${err.message}`);
    }
  }

  return {
    ok: false,
    error: `All methods failed. For iOS 17+, run:\n  sudo pymobiledevice3 remote tunneld\nThen retry.`,
  };
});

// Reset (clear) simulated location
ipcMain.handle("location:reset", async () => {
  // Kill the persistent simulate-location process first
  if (simLocationProcess) {
    console.log("[geoghost] Killing persistent sim-location process");
    simLocationProcess.kill();
    simLocationProcess = null;
  }

  // Also send explicit clear command
  const udid = await getDeviceUDID();

  // Try with cached tunnel first
  if (rsdHost && rsdPort) {
    try {
      await run(`pymobiledevice3 developer dvt simulate-location clear --rsd ${rsdHost} ${rsdPort}`);
      return { ok: true };
    } catch (err) {
      console.error("RSD clear location failed:", err.message);
    }
  }

  // Try --tunnel UDID
  if (udid) {
    try {
      await run(`pymobiledevice3 developer dvt simulate-location clear --tunnel ${udid}`, 20000);
      return { ok: true };
    } catch {}
  }

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

