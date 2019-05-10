/**
 * TODO: Add log file (URGENT)
 * TODO: Add about page, fix minor bugs in calibration page
 * TODO: MacOs , linux version (not urgent)
 */
const electron = require("electron");
const { app, BrowserWindow, ipcMain } = electron;

let win;

function createWindow() {
  win = new BrowserWindow({
    resizable: false,
    width: 600,
    height: 700,
    webPreferences: { nodeIntegration: true }
  });
  win.setMenu(null);
  win.loadURL(`file://${__dirname}/resources/ui/html/start_page.html`);

  win.on("closed", function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null;
  });
}

app.on("ready", () => {
  createWindow();
});

app.on("window-all-closed", function() {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", function() {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) createWindow();
});

ipcMain.on("arduinoPort", (evt, res) => {
  global.arduinoPort = res;
});
