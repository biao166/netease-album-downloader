const electron = require('electron');

const {
  app,
  ipcMain,
  BrowserWindow
} = electron;

const request = require('request');

const url = require('url');
const Promise = require('bluebird');
const fs = require('fs-extra');
const path = require('path');
const iconv = require('iconv-lite');

require('debug').enable('main');
const debug = require('debug')('main');

const PhotoWindow = require('./photo');
const conf = require('./config');

function ensureDir(dir) {
  return new Promise(function(resolve, reject) {
    fs.ensureDir(dir, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    })
  })
}

class Mars {
  constructor() {
    this.photoWindow = null;
    this.albums = [];
  }

  init() {
    this.initApp();
    this.initIPC();
  }

  initApp() {
    app.on('ready', () => {
      debug('app ready');
      this.createPhotoWindow();
      this.photoWindow.loadURL(conf.homePage).show();
    })

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit()
      }
    })

    app.on('activate', () => {
      debug('app activate');
    })
  }

  initIPC() {
    ipcMain.on('load', (event, data) => {
      debug('load')
    });

    ipcMain.on('hand', (event, data) => {
      debug('hand')
    });

    ipcMain.on('albums', (event, data) => {
      debug('albums', data);
      this.fetchAlbums(data);
    });
  }

  getJs(url, dist) {
    url = /^https?/.test(url) ? url : 'http://' + url;
    return new Promise(function(resolve, reject) {
      const stream = request
        .get(url)
        .on('error', function(err) {
          debug('getJs', err);
          reject(err);
        })
        .pipe(iconv.decodeStream('gbk'))
        .pipe(iconv.encodeStream('utf-8'))
        .pipe(fs.createWriteStream(dist));

      stream.on('finish', () => {
        resolve()
      })
    })
  }

  fixJs(str, dist) {
    return new Promise(function(resolve, reject) {
      fs.appendFile(dist, str, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    })
  }

  // 获取相册列表信息
  async fetchAlbums(data) {
    const dist = path.resolve(__dirname, 'temp/albums.js');
    const appendStr = `module.exports = g_a$${data.hostId}d;`;

    await this.getJs(data.url, dist);
    await this.fixJs(appendStr, dist);

    const albums = require(dist);

    await this.createTask(albums)
  }

  fetchAlbum(data) {
    const arr = [];
    for (var p in data.params) {
      arr.push((p + '=' + data.params[p]))
    }
    const body = arr.join('\n');

    return new Promise(function(resolve, reject) {
      const options = {
        url: `http://photo.163.com/photo/${conf.user}/dwr/call/plaincall/AlbumBean.getAlbumData.dwr?u=${conf.user}`,
        method: 'POST',
        headers: {
          'Referer': conf.homePage,
          'Cookie': data.cookies,
          'User-Agent': conf.userAgent,
          'ContentType': 'text/plain'
        },
        body: body
      }

      request(options, function(err, response, body) {
        if (!err && response.statusCode == 200) {
          const result = body.match(/"([a-zA-Z0-9\.\/\=_-]+)"/);

          if (result && result[1]) {
            resolve(result[1]);
          } else {
            reject(new Error(`fetch album ${data.id} unknown error`))
          }

        } else {
          reject(err);
        }
      })
    })
  }

  async createTask(albums) {
    const api = `http://photo.163.com/photo/${conf.user}/dwr/call/plaincall/AlbumBean.getAlbumData.dwr?u=${conf.user}`;

    const params = {
      callCount: 1,
      'batchId': 10086,
      'scriptSessionId': '${scriptSessionId}187',
      'c0-scriptName': 'AlbumBean',
      'c0-methodName': 'getAlbumData',
      'c0-id': 0,
      'c0-param1': 'string:',
      'c0-param2': 'string:',
      'c0-param4': 'boolean:false'
    }

    const cookies = await this.photoWindow.getCookieByUrl(url);

    await Promise.reduce(albums, async(previous, album) => {
      // 获取图片列表
      await Promise.delay(500);
      const script = await this.fetchAlbum({
        id: album.id,
        url: api,
        cookies: cookies,
        params: Object.assign({}, params, {
          'c0-param0': `string:${album.id}`,
          'c0-param3': `number:${Date.now()}`,
        })
      });

      // 写入并处理
      const dist = path.resolve(__dirname, `temp/${album.id}.js`);
      const appendStr = `module.exports = g_p$${album.id}d;`;
      await this.getJs(script, dist);
      await this.fixJs(appendStr, dist);

      const photos = require(dist);
      const albumDir = path.resolve(__dirname, `albums/${album.name}`);

      debug('创建相册：', album.name)
      await ensureDir(albumDir);

      if (!photos.length) {
        debug('空相册');
        return;
      }

      // 获取原图
      await Promise.reduce(photos, async(previous, photo) => {
        const [, cdnId, photoPath] = photo.ourl.match(/(\d+)\/([\w\W]+)/);
        const ext = photoPath.match(/\.[a-z]+$/)[0]
        const original = `http://img${cdnId}.ph.126.net/${photoPath}`;
        const name = (photo.desc || photo.id) + ext
        const dist = path.join(albumDir, name);

        debug('下载图片：', name);
        await this.getPhoto(original, dist);
        await Promise.delay(100);
      }, 0)
    }, 0).catch((err) => {
      debug(err);
    }).then(() => {
      debug('All done');
    })
  }

  getPhoto(url, dist) {
    url = /^https?/.test(url) ? url : 'http://' + url;

    return new Promise(function(resolve, reject) {
      const stream = request
        .get(url)
        .on('error', function(err) {
          debug('getPhoto', err);
          reject(err);
        })
        .pipe(fs.createWriteStream(dist));

      stream.on('finish', () => {
        resolve()
      })
    })
  }

  createPhotoWindow() {
    this.photoWindow = new PhotoWindow();
  }
}

(new Mars()).init();
