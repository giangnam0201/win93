const { app, BrowserWindow, session } = require('electron')
const path = require('path')
const http = require('http')
const fs = require('fs')
const { execFile } = require('child_process')

let mainWindow
let serverProcess

function startPythonServer() {
  const serverScript = path.join(__dirname, 'server.py')
  if (!fs.existsSync(serverScript)) return
  serverProcess = execFile('python', ['-u', serverScript], { cwd: __dirname })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'WINDOWS 93',
    icon: path.join(__dirname, 'favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,           // bypass same-origin for local file loading
      allowRunningInsecureContent: true,
    },
  })

  // Set headers for cross-origin isolation (required for SharedArrayBuffer / emulators)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Cross-Origin-Opener-Policy': ['same-origin'],
        'Cross-Origin-Embedder-Policy': ['credentialless'],
        'Access-Control-Allow-Origin': ['*'],
      },
    })
  })

  // Wait briefly for Python server to start, then load
  setTimeout(() => {
    mainWindow.loadURL('http://localhost:8093/')
  }, 1500)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  startPythonServer()
  createWindow()
})

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
