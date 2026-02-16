const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { exec, execSync } = require("child_process");

let mainWindow;

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

  // In dev, load Vite dev server; in prod, load built files
  const isDev = process.env.ELECTRON_DEV === "true";
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
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

// ─── Helper: run a shell command and return stdout ───
function run(cmd) {
  return new Promise((resolve, reject) => {
    // Ensure PATH includes common locations for pymobiledevice3
    const env = {
      ...process.env,
      PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin:/Users/${process.env.USER}/.local/bin:/Users/${process.env.USER}/Library/Python/3.11/bin:/Users/${process.env.USER}/Library/Python/3.12/bin:/Users/${process.env.USER}/Library/Python/3.13/bin`,
    };
    exec(cmd, { timeout: 15000, env }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout.trim());
    });
  });
}

// ─── Check if pymobiledevice3 is installed ───
function hasPyMobileDevice() {
  try {
    execSync("pymobiledevice3 --help", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// ─── IPC Handlers ───

// Get connected device status
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
    // Try JSON output first
    let output;
    try {
      output = await run("pymobiledevice3 usbmux list --no-color -o json");
    } catch {
      // Fallback: try without flags
      output = await run("pymobiledevice3 usbmux list");
    }

    let devices;
    try {
      devices = JSON.parse(output);
    } catch {
      // If JSON parsing fails, the device list might be in a different format
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

    // Handle both array and object responses
    const deviceList = Array.isArray(devices) ? devices : [devices];

    if (!deviceList || deviceList.length === 0) {
      return { connected: false, name: "", ios: "", connection: "", developerMode: false };
    }

    const device = deviceList[0];
    return {
      connected: true,
      name: device.DeviceName || device.ProductType || device.Name || "iOS Device",
      ios: device.ProductVersion || device.iOSVersion || "",
      connection: "USB",
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

// Set simulated location
ipcMain.handle("location:set", async (_event, { lat, lng }) => {
  try {
    await run(
      `pymobiledevice3 developer dvt simulate-location set -- ${lat} ${lng}`
    );
    return { ok: true };
  } catch (err) {
    // Fallback for older iOS / different command structure
    try {
      await run(
        `pymobiledevice3 developer simulate-location set -- ${lat} ${lng}`
      );
      return { ok: true };
    } catch (err2) {
      return { ok: false, error: err2.message };
    }
  }
});

// Reset (clear) simulated location
ipcMain.handle("location:reset", async () => {
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
