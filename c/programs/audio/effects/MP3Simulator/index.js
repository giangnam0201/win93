import "../../../../../42/ui/control/knob.js"
import "../../../../../42/ui/control/matrix.js"
import { mixer } from "../../../../../42/lib/audio/mixer.js"
import { MP3SimulatorNode } from "../../../../../42/lib/audio/effect/MP3SimulatorNode.js"

/**
 * @param {import("42/api/os/AudioApp.js").AudioApp} app
 */
export async function renderApp(app) {
  await MP3SimulatorNode.load(mixer.context)
  const node = new MP3SimulatorNode(mixer.context)
  app.audioPipe = node

  const formatNumber = (value, digits = 2) =>
    typeof value === "number" && Number.isFinite(value)
      ? value.toFixed(digits)
      : "-"

  return {
    tag: ".pa-xxs.rows.gap-xxs.liquid",
    content: [
      {
        tag: "fieldset.rows.gap-xxs.pa-y-xxs",
        label: "Codec",
        content: [
          {
            tag: ".shrink.grid-3._pa-xs",
            // label: "Codec",
            content: [
              {
                tag: "ui-knob",
                medium: true,
                label: "Quality",
                min: 0.3,
                max: 1,
                bind: node.quality,
              },
              {
                tag: "ui-knob",
                medium: true,
                scale: "log",
                label: "Bitrate",
                bind: node.bitrate,
              },
              {
                tag: "ui-knob",
                medium: true,
                label: "Feedback",
                bind: node.feedback,
              },
            ],
          },

          {
            // tag: "fieldset.split-3._gap.pa-xxs",
            tag: ".split-3._gap.pa-xxs",
            content: [
              {
                tag: "ui-knob",
                centerDetent: true,
                label: "Bias",
                bind: node.bias,
              },
              {
                tag: "ui-knob",
                label: "Glitch",
                bind: node.glitch,
              },
              {
                tag: "ui-knob",
                label: "Mix",
                bind: node.mix,
              },
            ],
          },
        ],
      },

      {
        tag: "fieldset.rows.grow.gap-xxs.pa-xs",
        label: "Band Reassignment",
        content: [
          {
            tag: "ui-matrix.inset",
            cols: MP3SimulatorNode.bandReassignmentBandCount,
            rows: MP3SimulatorNode.bandReassignmentBandCount,
            style: {
              minWidth: "185px",
              minHeight: "85px",
            },
            on: {
              input: (_, target) => {
                node.setBandReassignments(target.value)
              },
            },
            created(el, { signal }) {
              const matrix =
                /** @type {import("../../../../../42/ui/control/matrix.js").MatrixControl} */ (
                  el
                )

              const syncMatrix = () => {
                matrix.value = node.getBandReassignments()
              }

              node.addEventListener(
                "band-reassignments", //
                syncMatrix,
                { signal },
              )

              syncMatrix()
            },
          },

          {
            tag: ".cols.shrink.gap-xxs._hide",
            content: [
              {
                tag: "button.grow",
                picto: "rampwave",
                title: "Reset",
                onclick: () => node.resetBandReassignments(),
              },
              {
                tag: "button.grow",
                picto: "dice-3",
                title: "Random",
                onclick: () => node.randomizeBandReassignments(),
              },
              {
                tag: "button.grow",
                picto: "plus",
                title: "Shift +",
                onclick: () => node.shiftBandReassignments(1),
              },
              {
                tag: "button.grow",
                picto: "minus",
                title: "Shift -",
                onclick: () => node.shiftBandReassignments(-1),
              },
            ],
          },
        ],
      },

      {
        if: false,
        tag: "fieldset.rows.gap-xxs.pa-xs",
        label: "Diagnostics",
        content: {
          tag: "pre.mono.pa-xs",
          created(el, { signal }) {
            const renderDiagnostics = () => {
              const { worker } = node.diagnostics
              const { processor } = node.diagnostics

              el.textContent = [
                `worker: ${worker.lastStatus ?? "booting"}`,
                `bitrate req/active: ${worker.requestedBitrate ?? 0}/${worker.activeBitrate ?? worker.bitrate ?? 0}  recoveries: ${worker.recoveries ?? 0}`,
                `wet frames: ${worker.decodedFrames ?? 0}  fallback: ${worker.fallbackFrames ?? 0}  invalid: ${worker.invalidFrames ?? 0}`,
                `bytes/frame: ${worker.lastEncodedBytes ?? 0}  decode in/out: ${worker.lastEnqueuedFrames ?? 0}/${worker.lastDecodedFrames ?? 0}`,
                `decoder buffered: ${worker.decoderBufferedFrames ?? 0}  boundary jump: ${formatNumber(worker.lastBoundaryJump ?? 0, 4)} max: ${formatNumber(worker.maxBoundaryJump ?? 0, 4)}`,
                `spikes fixed: ${worker.lastRepairedSpikes ?? 0} total: ${worker.repairedSpikes ?? 0}`,
                `reconfigures: ${worker.reconfigures ?? 0}`,
                `buffered: ${processor.bufferedFrames ?? 0}  pending: ${processor.pendingFrames ?? 0}  underruns: ${processor.underruns ?? 0}`,
                `drops in/out: ${processor.inputDrops ?? 0}/${processor.outputDrops ?? 0}  trims: ${processor.latencyTrims ?? 0}`,
                `wet active: ${processor.wetActive ? "yes" : "no"}  wet mix: ${formatNumber(processor.mixState, 3)}`,
              ].join("\n")
            }

            renderDiagnostics()
            node.addEventListener("diagnostics", renderDiagnostics, {
              signal,
            })

            const timer = setInterval(renderDiagnostics, 250)
            signal.addEventListener("abort", () => clearInterval(timer), {
              once: true,
            })
          },
        },
      },
    ],
  }
}
