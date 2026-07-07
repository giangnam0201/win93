let currentAudioSource = null;
let audioContext = null;
let boost;
var speakWorker;
try {
  speakWorker = new Worker('speakWorker.js');
} catch (e) {
  console.log('speak.js warning: no worker support');
}
function speak(text, args) {
  var PROFILE = 1;
  function parseWav(wav) {
    function readInt(i, bytes) {
      var ret = 0;
      var shft = 0;
      while (bytes) {
        ret += wav[i] << shft;
        shft += 8;
        i++;
        bytes--;
      }
      return ret;
    }
    if (readInt(20, 2) != 1) throw 'Invalid compression code, not PCM';
    if (readInt(22, 2) != 1) throw 'Invalid number of channels, not 1';
    return {
      sampleRate: readInt(24, 4),
      bitsPerSample: readInt(34, 2),
      samples: wav.subarray(44)
    };
  }
  function playHTMLAudioElement(wav) {
    function encode64(data) {
      var BASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      var PAD = '=';
      var ret = '';
      var leftchar = 0;
      var leftbits = 0;
      for (var i = 0; i < data.length; i++) {
        leftchar = (leftchar << 8) | data[i];
        leftbits += 8;
        while (leftbits >= 6) {
          var curr = (leftchar >> (leftbits - 6)) & 0x3f;
          leftbits -= 6;
          ret += BASE[curr];
        }
      }
      if (leftbits == 2) {
        ret += BASE[(leftchar & 3) << 4];
        ret += PAD + PAD;
      } else if (leftbits == 4) {
        ret += BASE[(leftchar & 0xf) << 2];
        ret += PAD;
      }
      return ret;
    }
    document.getElementById("audio").innerHTML = ("<audio id=\"player\" src=\"data:audio/x-wav;base64," + encode64(wav) + "\">");
    document.getElementById("player").play();
  }
  function playAudioWithAudioContext(wav) {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      boost = new Boost(audioContext);
      boost.output.connect(audioContext.destination)
    }
    audioContext.decodeAudioData(wav.buffer, (buffer) => {
      if (currentAudioSource) {
        currentAudioSource.stop();
        currentAudioSource.disconnect();
      }
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(boost.input);
      source.start(0);
      currentAudioSource = source;
      source.onended = () => {
        currentAudioSource = null;
      };
    }, (error) => {
      console.error(error);
    });
  }
  function playAudioDataAPI(data) {
    try {
      var output = new Audio();
      output.mozSetup(1, data.sampleRate);
      var num = data.samples.length;
      var buffer = data.samples;
      var f32Buffer = new Float32Array(num);
      for (var i = 0; i < num; i++) {
        var value = buffer[i << 1] + (buffer[(i << 1) + 1] << 8);
        if (value >= 0x8000) value |= ~0x7FFF;
        f32Buffer[i] = value / 0x8000;
      }
      output.mozWriteAudio(f32Buffer);
      return true;
    } catch (e) {
      return false;
    }
  }
  function handleWav(wav) {
    var startTime = Date.now();
    var data = parseWav(wav);
    playAudioWithAudioContext(wav);
  }
  if (args && args.noWorker) {
    var startTime = Date.now();
    var wav = generateSpeech(text, args);
    handleWav(wav);
  } else {
    var startTime = Date.now();
    speakWorker.onmessage = function (event) {
      handleWav(event.data);
    };
    speakWorker.postMessage({ text: text, args: args });
  }
}
// This is not the virtuaDJ boost 
// (leave it there)
class Boost {
  constructor(audioContext) {
    this.audioContext = audioContext
    this.input = this.audioContext.createGain()
    this.output = this.audioContext.createGain()
    this.saturation = this.audioContext.createWaveShaper()
    this.saturationGain = this.audioContext.createGain()
    this.volumeLimiter = this.audioContext.createGain();
    this.compressor = this.audioContext.createDynamicsCompressor();
    this.saturationGain.gain.value = 0
    this.input.connect(this.saturation)
    this.saturation.connect(this.saturationGain)
    this.saturationGain.connect(this.compressor)
    this.compressor.connect(this.volumeLimiter);
    this.volumeLimiter.connect(this.output);
    this.input.connect(this.output)
    this.generateSaturationCurve()
    this.volumeLimiter.gain.value = 0.5;
    this.compressor.threshold.setValueAtTime(-10, this.audioContext.currentTime);
    this.compressor.knee.setValueAtTime(20, this.audioContext.currentTime);
    this.compressor.ratio.setValueAtTime(4, this.audioContext.currentTime);
    this.compressor.attack.setValueAtTime(0.003, this.audioContext.currentTime);
    this.compressor.release.setValueAtTime(0.25, this.audioContext.currentTime);
  }
  generateSaturationCurve() {
    const curve = new Float32Array(44_100)
    for (let i = 0; i < curve.length; i++) {
      const x = (i * 2) / curve.length - 1
      curve[i] = Math.tanh(x)
    }
    this.saturation.curve = curve
    this.saturation.oversample = "4x"
  }
  applyLogarithmicTransform(value) {
    return Math.log(value * 9 + 1) / Math.log(10)
  }
  update(value) {
    value = Math.max(0, Math.min(value, 1))
    if (value === 0) {
      this.input.gain.value = 1
      this.saturationGain.gain.value = 0
    } else {
      const dryGainValue = 1 - value * 0.5
      this.input.gain.value = dryGainValue
      this.saturationGain.gain.value = value * 200
    }
  }
}



