// QRCODE reader Copyright 2011 Lazar Laszlo
// http://www.webqr.com

var gCtx = null
var gCanvas = null
var c = 0
var stype = 0
var gUM = false
var webkit = false
var moz = false
var v = null

var boop = (sound = new SoundEffect({
  oldParams: true,
  wave_type: 1,
  p_env_attack: 0.15,
  p_env_sustain: 0.103,
  p_env_punch: 0,
  p_env_decay: 0.294,
  p_base_freq: 0.4893480198683819,
  p_freq_limit: 0,
  p_freq_ramp: 0,
  p_freq_dramp: 0,
  p_vib_strength: 0,
  p_vib_speed: 0,
  p_arp_mod: 0.2554945255669317,
  p_arp_speed: 0.5852926924562201,
  p_duty: 0,
  p_duty_ramp: 0,
  p_repeat_speed: 0,
  p_pha_offset: -0.06,
  p_pha_ramp: 0,
  p_lpf_freq: 1,
  p_lpf_ramp: 0,
  p_lpf_resonance: 0.107,
  p_hpf_freq: 0.235,
  p_hpf_ramp: 0,
  sound_vol: 0.25,
  sample_rate: 44100,
  sample_size: 16,
}).generate())
// boop.getAudio().play()

var imghtml =
  '<div id="qrfile"><canvas id="out-canvas" width="320" height="240"></canvas>' +
  '<div id="imghelp">drag and drop a QRCode here' +
  "<br>or select a file" +
  '<input type="file" onchange="handleFiles(this.files)"/>' +
  "</div>" +
  "</div>"

var vidhtml = '<video id="v" autoplay></video>'

function dragenter(e) {
  e.stopPropagation()
  e.preventDefault()
}

function dragover(e) {
  e.stopPropagation()
  e.preventDefault()
}
function drop(e) {
  e.stopPropagation()
  e.preventDefault()

  var dt = e.dataTransfer
  var files = dt.files
  if (files.length > 0) {
    handleFiles(files)
  } else if (dt.getData("URL")) {
    qrcode.decode(dt.getData("URL"))
  }
}

function handleFiles(f) {
  var o = []

  for (var i = 0; i < f.length; i++) {
    var reader = new FileReader()
    reader.onload = (function (theFile) {
      return function (e) {
        gCtx.clearRect(0, 0, gCanvas.width, gCanvas.height)

        qrcode.decode(e.target.result)
      }
    })(f[i])
    reader.readAsDataURL(f[i])
  }
}

function initCanvas(w, h) {
  gCanvas = document.getElementById("qr-canvas")
  gCanvas.style.width = w + "px"
  gCanvas.style.height = h + "px"
  gCanvas.width = w
  gCanvas.height = h
  gCtx = gCanvas.getContext("2d", { willReadFrequently: true })
  gCtx.clearRect(0, 0, w, h)
}

function captureToCanvas() {
  if (stype != 1) return
  if (gUM) {
    try {
      gCtx.drawImage(v, 0, 0)
      try {
        qrcode.decode()
      } catch (e) {
        //console.log(e);
        setTimeout(captureToCanvas, 500)
      }
    } catch (e) {
      //console.log(e);
      setTimeout(captureToCanvas, 500)
    }
  }
}

function htmlEntities(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function read(a) {
  var html = ""

  /*
    // detect url
    if (a.indexOf("http://") === 0 || a.indexOf("https://") === 0){
        html += "<a target='_blank' href='" +  htmlEntities(a) + "'>" + htmlEntities(a) + "</a>"
    }else{
        html=htmlEntities(a)
    }
    */

  html = htmlEntities(a)

  if (document.getElementById("result").innerHTML != html) {
    document.getElementById("result").innerHTML = htmlEntities(a)
    boop.getAudio().play()
  }

  setwebcam()
}

function isCanvasSupported() {
  var elem = document.createElement("canvas")
  return !!(
    elem.getContext && elem.getContext("2d", { willReadFrequently: true })
  )
}
function success(stream) {
  v.srcObject = stream
  v.play()

  gUM = true
  setTimeout(captureToCanvas, 500)
}

function error(error) {
  gUM = false
  return
}

function load() {
  if (isCanvasSupported() && window.File && window.FileReader) {
    initCanvas(800, 600)
    qrcode.callback = read
    document.getElementById("mainbody").style.display = "inline"
    setwebcam()
  } else {
    document.getElementById("mainbody").style.display = "inline"
    document.getElementById("mainbody").innerHTML =
      '<p id="mp1">QR code scanner for HTML5 capable browsers</p><br>' +
      '<br><p id="mp2">sorry your browser is not supported</p><br><br>' +
      '<p id="mp1">try <a href="http://www.mozilla.com/firefox"><img src="firefox.png"/></a> or <a href="http://chrome.google.com"><img src="chrome_logo.gif"/></a> or <a href="http://www.opera.com"><img src="Opera-logo.png"/></a></p>'
  }
}

function setwebcam() {
  var options = true
  if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
    try {
      navigator.mediaDevices.enumerateDevices().then(function (devices) {
        devices.forEach(function (device) {
          if (device.kind === "videoinput") {
            if (device.label.toLowerCase().search("back") > -1)
              options = {
                deviceId: { exact: device.deviceId },
                facingMode: "environment",
              }
          }
          // console.log(device.kind + ": " + device.label + " id = " + device.deviceId);
        })
        setwebcam2(options)
      })
    } catch (e) {
      // console.log(e);
    }
  } else {
    //console.log("no navigator.mediaDevices.enumerateDevices");
    setwebcam2(options)
  }
}

function setwebcam2(options) {
  //console.log(options);
  //document.getElementById("result").innerHTML = "- scanning -";
  if (stype == 1) {
    setTimeout(captureToCanvas, 500)
    return
  }
  var n = navigator
  document.getElementById("outdiv").innerHTML = vidhtml
  v = document.getElementById("v")

  if (n.mediaDevices.getUserMedia) {
    n.mediaDevices
      .getUserMedia({ video: options, audio: false })
      .then(function (stream) {
        success(stream)
      })
      .catch(function (err) {
        error(err)
      })
  } else if (n.getUserMedia) {
    webkit = true
    n.getUserMedia({ video: options, audio: false }, success, error)
  } else if (n.webkitGetUserMedia) {
    webkit = true
    n.webkitGetUserMedia({ video: options, audio: false }, success, error)
  }

  document.getElementById("qrimg").style.opacity = 0.2
  document.getElementById("webcamimg").style.opacity = 1.0

  stype = 1
  setTimeout(captureToCanvas, 500)
}

function setimg() {
  document.getElementById("result").innerHTML = ""
  if (stype == 2) return
  document.getElementById("outdiv").innerHTML = imghtml
  document.getElementById("qrimg").style.opacity = 1.0
  document.getElementById("webcamimg").style.opacity = 0.2
  var qrfile = document.getElementById("qrfile")
  qrfile.addEventListener("dragenter", dragenter, false)
  qrfile.addEventListener("dragover", dragover, false)
  qrfile.addEventListener("drop", drop, false)
  stype = 2
}
