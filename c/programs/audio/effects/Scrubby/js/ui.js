// SUMMARY
// 1. WEB PAGE INITIALIZATION
// 2. SENDING MESSAGES FROM JAVASCRIPT TO THE PATCH
// 3. SENDING MESSAGES FROM THE PATCH TO JAVASCRIPT (coming soon ...)

import { AudioApp } from "../../../../../../42/api/os/AudioApp.js"

const app = new AudioApp()

// ------------- 1. WEB PAGE INITIALIZATION

// @ts-ignore
const { WebPdRuntime } = globalThis

const loadingDiv = document.querySelector("#loading")
// const startButton = document.querySelector("#start")
// const audioContext = new AudioContext()
const audioContext = app.context

let patch
let webpdNode

const initApp = async () => {
  // Register the worklet
  await WebPdRuntime.initialize(audioContext)

  // Fetch the patch code
  const response = await fetch("js/patch.wasm")
  patch = await response.arrayBuffer()

  // Hide loading and show start button
  loadingDiv.style.display = "none"
  //   startButton.style.display = "block"
}

const startApp = async () => {
  // // AudioContext needs to be resumed on click to protects users
  // // from being spammed with autoplay.
  // // See : https://github.com/WebAudio/web-audio-api/issues/345
  // if (audioContext.state === "suspended") {
  //   audioContext.resume()
  // }

  // Setup web audio graph
  webpdNode = await WebPdRuntime.run(
    audioContext,
    patch,
    WebPdRuntime.defaultSettingsForRun("./patch.wasm"),
  )

  // webpdNode.connect(audioContext.destination)

  // Connect inputs from audioApp to webpdNode :)
  app.audioPipe = webpdNode

  await explorePorts(patch)
}

initApp().then(() => {
  startApp()
})

const container = document.createElement("div")
container.id = "container"
document.body.append(container)

const explorePorts = async (compiledPatch) => {
  const metadata = await WebPdRuntime.readMetadata(compiledPatch)
  // console.log(metadata)

  for (const [nodeId, val] of Object.entries(
    metadata.settings.io.messageReceivers,
  )) {
    const portletId = Number(val.portletIds[0])

    const div = document.createElement("div")
    // div.id = "n" + val.metadata.position.join("-");
    div.id = String(nodeId)

    if (val.metadata.type === "bng") {
      const button = document.createElement("button")
      button.textContent = val.metadata.label || "Bang"
      button.onclick = () => sendMsgToWebPd(nodeId, portletId, ["bang"])
      div.append(button)

      container.append(div)
      continue
    } else if (val.metadata.type === "hradio") {
      const name = "radio" + Math.random()
      const label = document.createElement("label")
      label.textContent = val.metadata.label
      div.append(label)

      for (let i = 0, l = val.metadata.maxValue; i < l; i++) {
        const input = document.createElement("input")
        input.type = "radio"
        input.name = name
        if (i == 0) {
          input.checked = true
        }
        if (val.metadata.initValue === i) input.selected = true
        input.oninput = () => {
          sendMsgToWebPd(nodeId, portletId, [i])
          try {
            getPreset(i)
          } catch {} // Hillageizer specific
        }

        div.append(input)
      }
      const patchName = document.createElement("span")
      patchName.id = "patchName"
      patchName.textContent = "golden-dawn"
      div.append(patchName)

      container.append(div)
      continue
    } else if (val.metadata.type === "tgl") {
      // console.log(val.metadata)

      const label = document.createElement("label")
      label.textContent = val.metadata.label
      const input = document.createElement("input")
      if ("minValue" in val.metadata && "maxValue" in val.metadata) {
        input.type = "checkbox"
        input.min = val.metadata.minValue
        input.max = val.metadata.maxValue
        input.step = 0.01
      }
      input.checked = val.metadata.initValue == val.metadata.maxValue
      input.oninput = () => {
        const valueToSend = input.checked
          ? val.metadata.maxValue
          : val.metadata.minValue
        sendMsgToWebPd(nodeId, portletId, [Number(valueToSend)])
      }
      div.append(label)
      div.classList.add("tgl")
      div.append(input)
      container.append(div)
    }

    if (val.metadata.type == "hsl") {
      const label = document.createElement("label")
      label.textContent = val.metadata.label
      const input = document.createElement("input")
      if ("minValue" in val.metadata && "maxValue" in val.metadata) {
        input.type = "range"
        input.min = val.metadata.minValue
        input.max = val.metadata.maxValue
        input.step = 0.01
        // input.ariaOrientation = "vertical"
        if (input.min > input.max) {
          input.style.direction = "rtl"
          input.min = val.metadata.maxValue
          input.max = val.metadata.minValue
        }
      } else {
        input.type = "number"
        input.step = 0.01
      }
      input.value = val.metadata.initValue ?? 0
      input.oninput = () => {
        sendMsgToWebPd(nodeId, portletId, [Number(input.value)])
      }
      div.append(label)
      div.classList.add("hslider")
      div.append(input)
      // ajout
      container.append(div)
    }

    if (val.metadata.type !== "vsl") continue

    const label = document.createElement("label")
    label.textContent = val.metadata.label

    const input = document.createElement("input")

    if ("minValue" in val.metadata && "maxValue" in val.metadata) {
      input.type = "range"
      input.min = val.metadata.minValue
      input.max = val.metadata.maxValue
      input.step = 0.01
      // input.ariaOrientation = "vertical"
    } else {
      input.type = "number"
      input.step = 0.01
    }

    input.value = val.metadata.initValue ?? 0

    input.oninput = () => {
      sendMsgToWebPd(nodeId, portletId, [Number(input.value)])
    }

    div.append(label)
    div.classList.add("vslider")
    div.append(input)
    // ajout
    container.append(div)
  }

  //
  // preset
  //
  // rate
  document.querySelector("#n_0_8").querySelector('input[type="range"]').value =
    333
  sendMsgToWebPd("n_0_8", ["0"], [333])
  // min
  document.querySelector("#n_0_6").querySelector('input[type="range"]').value =
    0
  sendMsgToWebPd("n_0_6", ["0"], [0])
  // max
  document.querySelector("#n_0_7").querySelector('input[type="range"]').value =
    100
  sendMsgToWebPd("n_0_7", ["0"], [100])
  // speed
  document.querySelector("#n_0_9").querySelector('input[type="range"]').value =
    333
  sendMsgToWebPd("n_0_9", ["0"], [333])
  // dry
  document.querySelector("#n_0_10").querySelector('input[type="range"]').value =
    1
  sendMsgToWebPd("n_0_10", ["0"], [1])
  //
  document.querySelector("#container").style.display = "grid"
}

// ------------- 2. SENDING MESSAGES FROM JAVASCRIPT TO THE PATCH
// Use the function sendMsgToWebPd to send a message from JavaScript to an object inside your patch.
//
// Parameters :
// - nodeId: the ID of the object you want to send a message to.
//          This ID is a string that has been assigned by WebPd at compilation.
//          You can find below the list of available IDs with hints to help you
//          identify the object you want to interact with.
// - portletId : the ID of the object portlet to which the message should be sent.
// - message : the message to send. This must be a list of strings and / or numbers.
//
// Examples :
// - sending a message to a bang node of ID 'n_0_1' :
//          sendMsgToWebPd('n_0_1', '0', ['bang'])
// - sending a message to a number object of ID 'n_0_2' :
//          sendMsgToWebPd('n_0_2', '0', [123])
//
const sendMsgToWebPd = (nodeId, portletId, message) => {
  webpdNode.port.postMessage({
    type: "io:messageReceiver",
    payload: {
      nodeId,
      portletId,
      message,
    },
  })
}
