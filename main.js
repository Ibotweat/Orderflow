const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists in AppData for Production
const appDataDir = path.join(app.getPath('userData'), 'data');
if (!fs.existsSync(appDataDir)) fs.mkdirSync(appDataDir, { recursive: true });
process.env.ORDERFLOW_DATA_DIR = appDataDir;

// Copy existing data from development environment to AppData if not exists
const sourceDataDir = path.join(__dirname, 'data');
if (fs.existsSync(sourceDataDir)) {
    ['menu.json', 'settings.json', 'orders.json', 'sessions.json'].forEach(file => {
        const src = path.join(sourceDataDir, file);
        const dest = path.join(appDataDir, file);
        if (fs.existsSync(src) && !fs.existsSync(dest)) {
            fs.copyFileSync(src, dest);
        }
    });
}

const serverApp = require('./server/server.js');

let mainWindow;
let expressServer;
let currentPort = 3000;

// Configuration de l'autoUpdater
autoUpdater.autoDownload = false; // Demander avant
autoUpdater.autoInstallOnAppQuit = true;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 500,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: "Orderflow - Serveur de commandes"
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  
  // Vérifier les mises à jour 3 secondes après le lancement (pour ne pas bloquer le démarrage)
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 3000);
}

let isSilentUpdate = false;

ipcMain.on('start-pc-update', () => {
  isSilentUpdate = true;
  autoUpdater.checkForUpdates();
});

ipcMain.on('download-apk', (event, url) => {
  if (mainWindow) {
    mainWindow.webContents.downloadURL(url);
  }
});

app.whenReady().then(() => {
  createWindow();

  session.defaultSession.on('will-download', (event, item, webContents) => {
    item.once('done', (event, state) => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (state === 'completed') {
        mainWindow.webContents.send('download-apk-done', { success: true, message: 'Téléchargement de l\'APK terminé avec succès !' });
      } else {
        mainWindow.webContents.send('download-apk-done', { success: false, message: 'Le téléchargement a été annulé ou a échoué.' });
      }
    });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Événement quand une mise à jour est trouvée
autoUpdater.on('update-available', (info) => {
  if (isSilentUpdate) {
      mainWindow.webContents.send('update-downloading', { version: info.version });
      autoUpdater.downloadUpdate();
      return;
  }

  dialog.showMessageBox({
    type: 'question',
    title: 'Nouvelle version disponible !',
    message: `La version ${info.version} d'Orderflow est disponible.\nVoulez-vous la télécharger et l'installer maintenant ?`,
    buttons: ['Oui, mettre à jour', 'Non, plus tard']
  }).then((result) => {
    if (result.response === 0) {
      // L'utilisateur a cliqué sur "Oui"
      mainWindow.webContents.send('update-downloading', { version: info.version });
      autoUpdater.downloadUpdate();
    }
  });
});

// Suivi de la progression du téléchargement
autoUpdater.on('download-progress', (progressObj) => {
  // Calcul du temps restant en secondes
  const remainingBytes = progressObj.total - progressObj.transferred;
  const bytesPerSecond = progressObj.bytesPerSecond > 0 ? progressObj.bytesPerSecond : 1;
  const secondsRemaining = Math.max(0, Math.round(remainingBytes / bytesPerSecond));
  
  mainWindow.webContents.send('update-progress', { 
    percent: Math.round(progressObj.percent),
    secondsRemaining: secondsRemaining
  });
  
  // Affiche la progression sur l'icône de la barre des tâches Windows
  mainWindow.setProgressBar(progressObj.percent / 100);
});

// Événement quand la mise à jour est prête à être installée
autoUpdater.on('update-downloaded', (info) => {
  mainWindow.webContents.send('update-ready');
  // Enlever la barre de progression de la barre des tâches
  mainWindow.setProgressBar(-1);
  
  // Redémarrage automatique après 2 secondes pour laisser le temps de lire le message
  setTimeout(() => {
    autoUpdater.quitAndInstall();
  }, 2000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Gérer le démarrage du serveur via IPC
ipcMain.on('start-server', (event, port) => {
  if (expressServer) {
    event.reply('server-status', { success: false, message: 'Le serveur est déjà en cours d\'exécution.' });
    return;
  }

  try {
    currentPort = port;
    expressServer = serverApp.listen(port, () => {
      console.log(`Serveur démarré sur http://localhost:${port}`);
      event.reply('server-status', { success: true, port: port, message: `Serveur en ligne sur http://localhost:${port}` });
    });

    expressServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        event.reply('server-status', { success: false, message: `Le port ${port} est déjà utilisé.` });
      } else {
        event.reply('server-status', { success: false, message: `Erreur du serveur: ${err.message}` });
      }
      expressServer = null;
    });

  } catch (error) {
    event.reply('server-status', { success: false, message: `Erreur: ${error.message}` });
  }
});

// Gérer l'arrêt du serveur (optionnel mais utile)
ipcMain.on('stop-server', (event) => {
  if (expressServer) {
    expressServer.close(() => {
      expressServer = null;
      event.reply('server-stopped', { success: true, message: 'Serveur arrêté.' });
    });
  }
});

ipcMain.handle('get-server-status', () => {
  if (expressServer) {
    return { running: true, port: currentPort };
  }
  return { running: false };
});
