const { app, BrowserWindow, screen, ipcMain, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");

const BACKEND_PORT = 8000;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;

// Find the backend directory:
// - In dev: ../../backend (relative to electron/)
// - In packaged: process.resourcesPath/backend (extraResources from electron-builder)
function findBackendDir() {
  const devPath = path.join(__dirname, "..", "..", "backend");
  if (fs.existsSync(devPath)) return devPath;
  const prodPath = path.join(process.resourcesPath, "backend");
  if (fs.existsSync(prodPath)) return prodPath;
  return devPath; // fallback
}

const BACKEND_DIR = findBackendDir();

let mainWindow = null;
let backendProcess = null;

function startBackend() {
  const pythonCmd = process.platform === "win32" ? "python" : "python3";

  backendProcess = spawn(pythonCmd, ["main.py"], {
    cwd: BACKEND_DIR,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
  });

  backendProcess.stdout.on("data", (data) => {
    console.log(`[backend] ${data.toString().trim()}`);
  });

  backendProcess.stderr.on("data", (data) => {
    console.log(`[backend] ${data.toString().trim()}`);
  });

  backendProcess.on("error", (err) => {
    console.error(`[backend] Failed to start: ${err.message}`);
  });

  backendProcess.on("exit", (code) => {
    console.log(`[backend] Exited with code ${code}`);
    backendProcess = null;
  });
}

function waitForBackend(maxRetries = 30) {
  return new Promise((resolve, reject) => {
    let retries = 0;

    function check() {
      const req = http.get(`${BACKEND_URL}/api/status`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      });
      req.on("error", retry);
      req.setTimeout(1000, retry);
    }

    function retry() {
      retries++;
      if (retries >= maxRetries) {
        reject(new Error("Backend did not start in time"));
        return;
      }
      setTimeout(check, 500);
    }

    check();
  });
}

function createWindow() {
  const { width: screenW, height: screenH } =
    screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: screenW,
    height: screenH,
    minWidth: 320,
    minHeight: 400,
    frame: false,
    transparent: false,
    resizable: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    backgroundColor: "#000000",
    hasShadow: true,
    x: 0,
    y: 0,
    title: "Discord DM",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.maximize();

  const isDev = process.env.ELECTRON_DEV === "1";

  if (isDev) {
    mainWindow.loadURL("http://127.0.0.1:3000");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    const indexPath = path.join(__dirname, "..", "dist", "index.html");
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function killBackend() {
  if (backendProcess) {
    if (process.platform === "win32") {
      spawn("taskkill", ["/F", "/T", "/PID", backendProcess.pid.toString()]);
    } else {
      backendProcess.kill("SIGTERM");
    }
    backendProcess = null;
  }
}

let savedBounds = null;

ipcMain.on("minimize", () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle("toggle-fullscreen", () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) {
    // Restore
    mainWindow.unmaximize();
    mainWindow.setAlwaysOnTop(true, "pop-up-menu");
    if (savedBounds) {
      mainWindow.setBounds(savedBounds);
      savedBounds = null;
    }
    return false;
  } else {
    // Maximize
    savedBounds = mainWindow.getBounds();
    mainWindow.setAlwaysOnTop(false);
    mainWindow.maximize();
    return true;
  }
});

ipcMain.handle("is-fullscreen", () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

ipcMain.handle("pick-file", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile", "multiSelections"],
  });
  if (result.canceled) return [];
  return result.filePaths;
});

app.whenReady().then(async () => {
  console.log("Starting backend...");
  startBackend();

  try {
    await waitForBackend();
    console.log("Backend is ready");
  } catch (e) {
    console.error(e.message);
  }

  createWindow();
});

app.on("window-all-closed", () => {
  killBackend();
  app.quit();
});

app.on("before-quit", () => {
  killBackend();
});
