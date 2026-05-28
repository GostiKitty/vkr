const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const DEBUG_LOG_PATH = path.resolve(process.cwd(), "../../../debug-c3d591.log");

function appendDebugLine(payload) {
  try {
    fs.appendFileSync(DEBUG_LOG_PATH, `${JSON.stringify(payload)}\n`);
  } catch {
    // Ignore debug logging failures.
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  // Vite dev server
  win.loadURL("http://127.0.0.1:5173");
}

app.whenReady().then(() => {
  appendDebugLine({
    sessionId: "c3d591",
    runId: "bridge-check",
    hypothesisId: "H10",
    location: "electron/main.cjs:whenReady",
    message: "electron main ready",
    data: { debugLogPath: DEBUG_LOG_PATH, cwd: process.cwd() },
    timestamp: Date.now(),
  });

  ipcMain.on("agent-debug-log", (_event, line) => {
    if (typeof line !== "string" || !line) {
      return;
    }
    appendDebugLine({
      sessionId: "c3d591",
      runId: "bridge-check",
      hypothesisId: "H10",
      location: "electron/main.cjs:ipc",
      message: "ipc log received",
      data: { lineLength: line.length },
      timestamp: Date.now(),
    });
    fs.appendFile(DEBUG_LOG_PATH, `${line}\n`, () => {});
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});