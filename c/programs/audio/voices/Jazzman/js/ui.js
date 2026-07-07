// SUMMARY
// 1. WEB PAGE INITIALIZATION
// 2. SENDING MESSAGES FROM JAVASCRIPT TO THE PATCH
// 3. SENDING MESSAGES FROM THE PATCH TO JAVASCRIPT (coming soon ...)

// ------------- 1. WEB PAGE INITIALIZATION
const loadingDiv = document.querySelector("#loading")
const audioContext = new AudioContext()

let patch = null
let stream = null
let webpdNode = null

const initApp = async () => {
    // Register the worklet
    await WebPdRuntime.initialize(audioContext)

    // Fetch the patch code
    response = await fetch("js/patch.wasm")
    patch = await response.arrayBuffer()

    // Comment this if you don't need audio input
    // stream = await navigator.mediaDevices.getUserMedia({ audio: true })

    // Hide loading
    loadingDiv.style.display = "none"
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

    await explorePorts(patch)
}

initApp().then(() => {
  startApp()
})

const container = document.createElement("div");
container.id = "container";
document.body.append(container);

const explorePorts = async (compiledPatch) => {
    const metadata = await WebPdRuntime.readMetadata(compiledPatch)
   // console.log(metadata)

    for (const [nodeId, val] of Object.entries(
        metadata.settings.io.messageReceivers,
    )) {
        const portletId = Number(val.portletIds[0])

        // const div = document.createElement("div");
        const div = document.getElementById("" + nodeId);
        //div.id = "n" + val.metadata.position.join("-");
        //div.id = "" + nodeId;

        if (val.metadata.type === "bng") {
            const button = document.createElement("button")
            button.textContent = val.metadata.label || "Bang"
            button.onclick = () => sendMsgToWebPd(nodeId, portletId, ["bang"])
            div.append(button)

            //container.append(div)
            continue
        } else if (val.metadata.type === "hradio") {
            const name = "radio" + Math.random()
            const label = document.createElement("label")
            label.textContent = val.metadata.label
            //div.append(label)

            for (let i = 0, l = val.metadata.maxValue; i < l; i++) {
                const input = document.createElement("input")
                input.type = "radio"
                input.name = name
                if (i == 0) {
                    input.checked = true;
                }
                if (val.metadata.initValue === i) input.selected = true
                input.oninput = () => {
                    sendMsgToWebPd(nodeId, portletId, [i])
                    try { getPreset(i); } catch (error) { } // Hillageizer specific
                }

                div.append(input)
            }
            const patchName = document.createElement("span")
            patchName.id = "patchName"
            patchName.textContent = "golden-dawn"
            div.append(patchName)

            // container.append(div)
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
                const valueToSend = input.checked ? val.metadata.maxValue : val.metadata.minValue;
                sendMsgToWebPd(nodeId, portletId, [Number(valueToSend)]);
            }
            //div.append(label)
            div.classList.add('tgl')
            div.append(input)
            // container.append(div)

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
                //input.ariaOrientation = "vertical"
                if (input.min > input.max) {
                    input.style.direction = 'rtl'
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
            //div.append(label)
            div.classList.add('hslider')
            div.append(input)
            //ajout
            // container.append(div)

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
                    input.style.direction = 'rtl'
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

            //div.append(label)
            div.classList.add('vslider')
            div.append(input)
            //ajout
            // container.append(div)


        }


    }


    setTimeout(() => {
        // speed
        document.getElementById('n_0_9').querySelector('input[type="range"]').value = 250;
        sendMsgToWebPd('n_0_9', ['0'], [250])
        // busy
        document.getElementById('n_0_7').querySelector('input[type="range"]').value = 1.4;
        sendMsgToWebPd('n_0_7', ['0'], [1.4])
        // swing
        document.getElementById('n_0_8').querySelector('input[type="range"]').value = 0.9;
        sendMsgToWebPd('n_0_8', ['0'], [0.9])
        // step kick
        document.getElementById('n_0_12').querySelector('input[type="range"]').value = 3;
        sendMsgToWebPd('n_0_12', ['0'], [3])
        // step Snare
        document.getElementById('n_0_11').querySelector('input[type="range"]').value = 3;
        sendMsgToWebPd('n_0_11', ['0'], [3])
        // step hh
        document.getElementById('n_0_10').querySelector('input[type="range"]').value = 5;
        sendMsgToWebPd('n_0_10', ['0'], [5])
        // freq
        document.getElementById('n_0_14').querySelector('input[type="range"]').value = 3000;
        sendMsgToWebPd('n_0_14', ['0'], [3000])
        // q
        document.getElementById('n_0_15').querySelector('input[type="range"]').value = 4.7;
        sendMsgToWebPd('n_0_15', ['0'], [4.7])
        // disto
        document.getElementById('n_0_13').querySelector('input[type="range"]').value = 2;
        sendMsgToWebPd('n_0_13', ['0'], [2])
        // mix kick
        document.getElementById('n_0_4').querySelector('input[type="range"]').value = 0.5;
        sendMsgToWebPd('n_0_4', ['0'], [0.5])
        // mix snare
        document.getElementById('n_0_6').querySelector('input[type="range"]').value = 0.5;
        sendMsgToWebPd('n_0_6', ['0'], [0.5])
        // mix hh
        document.getElementById('n_0_5').querySelector('input[type="range"]').value = 0.2;
        sendMsgToWebPd('n_0_5', ['0'], [0.2])

        document.getElementById('groupContainer').style.display = "grid";

    }, 100);





   

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