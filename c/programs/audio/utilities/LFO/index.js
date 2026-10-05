import "../../../../../42/ui/control/knob.js"
import { mixer } from "../../../../../42/lib/audio/mixer.js"
import { toTitleCase } from "../../../../../42/lib/type/string/transform.js"
import {
  LFONode,
  lfoWaveform,
} from "../../../../../42/lib/audio/generator/LFONode.js"

/** @param {import("42/api/os/App.js").App} app */
export async function renderApp(app) {
  const osc = await LFONode.init(mixer.context, {
    rate: app.config.frequency ?? app.config.freq ?? 1,
    type: app.config.type ?? "sine",
    depth: app.config.depth ?? 100,
    offset: app.config.offset ?? 0,
  })
  mixer.addTrack(osc, {
    app,
    signal: app.signal,
    autoConnect: false,
    showInMixer: false,
  })
  let canvasEl
  let frame
  let observer
  const controls = {}
  const draw = () => {
    frame = undefined
    if (!canvasEl) return
    const ctx = canvasEl.getContext("2d")
    const width = Math.max(1, canvasEl.clientWidth)
    canvasEl.width = width
    const height = Math.max(1, canvasEl.clientHeight)
    canvasEl.height = height
    ctx.fillStyle =
      getComputedStyle(canvasEl).getPropertyValue("--scope-screen-bg").trim() ||
      "#000"
    ctx.fillRect(0, 0, width, height)
    ctx.globalCompositeOperation = "destination-out"
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (let x = 0; x < width; x++) {
      const phase = ((x / width) * 2 * (controls.rate?.valueAsNumber ?? 1)) % 1
      const value =
        (lfoWaveform(osc.type, phase) *
          (controls.depth?.valueAsNumber ?? 100)) /
          100 +
        (controls.offset?.valueAsNumber ?? 0) / 100
      const y = height * (0.5 - value * 0.4)
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.globalCompositeOperation = "source-over"
  }
  const redraw = () => {
    frame ??= requestAnimationFrame(draw)
  }
  app.signal.addEventListener(
    "abort",
    () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
      osc.destroy()
    },
    { once: true },
  )

  return {
    tag: ".rows.gap-xs.h-full",
    content: [
      {
        tag: ".audio-waveform-preview",
        role: "img",
        aria: { label: "LFO waveform preview, two seconds" },
        css: "& { flex: 1; inline-size: 100%; min-block-size: 40px; }",
        content: {
          tag: ".ui-scope__box",
          content: {
            tag: ".ui-scope__accent",
            content: {
              tag: "canvas.canvas-ready",
              created(el) {
                canvasEl = el
                observer = new ResizeObserver(redraw)
                observer.observe(el)
                redraw()
              },
            },
          },
        },
      },
      {
        // tag: "fieldset.shrink.pa-x-xxs.pa-y-xs.gap-xs.grid-3",
        tag: ".shrink.gap-xxs.grid-3",
        content: [
          ["rate", "Rate", "Hz"],
          ["depth", "Depth", "%"],
          ["offset", "Offset", "%"],
        ].map(([key, label, unit]) => ({
          tag: "ui-knob",
          label,
          unit,
          step: key === "rate" ? 0.001 : 0.1,
          scale: key === "rate" ? "log" : "linear",
          centerDetent: key !== "rate",
          bind: osc[key],
          created(el) {
            controls[key] = el
          },
          on: { input: redraw },
        })),
      },
      {
        tag: ".cols.shrink.gap-xs.pa-xxs",
        content: [
          {
            tag: "select",
            aria: { label: "Waveform" },
            value: osc.type,
            content: LFONode.types.map((type) => [toTitleCase(type), type]),
            on: {
              input(event, target) {
                osc.type = target.value
                redraw()
              },
            },
          },
          {
            tag: "button",
            content: "Hold",
            aria: { pressed: false },
            on: {
              click(event, target) {
                const held = target.ariaPressed !== "true"
                osc.hold.value = Number(held)
                target.ariaPressed = String(held)
              },
            },
          },
        ],
      },
    ],
  }
}
