var stype = 0
var v = null

const boopSend = new SoundEffect({
  "oldParams": true,
  "wave_type": 1,
  "p_env_attack": 0.15,
  "p_env_sustain": 0.103,
  "p_env_punch": 0,
  "p_env_decay": 0.294,
  "p_base_freq": 0.4893480198683819,
  "p_freq_limit": 0,
  "p_freq_ramp": 0,
  "p_freq_dramp": 0,
  "p_vib_strength": 0,
  "p_vib_speed": 0,
  "p_arp_mod": 0.2554945255669317,
  "p_arp_speed": 0.5852926924562201,
  "p_duty": 0,
  "p_duty_ramp": 0,
  "p_repeat_speed": 0,
  "p_pha_offset": -0.06,
  "p_pha_ramp": 0,
  "p_lpf_freq": 1,
  "p_lpf_ramp": 0,
  "p_lpf_resonance": 0.107,
  "p_hpf_freq": 0.235,
  "p_hpf_ramp": 0,
  "sound_vol": 0.25,
  "sample_rate": 44100,
  "sample_size": 16
}).generate()

const boopReceive = new SoundEffect({
  "oldParams": true,
  "wave_type": 1,
  "p_env_attack": 0.294,
  "p_env_sustain": 0.103,
  "p_env_punch": 0,
  "p_env_decay": 0.15,
  "p_base_freq": 0.4893480198683819,
  "p_freq_limit": 0,
  "p_freq_ramp": 0,
  "p_freq_dramp": 0,
  "p_vib_strength": 0,
  "p_vib_speed": 0,
  "p_arp_mod": -0.2554945255669317,
  "p_arp_speed": 0.5852926924562201,
  "p_duty": 0,
  "p_duty_ramp": 0,
  "p_repeat_speed": 0,
  "p_pha_offset": -0.06,
  "p_pha_ramp": 0,
  "p_lpf_freq": 1,
  "p_lpf_ramp": 0,
  "p_lpf_resonance": 0.107,
  "p_hpf_freq": 0.235,
  "p_hpf_ramp": 0,
  "sound_vol": 0.25,
  "sample_rate": 44100,
  "sample_size": 16
}).generate()

const boopDone = new SoundEffect({
  "oldParams": true,
  "wave_type": 1,
  "p_env_attack": 0,
  "p_env_sustain": 0.05995276317674199,
  "p_env_punch": 0.5108062700669586,
  "p_env_decay": 0.45593392087201734,
  "p_base_freq": 0.715561848021367,
  "p_freq_limit": 0,
  "p_freq_ramp": 0,
  "p_freq_dramp": 0,
  "p_vib_strength": 0,
  "p_vib_speed": 0,
  "p_arp_mod": 0.3731816244823119,
  "p_arp_speed": 0.5916615311207035,
  "p_duty": 0,
  "p_duty_ramp": 0,
  "p_repeat_speed": 0,
  "p_pha_offset": 0,
  "p_pha_ramp": 0,
  "p_lpf_freq": 1,
  "p_lpf_ramp": 0,
  "p_lpf_resonance": 0,
  "p_hpf_freq": 0,
  "p_hpf_ramp": 0,
  "sound_vol": 0.25,
  "sample_rate": 44100,
  "sample_size": 8
}).generate()


function setwebcam() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    setwebcam2(true)
    return
  }
  navigator.mediaDevices.enumerateDevices()
    .then(devices => {
      let options = true
      for (const device of devices) {
        if (device.kind === "videoinput" && device.label.toLowerCase().includes("back")) {
          options = { deviceId: { exact: device.deviceId }, facingMode: "environment" }
        }
      }
      setwebcam2(options)
    })
    .catch(() => setwebcam2(true))
}

function setwebcam2(options) {
  if (stype === 1) return
  document.getElementById("v").outerHTML = '<video id="v" class="inset" autoplay width="100%"></video>'
  v = document.getElementById("v")
  navigator.mediaDevices.getUserMedia({ video: options, audio: false })
    .then(onCameraSuccess)
    .catch(onCameraError)
  stype = 1
}

async function onCameraSuccess(stream) {
  v.srcObject = stream
  const { BrowserQRCodeReader } = await import('./zxing-browser.min.js')
  const reader = new BrowserQRCodeReader()
  await reader.decodeFromVideoElement(v, (result) => {
    if (result) read(result.getText())
  })
}

function onCameraError() {}

function load() {
  setwebcam()
}


function printCanvas(msg) {
  QRCode.toCanvas(document.getElementById('qrdata'), msg, {
    errorCorrectionLevel: 'L',
    quality: 1,
    scale: 4,
  }, err => { if (err) console.error(err) })
}


function base64ToUint8Array(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function base64ToUtf8(str) {
  const bytes = new Uint8Array([...atob(str)].map(c => c.charCodeAt(0)))
  return new TextDecoder("utf-8").decode(bytes)
}

function resetReceiverKeepMeta() {
  window.rxChunks = {}
  window.rxTotal = null
  window.rxReceivedCount = 0
}

function reconstructFile() {
  const filename = window.rxMeta?.filename
  const chunks = []
  for (let i = 0; i < window.rxTotal; i++) chunks.push(base64ToUint8Array(window.rxChunks[i]))

  window.receivingData = false
  window.rxChunks = {}
  window.rxTotal = null
  window.rxReceivedCount = 0
  window.rxMeta = null

  const blob = new Blob(chunks)

  boopDone.getAudio().play()
  document.getElementById('console').value += "\n📦 " + filename

  window.saveReceivedFile(blob, filename)
}

function handleReceivedChunk(a) {
  try {
    const { i, n, d } = JSON.parse(a)

    if (i === -1) {
      if (window.rxMeta !== null) return
      resetReceiverKeepMeta()
      window.rxMeta = JSON.parse(base64ToUtf8(d))
      document.getElementById('console').value += "\nFile: " + window.rxMeta.filename
      printCanvas(a)
      boopReceive.getAudio().play()
      window.previousChunk = null
      return
    }

    if (window.rxTotal === null) window.rxTotal = n
    if (window.rxChunks[i] !== undefined) return

    window.rxChunks[i] = d
    window.rxReceivedCount++

    printCanvas(a)
    boopReceive.getAudio().play()
    document.getElementById('console').value += `\n${i + 1}/${n}`

    if (window.rxReceivedCount === window.rxTotal) reconstructFile()

  } catch (e) {
    window.previousChunk = null
  }
}

function read(a) {
  if (window.sendingData) {
    try {
      const rx = JSON.parse(a)
      const tx = JSON.parse(window.currentData)
      if (rx.i === tx.i) window.nextChunk()
    } catch (e) {}
  } else if (window.receivingData) {
    if (a === window.previousChunk) return
    window.previousChunk = a
    handleReceivedChunk(a)
  }
}
