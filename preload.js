var ipcRenderer = require('electron').ipcRenderer;

ipcRenderer.send('hand', 'say hi');

window.alert = function() {}
window.confirm = function() {}

window.addEventListener('load', function load(e) {
  window.removeEventListener("load", load, false);

  console.log('load', e)
  ipcRenderer.send('load', 'load');

  if (window.UD && !window.UD.isLogin) {
    var event = new Event('click');
    var btn = document.getElementById('headerLogin');
    btn && btn.dispatchEvent(event);
    return;
  } else {
    const data = {
      url: window.UD.albumUrl,
      hostId: window.UD.hostId
    };

    ipcRenderer.send('albums', data);
  }
}, true);
