const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("__agentDebugLog", (line) => {
  if (typeof line !== "string" || !line) {
    return;
  }
  ipcRenderer.send("agent-debug-log", line);
});

ipcRenderer.send(
  "agent-debug-log",
  JSON.stringify({
    sessionId: "c3d591",
    runId: "bridge-check",
    hypothesisId: "H10",
    location: "electron/preload.cjs:init",
    message: "preload initialized",
    data: {},
    timestamp: Date.now(),
  })
);
