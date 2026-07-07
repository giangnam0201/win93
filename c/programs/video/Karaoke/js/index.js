var folder = ""
var song = ""

var player
var audioContext = new AudioContext()

var audioPlayer = document.createElement('audio')
audioPlayer.addEventListener('canplaythrough', playSong, false)

var source = audioContext.createMediaElementSource(audioPlayer)
source.connect(audioContext.destination)

var checkPitch = document.querySelector('#preservesPitch')
checkPitch.addEventListener('input', function () {
  audioPlayer.preservesPitch = this.checked
})

function loadSong() {
  fetch(song + '.ogg', { method: 'HEAD' })
    .then(response => {
      audioPlayer.src = response.ok ? song + '.ogg' : song + '.mp3'
      playSong()
    })
    .catch(() => {
      audioPlayer.src = song + '.mp3'
      playSong()
    })
}

function playSong() {

  if(song==""){return}

  if (player) {
    player.stop()
    player = null
  }

  player = new CDGPlayer(document.getElementById('karaoke-display'))
  player.load(song + '.cdg')

  document.getElementById('playbackRate').value = 1
  audioPlayer.playbackRate = 1
  audioPlayer.play()
  player.play()

  document.getElementById('stop').style.display = 'block'
  document.getElementById('play').style.display = 'none'
}

function stopSong() {
  audioPlayer.pause()
  player.stop()

  document.getElementById('stop').style.display = 'none'
  document.getElementById('play').style.display = 'block'

  var canvas = document.getElementById("karaoke-display")
  canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height)

  audioPlayer.playbackRate = 1
  document.getElementById("playbackRate").value = '1'
}

function updatePlaybackRate() {
  var x = parseFloat(document.getElementById("playbackRate").value)

  if (!x || x < 0.1) x = 0.1
  if (x > 16) x = 16

  document.getElementById("playbackRate").value = x
  audioPlayer.playbackRate = x
}
