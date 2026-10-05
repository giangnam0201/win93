import { mixer } from "../../../../../42/lib/audio/mixer.js"
import "../../../../../42/ui/layout/menu.js"
import "../../../../../42/ui/control/volume.js"

const { mediaDevices } = navigator

const stopStream = (stream) => {
  for (const track of stream.getTracks()) track.stop()
}

/**
 * @param {import("42/api/os/App.js").App} app
 */
export async function renderApp(app) {
  const audioContext = mixer.context
  const gainNode = new GainNode(audioContext)

  mixer.addTrack(gainNode, { app, fadeIn: 0 })

  let menuEl
  let deviceId

  const activeInputs = new Map()

  const cleanupInputs = () => {
    for (const { mediaStream, node } of activeInputs.values()) {
      stopStream(mediaStream)
      node.disconnect()
    }
    activeInputs.clear()
  }

  const getDevices = async () => {
    const devices = await mediaDevices.enumerateDevices()
    return devices.filter(({ kind }) => kind === "audioinput")
  }

  const makeMenuPlan = async () => {
    const devices = await getDevices()

    // Handle missing labels for initial state
    if (!devices?.[0]?.label) {
      return [
        {
          label: "Authorize Audio Access",
          picto: "key",
          async action() {
            try {
              const stream = await mediaDevices.getUserMedia({ audio: true })
              stopStream(stream) // Stop stream immediately as we only want labels
              menuEl.rerender()
            } catch (err) {
              console.error("Permission denied:", err)
            }
          },
        },
      ]
    }

    for (const device of devices) {
      if (!activeInputs.has(device.deviceId)) {
        deviceId ??= device.deviceId
        try {
          const mediaStream = await mediaDevices.getUserMedia({
            audio: { deviceId: { exact: device.deviceId } },
          })
          const label = device.label || `Device ${device.deviceId.slice(0, 8)}`
          const node = new MediaStreamAudioSourceNode(audioContext, {
            mediaStream,
          })
          activeInputs.set(device.deviceId, { mediaStream, node, label })
          if (deviceId === device.deviceId) {
            node.connect(gainNode)
            app.setTitle(label)
          }
        } catch {}
      }
    }

    return devices.map((device) => {
      const isSelected = deviceId === device.deviceId
      const input = activeInputs.get(device.deviceId)
      return {
        tag: "radio",
        checked: isSelected,
        picto: "mic",
        name: `${app.id}__line-in-device`,
        value: device.deviceId,
        label: {
          tag: ".cols.gap.items-center",
          content: [
            {
              tag: "span",
              content: {
                tag: ".truncate",
                style: { maxWidth: "26ch" },
                content: input?.label,
              },
            },
            {
              tag: "ui-volume.shrink",
              small: true,
              inert: true,
              audioInput: input?.node,
              disabled: !input,
            },
          ],
        },
        action(e, target) {
          const prevInput = activeInputs.get(deviceId)
          prevInput?.node.disconnect(gainNode)

          deviceId = target.value
          input?.node.connect(gainNode)

          app.setTitle(input?.label)
        },
      }
    })
  }

  const { signal } = app

  mediaDevices.addEventListener(
    "devicechange", //
    () => {
      cleanupInputs()
      menuEl.rerender()
    },
    { signal },
  )

  app.on("destroy", () => {
    cleanupInputs()
    gainNode.disconnect()
  })

  return {
    tag: "ui-menu.inset.scroll-y-auto.w-full.grow",
    autofocus: true,
    content: makeMenuPlan,
    created(el) {
      menuEl = el
    },
  }
}
