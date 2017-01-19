import { app, BrowserWindow, Menu, shell, ipcMain, dialog } from 'electron';
import osxMenu from './menus/osx';
import fs from 'fs';
import winLinuxMenu from './menus/win-linux';

let menu;
let mainWindow = null;
const isDev = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';
const isDebug = isDev || isTest;

if (isDebug) {
  require('electron-debug')(); // eslint-disable-line global-require
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

const installExtensions = async () => {
  if (isDebug) {
    const installer = require('electron-devtools-installer'); // eslint-disable-line global-require

    const extensions = [
      'REACT_DEVELOPER_TOOLS',
    ];
    const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
    for (const name of extensions) {
      try {
        await installer.default(installer[name], forceDownload);
      } catch (e) {} // eslint-disable-line
    }
  }
};

app.on('ready', async () => {
  await installExtensions();

  const DATA = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + 'Library/Preferences' : '~/.config');

  const logfile = fs.openSync(DATA + '\\Daedalus\\Logs\\cardano-node.log', 'a');

  var cardanoFlags = [
    '--db-path', DATA + '\\Daedalus\\DB',
    '--listen', '0.0.0.0:12100',
    '--peer', '35.156.182.24:3000/MHdrsP-oPf7UWl0007QuXnLK5RD=',
    '--peer', '54.183.103.204:3000/MHdrsP-oPf7UWl0077QuXnLK5RD=',
    '--peer', '35.156.182.24:3000/MHdrsP-oPf7UWl0007QuXnLK5RD=',
    '--keyfile', DATA + '\\Daedalus\\Secrets\\secret.key',
    '--logs-prefix', DATA + '\\Daedalus\\Logs',
    '--log-config', 'log-config-prod.yaml',
    '--wallet-db-path', DATA + '\\Daedalus\\Wallet',
    '--wallet',
  ];

  // TODO: based on platform, different command
  var cardanoNode = require('child_process').spawn('cardano-node.exe', cardanoFlags, {stdio: ['ignore', logfile, logfile]});
  cardanoNode.on('error', error => {
    dialog.showErrorBox('cardano-node exited', error.name + ": " + error.message);
    app.quit()
  });

  mainWindow = new BrowserWindow({
    show: false,
    width: 1150,
    height: 870
    // TODO: revert to 480 x 757 when reintroducing login
  });

  mainWindow.loadURL(`file://${__dirname}/../app/index.html`);

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  ipcMain.on('resize-window', (event, { width, height, animate }) => {
    if (event.sender !== mainWindow.webContents) return;
    mainWindow.setSize(width, height, animate);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    cardanoNode.kill('SIGINT');
  });

  if (isDev) mainWindow.openDevTools();
  if (isDebug) {
    mainWindow.webContents.on('context-menu', (e, props) => {
      const { x, y } = props;

      Menu.buildFromTemplate([{
        label: 'Inspect element',
        click() {
          mainWindow.inspectElement(x, y);
        }
      }]).popup(mainWindow);
    });
  }

  if (process.platform === 'darwin') {
    menu = Menu.buildFromTemplate(osxMenu(app, mainWindow, isDebug));
    Menu.setApplicationMenu(menu);
  } else {
    menu = Menu.buildFromTemplate(winLinuxMenu(mainWindow, isDebug));
    mainWindow.setMenu(menu);
  }
});
