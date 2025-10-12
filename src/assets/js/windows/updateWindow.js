"use strict";
const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const path = require("path");
const os = require("os");

let dev = process.env.DEV_TOOL === 'open';
let updateWindow = undefined;

function getWindow() {
    return updateWindow;
}

function destroyWindow() {
    if (!updateWindow) return;
    updateWindow.close();
    updateWindow = undefined;
}

function createWindow() {
    destroyWindow();

    updateWindow = new BrowserWindow({
        title: "Actualizar",
        width: 1000,
        height: 600,
        resizable: false,
        transparent: true,
        frame: false,
        show: false,
        icon: `./src/assets/images/icon.${os.platform() === "win32" ? "ico" : "png"}`,
        backgroundColor: '#00000000',
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true,
        },
    });

    // Quitamos menú
    Menu.setApplicationMenu(null);
    updateWindow.setMenuBarVisibility(false);

    // Cargamos el splash
    updateWindow.loadFile(path.join(`${app.getAppPath()}/src/index.html`));

    // Mostramos la ventana cuando esté lista
    updateWindow.once('ready-to-show', () => {
        if (updateWindow) {
            if (dev) updateWindow.webContents.openDevTools({ mode: 'detach' });
            updateWindow.show();
        }
    });

    // Escuchamos eventos desde el splash
    ipcMain.on("main-window-open", () => {
        console.log("Abrir ventana principal del launcher");
        // Aquí puedes abrir tu ventana principal
    });

    ipcMain.on("update-window-close", () => {
        destroyWindow();
    });

    ipcMain.on("update-window-progress-load", () => {
        console.log("Splash cargando...");
    });

    ipcMain.on("update-window-progress", (event, data) => {
        const progress = data.progress / data.size;
        if (updateWindow) {
            updateWindow.setProgressBar(progress); // Esto se ve en la barra de tareas
        }
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

module.exports = {
    getWindow,
    createWindow,
    destroyWindow,
};
