function writeToScreen(str) {
  var out = document.querySelector('div#out');
  var span = document.createElement('span');
  span.className = 'out';
  span.innerHTML = str;
  out.appendChild(span);
  out.scrollTop = out.scrollHeight;
}

function writeServerData(buf) {
  var str = buf;

  str = str.replace(/\r+\n/g, '\n');

  var line = str.replace(/^\s\s$/g, '&nbsp;');

  line = line.replace(/</g, '&#60;');
  line = line.replace(/>/g, '&#62;');

  line += '';

  line = ansi_up.ansi_to_html(line);

  writeToScreen(line);
}

document.addEventListener('DOMContentLoaded', function () {

  var sock = io('https://v2.windows93.net:8083');

  sock.on('stream', function (buf) {
    writeServerData(buf);
  });
  sock.on('status', function (str) {
    writeToScreen(str);
  });
  sock.on('connected', function () {
    console.log('connected');
  });
  sock.on('disconnect', function () {
    console.log('disconnected');
  });

  var send = function (str) {
    if (sock) sock.emit('stream', str);
  };

  var sendInput = function () {
    var cmd = document.querySelector('input#cmd');
    send(cmd.value.trim() + '\n');
    cmd.select();
  };

  document.querySelector('input#cmd').addEventListener('keypress', function (e) {
    if (e.keyCode === 13) sendInput();
  });

  document.querySelector('button#send').addEventListener('click', function () {
    sendInput();
  });

  document.querySelector('button#clear').addEventListener('click', function () {
    document.querySelector('div#out').innerHTML = '';
  });

  setTimeout(function () {
    document.querySelector('input#cmd').value = '';
    send('\n');
  }, 200);

});

window.onload = function() {document.getElementById("cmd").focus();};