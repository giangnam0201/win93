import { WebPdRuntime } from "./webpd/webpd-runtime.min.js"

let container
let webpdNode

export async function initPatch(options) {
  const audioContext = new AudioContext()

  let loading = document.querySelector("#loading")

  if (!loading) {
    loading = document.createElement("div")
    loading.textContent = "Loading..."
    loading.style.cssText = `
      width: 100%;
      height: 100%;
      position: fixed;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
    `
    document.body.append(loading)
  }

  loading.className = "panel"
  loading.ariaBusy = "true"

  container = document.createElement("div")
  container.id = "container"
  document.body.append(container)

  const src = options?.src ?? "./patch.wasm"

  const patch = await fetch(src).then((res) => res.arrayBuffer())

  // Register the worklet
  await WebPdRuntime.initialize(audioContext)

  // Setup web audio graph
  webpdNode = await WebPdRuntime.run(
    audioContext,
    patch,
    WebPdRuntime.defaultSettingsForRun(src),
  )

  webpdNode.connect(audioContext.destination)

  if (options?.audioInput) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const sourceNode = audioContext.createMediaStreamSource(stream)
    sourceNode.connect(webpdNode)
  }

  const metadata = await WebPdRuntime.readMetadata(patch)
  // console.log(metadata)

  for (const [nodeId, val] of Object.entries(
    metadata.compilation.io.messageReceivers,
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
        if (i === 0) {
          input.checked = true
        }

        if (val.metadata.initValue === i) input.selected = true
        input.oninput = () => {
          sendMsgToWebPd(nodeId, portletId, [i])
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
      input.type = "checkbox"

      input.checked = val.metadata.initValue === val.metadata.maxValue
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

    if (val.metadata.type !== "vsl") continue

    const label = document.createElement("label")
    label.textContent = val.metadata.label

    const input = document.createElement("input")

    if ("minValue" in val.metadata && "maxValue" in val.metadata) {
      input.type = "range"
      input.min = val.metadata.minValue
      input.max = val.metadata.maxValue
      input.step = "0.01"
      if (options?.sliderVertical) input.ariaOrientation = "vertical"
    } else {
      input.type = "number"
      input.step = "0.01"
    }

    // input.value = val.metadata.initValue ?? 0
    input.setAttribute("value", val.metadata.initValue ?? 0)

    input.oninput = () => {
      sendMsgToWebPd(nodeId, portletId, [Number(input.value)])
    }

    div.append(label)
    div.classList.add("vslider")
    div.append(input)
    // ajout
    container.append(div)
  }

  loading.remove()
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
