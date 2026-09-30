const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = require('electron-is-dev');
const serve = require('electron-serve');
const loadURL = serve({ directory: 'dist' });

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
    icon: path.join(__dirname, 'assets/icon.png'),
    title: 'Kardex V2 Desktop'
  });

  const indexPath = path.join(__dirname, 'dist', 'index.html');
  console.log('Buscando index en:', indexPath);
  
  if (fs.existsSync(indexPath)) {
    console.log('Carpeta "dist" encontrada. Cargando aplicación local...');
    loadURL(win);
  } else if (isDev) {
    console.log('Carpeta "dist" NO encontrada. Intentando cargar desde dev server (localhost:8081)...');
    win.loadURL('http://localhost:8081').catch(err => {
      console.error('Fallo al cargar localhost:', err);
      win.loadHTML('<h1>Error: Servidor no disponible</h1><p>Asegúrese de correr <b>npm run desktop</b>.</p>');
    });
  } else {
    console.error('Error Crítico: No se encontró la carpeta "dist" ni el index.html');
    win.loadHTML('<h1>Error Crítico</h1><p>No se encontró la carpeta <b>dist</b>. Por favor, ejecute <b>npm run desktop</b> primero.</p>');
  }

  // Abrir herramientas de desarrollo para ver errores de la consola
  win.webContents.openDevTools();

  // Quitar la barra de menú por defecto (opcional)
  // win.setMenu(null);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
