const {
  app,
  shell,
  ipcMain,
  BrowserWindow
} = require('electron');

const path = require('path');

require('debug').enable('doc');
const debug = require('debug')('doc');

const conf = require('../config');

class DocWindow {
  constructor() {
    this.doc = null;
    this.createWindow();

    this.initIPC();
  }

  createWindow() {
    let docWindow = new BrowserWindow({
      title: '网易相册下载器',
      width: conf.DEBUG_MODE ? 960 : 960,
      height: 600,
      show: false,
      center: true,
      // autoHideMenuBar: true,
      // titleBarStyle: 'hidden-inset',
      webPreferences: {
        javascript: true,
        plugins: true,
        nodeIntegration: false,
        webSecurity: false,
        preload: path.join(__dirname, '../preload.js'),
      },
    });

    docWindow.webContents.setUserAgent(conf.userAgent);

    if (conf.DEBUG_MODE) {
      docWindow.webContents.openDevTools();
    }

    docWindow.webContents.on('dom-ready', function(e) {
    });

    docWindow.on('closed', function() {
      docWindow = null
    })

    this.docWindow = docWindow;
  }

  initIPC() {
    ipcMain.on('xss', (event, scripts) => {
      if (!this.doc) {
        return;
      }
      this.createTask(scripts);
    });
  }

  loadURL(url) {
    this.doc = url;
    this.docWindow.loadURL(url);
    return this;
  }

  show() {
    this.docWindow.show();
    return this;
  }

  getCookieByUrl(url) {
    return new Promise((resolve, reject) => {
      const session = this.docWindow.webContents.session;

      session.cookies.get({
        url: url
      }, function(error, cookies) {
        if (error) {
          reject(error);
        } else {
          resolve(cookies);
        }
      });
    }).then((cookies) => {
      const arr = []
      cookies.forEach((cookie) => {
        arr.push(cookie.name + '=' + cookie.value)
      })

      return arr.join('; ');
    })
  }

}

module.exports = DocWindow;
