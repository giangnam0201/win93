// SUMMARY
// 1. WEB PAGE INITIALIZATION
// 2. SENDING MESSAGES FROM JAVASCRIPT TO THE PATCH
// 3. SENDING MESSAGES FROM THE PATCH TO JAVASCRIPT (coming soon ...)

// ------------- 1. WEB PAGE INITIALIZATION
const loadingDiv = document.querySelector("#loading")
const startButton = document.querySelector("#start")
const audioContext = new AudioContext()

let patch = null
const stream = null
let webpdNode = null

function isBetween(x, min, max) {
  return x >= min && x <= max
}

const initApp = async () => {
  // Register the worklet
  await WebPdRuntime.initialize(audioContext)

  // Fetch the patch code
  response = await fetch("./patch.wasm")
  patch = await response.arrayBuffer()

  // Comment this if you don't need audio input
  // stream = await navigator.mediaDevices.getUserMedia({ audio: true })

  // Hide loading and show start button
  loadingDiv.style.display = "none"
  startButton.style.display = "block"
}

const startApp = async () => {
  // AudioContext needs to be resumed on click to protects users
  // from being spammed with autoplay.
  // See : https://github.com/WebAudio/web-audio-api/issues/345
  if (audioContext.state === "suspended") {
    audioContext.resume()
  }

  // Setup web audio graph
  webpdNode = await WebPdRuntime.run(
    audioContext,
    patch,
    WebPdRuntime.defaultSettingsForRun("./patch.wasm"),
  )

  webpdNode.connect(audioContext.destination)

  if (window.self === window.top) {
    // not iframe
  } else {
    // iframe
    console.log("I would like to connect to win93's Audio Mixer please :3")
  }

  // Comment this if you don't need audio input
  // const sourceNode = audioContext.createMediaStreamSource(stream)
  // sourceNode.connect(webpdNode)

  // Hide the start button
  startButton.style.display = "none"

  await explorePorts(patch)
}

startButton.onclick = startApp

initApp().then(() => {})

const container = document.createElement("div")
container.id = "container"
document.body.append(container)

const explorePorts = async (compiledPatch) => {
  const metadata = await WebPdRuntime.readMetadata(compiledPatch)
  console.log(metadata)

  for (const [nodeId, val] of Object.entries(
    metadata.settings.io.messageReceivers,
  )) {
    const portletId = Number(val.portletIds[0])
    const div = document.createElement("div")
    // const div = document.getElementById("" + nodeId);
    div.id = "n" + val.metadata.position.join("-")
    div.id = String(nodeId)

    if (val.metadata.type == "bng") {
      const bang = document.createElement("button")
      bang.textContent = "b"
      bang.onclick = () => sendMsgToWebPd(nodeId, portletId, ["bang"])
      div.append(bang)
      const label = document.createElement("label")
      label.textContent = " " + val.metadata.label
      div.append(label)
      div.style.left = val.metadata.position[0] + "px"
      div.style.top = val.metadata.position[1] + "px"
      container.append(div)
    }

    if (val.metadata.type == "hradio") {
      const name = "radio" + Math.random()
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

      const label = document.createElement("label")
      label.textContent = val.metadata.label
      div.append(label)
      div.style.left = val.metadata.position[0] + "px"
      div.style.top = val.metadata.position[1] + "px"
      container.append(div)
    }

    if (val.metadata.type == "tgl") {
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

      div.style.left = val.metadata.position[0] + "px"
      div.style.top = val.metadata.position[1] + "px"
      div.classList.add("tgl")
      div.append(input)
      const label = document.createElement("label")
      label.textContent = val.metadata.label
      div.append(label)
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
        if (input.min > input.max) {
          input.style.direction = "rtl"
          input.min = val.metadata.maxValue
          input.max = val.metadata.minValue
        }
      }

      input.value = 0
      if (val.metadata.minValue != undefined) {
        input.value = Number(val.metadata.minValue)
      }

      if (val.metadata.initValue != undefined) {
        input.value = isBetween(
          val.metadata.initValue,
          val.metadata.minValue,
          val.metadata.maxValue,
        )
          ? Number(val.metadata.initValue)
          : Number(val.metadata.minValue)
      }

      input.oninput = () => {
        sendMsgToWebPd(nodeId, portletId, [Number(input.value)])
      }

      div.style.left = val.metadata.position[0] + "px"
      div.style.top = val.metadata.position[1] + "px"
      div.classList.add("hslider")
      div.append(input)
      div.append(label)
      container.append(div)
    }

    if (val.metadata.type == "vsl") {
      const label = document.createElement("label")
      label.textContent = val.metadata.label
      const input = document.createElement("input")
      if ("minValue" in val.metadata && "maxValue" in val.metadata) {
        input.type = "range"
        input.min = val.metadata.minValue
        input.max = val.metadata.maxValue
        input.step = 0.01
        input.ariaOrientation = "vertical"

        if (val.metadata.minValue > val.metadata.maxValue) {
          input.style.direction = "rtl"
          input.min = val.metadata.maxValue
          input.max = val.metadata.minValue
        }
      }

      input.value = 0
      if (val.metadata.minValue != undefined) {
        input.value = Number(val.metadata.minValue)
      }

      if (val.metadata.initValue != undefined) {
        input.value = isBetween(
          val.metadata.initValue,
          val.metadata.minValue,
          val.metadata.maxValue,
        )
          ? Number(val.metadata.initValue)
          : Number(val.metadata.minValue)
      }

      input.oninput = () => {
        sendMsgToWebPd(nodeId, portletId, [Number(input.value)])
      }

      div.classList.add("vslider")
      div.append(input)
      div.append(label)
      div.style.left = val.metadata.position[0] + "px"
      div.style.top = val.metadata.position[1] + "px"

      container.append(div)
    }

    if (val.metadata.type == "nbx") {
      const input = document.createElement("input")
      input.type = "number"
      input.min = val.metadata.minValue
      input.max = val.metadata.maxValue
      input.step = 1

      input.value = 0
      if (val.metadata.minValue != undefined) {
        input.value = Number(val.metadata.minValue)
      }

      if (val.metadata.initValue != undefined) {
        input.value = isBetween(
          val.metadata.initValue,
          val.metadata.minValue,
          val.metadata.maxValue,
        )
          ? Number(val.metadata.initValue)
          : Number(val.metadata.minValue)
      }

      input.oninput = () => {
        sendMsgToWebPd(nodeId, portletId, [Number(input.value)])
      }

      div.style.left = val.metadata.position[0] + "px"
      div.style.top = val.metadata.position[1] + "px"
      div.append(input)
      const label = document.createElement("label")
      label.textContent = " " + val.metadata.label
      div.append(label)
      div.classList.add("nbx")
      container.append(div)
    }

    if (val.metadata.type == "floatatom") {
      const input = document.createElement("input")
      input.type = "number"
      if (val.metadata.minValue != undefined) {
        input.min = val.metadata.minValue
      }

      if (val.metadata.maxValue != undefined) {
        input.max = val.metadata.maxValue
      }

      input.step = 0.01
      input.value = 0
      if (val.metadata.minValue != undefined) {
        input.value = Number(val.metadata.minValue)
      }

      if (val.metadata.initValue != undefined) {
        input.value = isBetween(
          val.metadata.initValue,
          val.metadata.minValue,
          val.metadata.maxValue,
        )
          ? Number(val.metadata.initValue)
          : Number(val.metadata.minValue)
      }

      input.oninput = () => {
        sendMsgToWebPd(nodeId, portletId, [Number(input.value)])
      }

      div.style.left = val.metadata.position[0] + "px"
      div.style.top = val.metadata.position[1] + "px"
      div.append(input)
      const label = document.createElement("label")
      label.textContent = " " + val.metadata.label
      div.append(label)
      div.classList.add("floatatom")
      container.append(div)
    }
  }
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
