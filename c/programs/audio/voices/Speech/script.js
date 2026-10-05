import { findLang } from "../../../../../42/api/i18n/languages.js"
import { capitalize } from "../../../../../42/lib/type/string/capitalize.js"

// TODO: check https://github.com/WebAudio/web-speech-api/issues/69#issuecomment-541267791
// TODO: check https://github.com/guest271314/native-messaging-espeak-ng

if ("speechSynthesis" in window === false) {
  const supportMsg = document.querySelector("#support")
  supportMsg.innerHTML = "speech synthesis <strong>not supported</strong>."
  document.querySelector("fieldset").disabled = false
}

/** @type {HTMLTextAreaElement} */
const textEl = document.querySelector("#text")
/** @type {HTMLSelectElement} */
const voiceEl = document.querySelector("#voice")

/** @type {HTMLInputElement} */
const volumeEl = document.querySelector("#volume")
/** @type {HTMLInputElement} */
const rateEl = document.querySelector("#rate")
/** @type {HTMLInputElement} */
const pitchEl = document.querySelector("#pitch")

/** @type {HTMLButtonElement} */
const speakEl = document.querySelector("#speak")

let voices

function loadVoices() {
  voices = speechSynthesis.getVoices().sort((a, b) => {
    const aname = a.name.toLocaleUpperCase()
    const bname = b.name.toLocaleUpperCase()

    if (aname < bname) return -1
    if (aname === bname) return 0
    return +1
  })

  if (voices.length === 0) return

  voiceEl.replaceChildren()

  const lang = findLang(voices.map(({ lang }) => lang)) ?? "en-US"

  for (const voice of speechSynthesis.getVoices()) {
    const name = capitalize(voice.name.replace(/google\s*/i, ""))
    const option = new Option(name, voice.name)
    if (lang === voice.lang) option.selected = true
    voiceEl.append(option)
  }
}

loadVoices()

// Chrome loads voices asynchronously.
window.speechSynthesis.onvoiceschanged = () => loadVoices()

// Create a new utterance for the specified text and add it to the queue.
function speak(text, options = {}) {
  if (voices.length === 0) return
  if (typeof text !== "string") return
  text = text.trim()
  if (!text) return

  const msg = new SpeechSynthesisUtterance()

  msg.text = text

  if ("volume" in options) msg.volume = Number(options.volume)
  if ("rate" in options) msg.rate = Number(options.rate)
  if ("pitch" in options) msg.pitch = Number(options.pitch)

  // If a voice has been selected, find the voice and set the
  // utterance instance's voice attribute.
  if (voiceEl.value) {
    msg.voice = voices.find((voice) => voice.name === voiceEl.value)
  }

  speechSynthesis.speak(msg)
}

speakEl.addEventListener("click", () =>
  speak(textEl.value, {
    volume: volumeEl.value,
    rate: rateEl.value,
    pitch: pitchEl.value,
  }),
)
