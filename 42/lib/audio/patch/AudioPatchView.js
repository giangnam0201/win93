import { AudioPatchGraph } from "./AudioPatchGraph.js"
import {
  audioParamTargets,
  audioParamTargetEvents,
} from "../audioParamTargets.js"
import { paintThread } from "../../graphic/paintThread.js"
import { createPatchScene, writePatchScene } from "./patchScene.js"
import { appendCSS } from "../../dom/appendCSS.js"
import { render } from "../../../api/gui/render.js"
import { positionable } from "../../../api/gui/trait/positionable.js"
import { toast } from "../../../ui/layout/toast.js"
import "../../../ui/layout/menu.js"
import "../../../ui/control/knob.js"
import { getParamModulation } from "../paramModulation.js"
import { keep } from "../../../api/keep.js"
import { selectAudioIO } from "../../../api/os/selectAudioIO.js"

function isControlConnected(el) {
  return (
    el.isConnected &&
    (el.ownerDocument === document ||
      el.ownerDocument.defaultView?.frameElement?.isConnected)
  )
}

function hasOpeningAnimation(dialog) {
  return !(
    dialog.maximized ||
    dialog.classList.contains("animation-false") ||
    (dialog.role === "alertdialog" && !("animationIn" in dialog.dataset))
  )
}

/** Desktop canvas editor for mixer tracks and bound AudioParams. */
export class AudioPatchView {
  static async init(mixer) {
    const options = await keep("~/config/audio-graph.json5", {
      showCables: true,
      showMainCables: true,
      useStraightCables: false,
    })
    options.showCables ??= true
    options.showMainCables ??= true
    options.useStraightCables ??= false
    mixer.patchOptions = options
    if (options.showCables) mixer.patchView ??= new AudioPatchView(mixer)
    else {
      mixer.patchView?.destroy()
      mixer.patchView = undefined
    }
    return options
  }

  ports = new Map()
  targets = new Map()
  paramPorts = new Map()
  paramControls = new Map()
  dialogs = new Map()
  documents = new Map()
  edges = new Map()
  ids = new WeakMap()
  nextId = 1
  stableRects = new Map()
  dirtyRects = new Set()
  animations = new Map()
  sizeUpdates = new WeakSet()
  opening = new WeakSet()
  closing = new WeakSet()
  frame = 0
  selected
  pending

  constructor(mixer) {
    if (typeof SharedArrayBuffer === "undefined") return
    this.mixer = mixer
    this.graph = new AudioPatchGraph(mixer)
    this.controller = new AbortController()
    const { signal } = this.controller
    this.canvas = document.createElement("canvas")
    this.canvas.className = "audio-patch-canvas"
    this.canvas.tabIndex = -1
    this.canvas.ariaLabel =
      "Audio cables. Delete removes the selected connection."
    document.body.append(this.canvas)
    this.style = appendCSS(
      /* css */ `
      .audio-patch-canvas { position: fixed; inset: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: calc(var(--z-popup) - 1); image-rendering: pixelated; }
      input.audio-patch-port { flex: none; cursor: crosshair; margin-inline: 3px;
        --size: var(--audio-port-size, var(--radio-size, var(--checkbox-size, var(--addon-size))));
        background: var(--audio-port-bg, var(--radio-bg, var(--bg)));
        border-color: var(--audio-port-bdc, var(--radio-bdc, var(--bdc)));
        border-width: var(--audio-port-bdw, var(--radio-bdw, var(--bdw)));
        border-style: var(--audio-port-bds, var(--radio-bds, var(--bds)));
        border-radius: var(--audio-port-bdr, var(--radio-bdr, 100%));
        border-image: var(--audio-port-bdi, var(--radio-bdi, var(--bdi)));
      }
      .audio-cable-toolbar, .audio-cable-popup { position: fixed; z-index: var(--z-popup); }
      .audio-cable-popup { background: var(--bg); }
      .audio-patch-port:not(.audio-patch-param-inlet) { position: relative; }
      .audio-patch-port::before { display: none; }
      :root[audio-patch-dragging] .audio-patch-port:not(.audio-patch-param-inlet)::before {
        display: block; position: absolute; left: 50%; top: 50%;
        width: 32px; height: 32px; transform: translate(-50%, -50%);
        border: 0; border-radius: 100%; background: transparent;
        pointer-events: none;
      }
    `,
      { signal },
    )
    this.invalidate = () => {
      if (!this.frame) {
        this.frame = requestAnimationFrame(() => {
          this.frame = 0
          this.update()
        })
      }
    }
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const { target } of entries) {
        this.dirtyRects.add(target)
        target.recalculateSize?.()
      }
      this.invalidate()
    })
    this.invalidateStyle = () => {
      this.cableStyle = undefined
      for (const dialog of this.dialogs.keys()) this.dirtyRects.add(dialog)
      this.invalidate()
    }
    this.themeObserver = new MutationObserver(this.invalidateStyle)
    this.themeObserver.observe(document.documentElement, { attributes: true })
    this.themeObserver.observe(document.body, { attributes: true })
    document.addEventListener(
      "load",
      (event) => {
        if (event.target.tagName === "LINK") this.invalidateStyle()
      },
      { capture: true, signal },
    )
    this.graph.on("change", { signal }, this.invalidate)
    this.graph.on("trackClosing", { signal }, (track) =>
      this.hideDialog(track.dialogEl),
    )
    mixer.on("patchOptions", { signal }, this.invalidateStyle)
    audioParamTargetEvents.addEventListener("change", this.invalidate, {
      signal,
    })
    this.thread = paintThread(new URL("./patchCables.w.js", import.meta.url), {
      canvas: this.canvas,
      signal,
    }).thread
    this.listen(document)
    window.addEventListener("resize", this.invalidateStyle, { signal })
    this.invalidate()
  }

  listen(doc) {
    if (this.documents.has(doc)) return
    const controller = new AbortController()
    this.documents.set(doc, controller)
    const signal = AbortSignal.any([this.controller.signal, controller.signal])
    const options = { signal, capture: true }
    if (doc !== document) {
      const styleEl = doc.createElement("style")
      styleEl.textContent = this.style.el.textContent
      doc.head.append(styleEl)
      signal.addEventListener("abort", () => styleEl.remove(), { once: true })
    }
    doc.addEventListener(
      "ui:dialog.open",
      (event) => {
        this.refreshDialogSize(event.target)
        if (hasOpeningAnimation(event.target)) {
          this.trackOpening(event.target)
        }
      },
      options,
    )
    doc.addEventListener(
      "ui:dialog.close",
      (event) => this.hideDialog(event.target),
      options,
    )
    // TODO: check if needed
    doc.addEventListener(
      "ui:dialog.before-remove",
      (event) => {
        const dialog = event.target
        queueMicrotask(() => {
          if (event.defaultPrevented) return
          this.hideDialog(dialog)
        })
      },
      options,
    )
    for (const type of [
      "animationstart",
      "transitionrun",
      "animationend",
      "transitionend",
      "animationcancel",
      "transitioncancel",
    ]) {
      doc.addEventListener(
        type,
        (event) => {
          if (event.target.matches?.("ui-dialog")) this.invalidate()
        },
        options,
      )
    }
    doc.defaultView.addEventListener(
      "pagehide",
      () => {
        controller.abort()
        this.documents.delete(doc)
        for (const [el, param] of this.targets) {
          if (el.ownerDocument !== doc) continue
          this.graph.removeParam(param)
          this.targets.delete(el)
          const control = this.paramControls.get(el) ?? el
          audioParamTargets.delete(control)
          this.paramPorts.delete(control)
          this.paramControls.delete(el)
          if (control !== el) el.remove()
        }
        this.invalidate()
      },
      { signal, once: true },
    )
    doc.addEventListener("pointerdown", (event) => this.down(event), options)
    doc.addEventListener("pointermove", (event) => this.move(event), options)
    doc.addEventListener("pointerup", (event) => this.up(event), options)
    doc.addEventListener(
      "pointercancel",
      () => {
        this.pressedCable = undefined
        if (this.repositioning) this.finishConnection()
        else {
          this.pending = undefined
          this.focusTarget()
          this.showParamPorts(false)
          this.invalidate()
        }
      },
      options,
    )
    doc.defaultView.addEventListener(
      "keydown",
      (event) => {
        if (
          this.pending &&
          this.keyboardPending &&
          (event.key === "Enter" || event.key === " ")
        ) {
          const param = this.targets.get(event.target)
          if (param && !param.destinations) {
            event.preventDefault()
            event.stopImmediatePropagation()
            this.graph.connect(this.pending, param)
            this.pending = undefined
            this.showParamPorts(false)
            this.invalidate()
            return
          }
        }
        if (event.key === "Escape") {
          this.pending = undefined
          this.repositioning = undefined
          this.pressedCable = undefined
          this.clearSelection()
          this.focusTarget()
          this.showParamPorts(false)
          this.invalidate()
        } else if (
          (event.key === "Delete" || event.key === "Backspace") &&
          this.selected &&
          (event.target === this.canvas ||
            this.toolbarEl?.contains(event.target))
        ) {
          event.preventDefault()
          event.stopImmediatePropagation()
          this.graph.disconnect(this.selected)
          this.clearSelection()
          this.invalidate()
        }
      },
      options,
    )
    doc.addEventListener(
      "scroll",
      () => {
        for (const dialog of this.dialogs.keys()) this.dirtyRects.add(dialog)
        this.invalidate()
      },
      options,
    )
  }

  coordinates(event) {
    const frame = event.target.ownerDocument.defaultView.frameElement
    const rect = frame?.getBoundingClientRect()
    return {
      x: event.clientX + (rect?.left ?? 0),
      y: event.clientY + (rect?.top ?? 0),
    }
  }

  move(event) {
    const point = this.coordinates(event)
    if (this.pressedCable) {
      const { edge, start } = this.pressedCable
      if (Math.hypot(point.x - start.x, point.y - start.y) < 5) return
      this.startConnection(edge.source, point, edge)
    }
    if (!this.pending) return
    const entry = this.targetEntryAt(point.x, point.y)
    this.focusTarget(entry?.el)
    this.pointer = entry
      ? this.sceneEndpoint(entry.el, this.sceneRects ?? new Map())
      : point
    const cable = this.sceneCables?.at(-1)
    if (!this.frame && cable?.id === -1) {
      cable.to = this.pointer
      this.publish(
        this.hitWidth,
        this.hitHeight,
        this.sceneObstacles,
        this.sceneCables,
      )
    } else this.invalidate()
  }

  up(event) {
    this.pressedCable = undefined
    if (!this.pending || this.keyboardPending) return
    if (this.skipPointerUp === event.pointerId) {
      this.skipPointerUp = undefined
      return
    }
    const point = this.coordinates(event)
    const entry = this.targetEntryAt(point.x, point.y)
    this.finishConnection(entry?.target, event.shiftKey)
  }

  targetAt(x, y) {
    return this.targetEntryAt(x, y)?.target
  }

  targetEntryAt(x, y) {
    let el = document.elementFromPoint(x, y)
    if (el?.tagName === "IFRAME") {
      const rect = el.getBoundingClientRect()
      try {
        el = el.contentDocument.elementFromPoint(x - rect.left, y - rect.top)
      } catch {
        return
      }
    }
    const hit = el
    for (; el; el = el.parentElement) {
      if (this.targets.has(el) && this.targets.get(el) !== this.pending) {
        return { el, target: this.targets.get(el) }
      }
      const port = this.paramPorts.get(el)
      const target = this.targets.get(port)
      if (
        target !== undefined &&
        target !== this.pending &&
        el.matches("ui-knob, ui-volume")
      ) {
        return { el: port, target }
      }
    }
    if (!this.pending) return
    return this.nearestTargetAt(x, y, hit)
  }

  nearestTargetAt(x, y, hit) {
    let nearest
    let distance = Infinity
    for (const [port, target] of this.targets) {
      if (target === this.pending || !port.matches(".audio-patch-port")) {
        continue
      }
      if (port.getClientRects().length === 0) continue
      const center = this.sceneEndpoint(port, this.sceneRects ?? new Map())
      if (!center) continue
      const radius =
        Number.parseFloat(getComputedStyle(port, "::before").width) / 2
      const delta = Math.hypot(x - center.x, y - center.y)
      if (!Number.isFinite(radius) || delta > radius || delta >= distance) {
        continue
      }
      const frame = port.ownerDocument.defaultView.frameElement
      const dialog = (frame ?? port).closest("ui-dialog")
      const hitFrame = hit?.ownerDocument.defaultView.frameElement
      const hitDialog = (hitFrame ?? hit)?.closest("ui-dialog")
      if (hitDialog && hitDialog !== dialog) continue
      const visible = document.elementFromPoint(center.x, center.y)
      if (visible !== frame && visible !== port && !port.contains(visible)) {
        continue
      }
      nearest = { el: port, target }
      distance = delta
    }
    return nearest
  }

  focusTarget(el) {
    if (this.focusedTarget === el) return
    this.focusedTarget?.classList.remove("focus")
    this.focusedTarget = el
    el?.classList.add("focus")
  }

  showParamPorts(show) {
    for (const doc of this.documents.keys()) {
      doc.documentElement.toggleAttribute("audio-patch-dragging", show)
    }
  }

  clearSelection() {
    this.selected = undefined
    this.hideCableToolbar()
    this.toolbarPosition = undefined
  }

  hideCableToolbar() {
    this.closeCablePopup()
    this.toolbarEl?.remove()
    this.toolbarEl = undefined
  }

  startConnection(source, pointer, repositioning) {
    this.pressedCable = undefined
    if (repositioning) this.hideCableToolbar()
    else this.clearSelection()
    this.pending = source
    this.repositioning = repositioning
    this.keyboardPending = false
    this.pointer = pointer
    this.showParamPorts(true)
    this.invalidate()
  }

  finishConnection(target, keepSource = false) {
    const source = this.pending
    const replaced = this.repositioning
    if (!source) return
    let didReplace = false
    if (target && target !== replaced?.target) {
      const connected = this.graph.connect(source, target)
      if (connected && replaced) {
        this.graph.disconnect(replaced)
        didReplace = true
      }
    }
    if (!keepSource || !target) {
      this.pending = undefined
      this.repositioning = undefined
    } else if (replaced && target !== replaced.target) {
      this.repositioning = undefined
      this.clearSelection()
    }
    this.focusTarget()
    this.showParamPorts(Boolean(this.pending))
    if (replaced && !didReplace && this.toolbarPosition) {
      this.showCableToolbar(
        replaced,
        this.toolbarPosition.x,
        this.toolbarPosition.y,
      )
    } else if (didReplace) this.clearSelection()
    this.invalidate()
  }

  showCableToolbar(edge, x, y) {
    this.toolbarPosition = { x, y }
    this.closeCablePopup()
    this.toolbarEl?.remove()
    const cable = getParamModulation(edge.source, edge.target)
    const toolbarEl = render(
      {
        tag: "ui-toolbar.audio-cable-toolbar",
        aria: { label: "Connection actions" },
        content: [
          cable
            ? {
                picto: "faders",
                label: "Edit Depth and Offset",
                action: (event, target) => this.editCable(cable, target),
              }
            : {
                picto: "plus",
                label: "Insert effect",
                action: () => this.insertEffect(edge),
              },
          {
            picto: "aim",
            label: "Reposition",
            action: (event) => {
              this.skipPointerUp = event.pointerId
              this.startConnection(edge.source, { x, y }, edge)
            },
          },
          {
            // picto: "trash",
            picto: "cross-2",
            label: "Remove connection",
            action: () => {
              this.graph.disconnect(edge)
              this.clearSelection()
              this.invalidate()
            },
          },
        ],
      },
      document.body,
    )
    this.toolbarEl = toolbarEl
    toolbarEl.ready.then(() => {
      if (!toolbarEl.isConnected) return
      const bounds = toolbarEl.getBoundingClientRect()
      toolbarEl.style.left = `${Math.max(0, Math.min(x - 8, innerWidth - bounds.width))}px`
      toolbarEl.style.top = `${Math.max(0, Math.min(y - 18, innerHeight - bounds.height))}px`
      // toolbarEl.style.left = `${Math.max(0, Math.min(x + 12, innerWidth - bounds.width))}px`
      // toolbarEl.style.top = `${Math.max(0, Math.min(y + 12, innerHeight - bounds.height))}px`
    })
  }

  async insertEffect(edge) {
    const position = this.toolbarPosition
    this.clearSelection()
    this.invalidate()
    try {
      const { selectAudioEffect } = await import(
        "../../../api/os/selectAudioEffect.js"
      )
      const selection = await selectAudioEffect(edge, {
        signal: this.controller.signal,
        mixer: this.mixer,
        position,
      })
      if (!selection || this.controller.signal.aborted) return
      await this.graph.insertEffect(edge, selection.track, selection.preserve)
    } catch (error) {
      toast(error.message)
    }
    this.invalidate()
  }

  closeCablePopup() {
    if (this.popupOpenerEl) this.popupOpenerEl.ariaExpanded = "false"
    this.popupOpenerEl = undefined
    this.popupController?.abort()
    this.popupController = undefined
    this.popupEl?.remove()
    this.popupEl = undefined
  }

  async editCable(cable, openerEl) {
    if (this.popupEl) {
      this.closeCablePopup()
      return
    }
    this.popupOpenerEl = openerEl
    if (openerEl) openerEl.ariaExpanded = "true"
    this.popupController = new AbortController()
    const { signal } = this.popupController
    const popupEl = render(
      {
        tag: "fieldset.audio-cable-popup.panel.outset.cols.gap.pa",
        aria: { label: "Edit Depth and Offset" },
        content: [
          ["depth", "Depth"],
          ["offsetValue", "Offset"],
        ].map(([key, label]) => ({
          tag: "ui-knob",
          label,
          title: `${cable[key].toFixed(1)} %`,
          min: -100,
          max: 100,
          step: 0.1,
          unit: "%",
          centerDetent: true,
          value: cable[key],
          on: {
            input(event, target) {
              cable[key] = target.valueAsNumber
              target.title = `${target.value} %`
            },
          },
        })),
      },
      document.body,
    )
    this.popupEl = popupEl
    cable.controller.signal.addEventListener(
      "abort",
      () => this.clearSelection(),
      { once: true, signal },
    )
    const knobEls = [...popupEl.querySelectorAll("ui-knob")]
    await Promise.all(knobEls.map((el) => el.ready))
    if (signal.aborted) return
    positionable(popupEl, { of: this.toolbarEl, preset: "popup", signal })
    knobEls[0].focus()
  }

  down(event) {
    if (
      this.toolbarEl?.contains(event.target) ||
      this.popupEl?.contains(event.target)
    ) {
      return
    }
    if (event.button !== 0) return
    const port = event.target.closest?.(".audio-patch-port")
    if (port) {
      event.preventDefault()
      event.stopImmediatePropagation()
      const source = this.ports.get(port)
      if (source) {
        this.startConnection(source, this.coordinates(event))
        port.setPointerCapture(event.pointerId)
      }
      return
    }
    if (!this.pending) {
      const { x, y } = this.coordinates(event)
      const bank = this.hitMeta ? Atomics.load(this.hitMeta, 0) : 0
      const inside = x >= 0 && y >= 0 && x < this.hitWidth && y < this.hitHeight
      const id = inside
        ? this.hitPixels?.[
            bank * this.hitWidth * this.hitHeight +
              Math.floor(y) * this.hitWidth +
              Math.floor(x)
          ]
        : undefined
      const cable = this.edges.get(id)
      if (cable) {
        this.selected = cable
        this.showCableToolbar(cable, x, y)
        this.pressedCable = { edge: cable, start: { x, y } }
        event.preventDefault()
        event.stopImmediatePropagation()
        this.canvas.focus({ preventScroll: true })
        this.invalidate()
        return
      }
      if (this.selected) {
        this.clearSelection()
        this.invalidate()
      }
    }
    if (this.pending) return
  }

  port(track, container, output) {
    const el = document.createElement("input")
    el.type = "radio"
    el.className = `audio-patch-port audio-patch-port--${output ? "outlet" : "inlet"}`
    el.ariaLabel = `${track.name ?? "Audio"} ${output ? "outlet" : "inlet"}`
    el.title = el.ariaLabel
    el.addEventListener("click", (event) => event.preventDefault())
    if (output) {
      const showAudioIO = (event) => {
        event.preventDefault()
        event.stopImmediatePropagation()
        this.showAudioIO(track)
      }
      el.addEventListener("dblclick", showAudioIO)
      el.addEventListener("contextmenu", showAudioIO)
    }
    el.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (output) {
        this.pending = track
        this.keyboardPending = true
        this.showParamPorts(true)
      } else if (this.pending) {
        this.graph.connect(this.pending, track)
        this.pending = undefined
        this.showParamPorts(false)
      }
      this.invalidate()
    })
    if (output) {
      container.append(el)
      this.ports.set(el, track)
    } else {
      container.prepend(el)
      this.targets.set(el, track)
    }
    const frame = container.ownerDocument.defaultView.frameElement
    const dialog = (frame ?? container).closest("ui-dialog")
    this.refreshDialogSize(dialog)
    return el
  }

  refreshDialogSize(dialog) {
    if (!dialog || this.sizeUpdates.has(dialog)) return
    this.sizeUpdates.add(dialog)
    Promise.resolve(dialog.ready).then(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.sizeUpdates.delete(dialog)
          if (dialog.isConnected) dialog.recalculateSize?.()
        })
      })
    })
  }

  showAudioIO(track) {
    const { app } = track
    if (!app?.dialogEl) return
    if (typeof app.selectAudioIO === "function") {
      return app.selectAudioIO()
    }
    if (app.selecting) {
      app.selecting.rerender?.()
      app.selecting.activate?.()
      return
    }
    app.selecting = true
    return selectAudioIO(
      {
        current: track,
        displayInputs: false,
        signal: app.signal,
        label: `${app.name ?? track.name} - Audio I/O`,
        picto: app.picto ?? track.picto,
      },
      app,
    ).finally(() => {
      app.selecting = false
    })
  }

  sync() {
    const tracks = [...this.graph.tracks()]
    const hasEffect = tracks.some(
      (track) => track.isEffectTrack || track.app?.manifest?.audioPatchOutput,
    )
    if (this.pending && !tracks.includes(this.pending)) this.pending = undefined
    for (const [el, track] of [...this.ports, ...this.targets]) {
      if (
        track.destinations &&
        (!tracks.includes(track) ||
          !el.isConnected ||
          ((this.ports.has(el) || this.targets.has(el)) && !hasEffect))
      ) {
        this.ports.delete(el)
        this.targets.delete(el)
        el.remove()
      }
    }
    const dialogs = [...document.querySelectorAll("ui-dialog")]
    for (const dialog of dialogs) {
      if (!this.dialogs.has(dialog)) {
        const observer = new MutationObserver((records) => {
          if (records.every((record) => record.attributeName === "style")) {
            this.moveDialog(dialog)
          } else this.invalidate()
        })
        observer.observe(dialog, { attributes: true })
        this.resizeObserver.observe(dialog)
        const forget = dialog.app?.on("destroy", { off: true }, () =>
          this.hideDialog(dialog),
        )
        const headerEl = dialog.querySelector(".ui-dialog__header")
        const beforeButtonsEl = headerEl?.querySelector(
          ".ui-dialog__buttons--before",
        )
        const closeButtonsEl = headerEl?.querySelector(
          ".ui-dialog__buttons:last-child",
        )
        this.dialogs.set(dialog, {
          observer,
          forget,
          headerEl,
          beforeButtonsEl,
          closeButtonsEl,
        })
      }
    }
    for (const [dialog, { observer, forget }] of this.dialogs) {
      if (!dialog.isConnected) {
        observer.disconnect()
        forget?.()
        this.resizeObserver.unobserve(dialog)
        this.dialogs.delete(dialog)
        this.stableRects.delete(dialog)
        this.dirtyRects.delete(dialog)
      }
    }
    for (const track of tracks) {
      this.syncTrackPorts(track, dialogs, hasEffect)
    }
    this.syncParams()
    return dialogs.filter(
      (el) => !el.minimized && el.getClientRects().length > 0,
    )
  }

  syncTrackPorts(track, dialogs, hasEffect) {
    const dialog = track.isMainTrack
      ? dialogs.find((el) => el.app?.command === "mixer")
      : track.dialogEl
    const { beforeButtonsEl, closeButtonsEl } = this.dialogs.get(dialog) ?? {}
    if (!beforeButtonsEl || !closeButtonsEl) return
    if (
      hasEffect &&
      track.hasAudioOutput !== false &&
      ![...this.ports.values()].includes(track)
    ) {
      this.port(track, closeButtonsEl, true)
    }
    if (
      hasEffect &&
      (track.isEffectTrack || track.isMainTrack) &&
      ![...this.targets.values()].includes(track)
    ) {
      this.port(track, beforeButtonsEl, false)
    }
  }

  syncParams() {
    for (const [doc, controller] of this.documents) {
      if (doc === document || doc.defaultView?.frameElement?.isConnected) {
        continue
      }
      controller.abort()
      this.documents.delete(doc)
    }
    for (const [el, param] of this.targets) {
      const control = this.paramControls.get(el)
      if (
        !param.destinations &&
        (!isControlConnected(el) ||
          audioParamTargets.get(control ?? el) !== param)
      ) {
        if (control) this.paramPorts.delete(control)
        this.paramControls.delete(el)
        if (![...audioParamTargets.values()].includes(param)) {
          this.graph.removeParam(param)
        }
        this.targets.delete(el)
        if (control) el.remove()
      }
    }
    for (const [el, param] of audioParamTargets) {
      if (isControlConnected(el)) {
        let port = this.paramPorts.get(el)
        if (
          !port &&
          el.matches('[data-audio-param="true"]') &&
          el.localName.includes("-")
        ) {
          const container =
            el.localName === "ui-knob"
              ? el.querySelector(".ui-knob__ring-box")
              : el
          if (!container) continue
          port = this.port(param, container, false)
          port.classList.add("audio-patch-param-inlet")
          this.paramPorts.set(el, port)
          this.paramControls.set(port, el)
        }
        if (port) this.targets.set(port, param)
        else this.targets.set(el, param)
        this.listen(el.ownerDocument)
      }
    }
  }

  endpoint(el, rects) {
    if (!el || !isControlConnected(el) || el.getClientRects().length === 0) {
      return
    }
    const frame = el.ownerDocument.defaultView.frameElement
    const dialog = (frame ?? el).closest("ui-dialog")
    if (dialog?.minimized || this.closing.has(dialog)) return
    const bounds = el.getBoundingClientRect()
    const offset = frame?.getBoundingClientRect()
    return {
      x: bounds.left + bounds.width / 2 + (offset?.left ?? 0),
      y: bounds.top + bounds.height / 2 + (offset?.top ?? 0),
      rect: rects.get(dialog),
    }
  }

  id(value) {
    if (!this.ids.has(value)) this.ids.set(value, this.nextId++)
    return this.ids.get(value)
  }

  stableRect(dialog) {
    if (this.opening.has(dialog)) return
    if (this.closing.has(dialog)) return
    const animations = dialog
      .getAnimations()
      .filter(
        (animation) => animation.playState === "running" || animation.pending,
      )
    if (animations.length > 0) {
      if (!this.animations.has(dialog)) {
        const done = Promise.allSettled(
          animations.map((animation) => animation.finished),
        )
        this.animations.set(dialog, done)
        done.then(() => {
          this.animations.delete(dialog)
          this.dirtyRects.add(dialog)
          if (!this.controller.signal.aborted) this.invalidate()
        })
      }
      return this.stableRects.get(dialog)
    }
    const entry = this.dialogs.get(dialog)
    const style = dialog.style.cssText
    if (
      this.stableRects.has(dialog) &&
      entry.geometryStyle === style &&
      !this.dirtyRects.has(dialog)
    ) {
      return this.stableRects.get(dialog)
    }
    this.dirtyRects.delete(dialog)
    entry.geometryStyle = style
    const rect = dialog.getBoundingClientRect()
    this.stableRects.set(dialog, rect)
    return rect
  }

  validateSelection() {
    if (
      this.selected &&
      !this.graph
        .connections()
        .some(
          (edge) =>
            edge.source === this.selected.source &&
            edge.target === this.selected.target,
        )
    ) {
      this.clearSelection()
    }
  }

  update() {
    this.validateSelection()
    if (!this.cableStyle) this.readStyle()
    const dialogs = this.sync()
    const rects = new Map()
    for (const dialog of dialogs) {
      const rect = this.stableRect(dialog)
      if (rect) rects.set(dialog, rect)
    }
    this.sceneRects = rects
    for (const dialog of this.stableRects.keys()) {
      if (!dialogs.includes(dialog)) this.stableRects.delete(dialog)
    }
    const width = window.innerWidth
    const height = window.innerHeight
    const obstacles = [...rects].map(([el, rect]) => ({
      id: this.id(el),
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      z: Number(el.style.zIndex) || 0,
    }))
    const edges = new Map()
    const cables = []
    const sourceEls = new Map([...this.ports].map(([el, track]) => [track, el]))
    const targetEls = new Map(
      [...this.targets].map(([el, track]) => [track, el]),
    )
    const connectedParamPorts = new Set()
    for (const edge of this.graph.connections()) {
      if (
        !this.mixer.patchOptions.showMainCables &&
        (edge.insert || edge.source.isMainTrack || edge.target.isMainTrack)
      ) {
        continue
      }
      const sourceEl = sourceEls.get(edge.source)
      const targetEl = targetEls.get(edge.target)
      if (this.paramControls.has(targetEl)) connectedParamPorts.add(targetEl)
      const from = this.sceneEndpoint(sourceEl, rects)
      const to = this.sceneEndpoint(targetEl, rects)
      if (!from || !to) continue
      const id = this.edgeId(edge)
      edges.set(id, edge)
      cables.push({
        id,
        destination: this.id(edge.target),
        from,
        to,
        selected:
          this.selected?.source === edge.source &&
          this.selected?.target === edge.target,
        color: this.cableColor(id),
      })
    }
    for (const port of this.paramControls.keys()) {
      port.classList.toggle("connected", connectedParamPorts.has(port))
    }
    this.edges = edges
    this.sceneCables = cables
    this.sceneObstacles = obstacles
    if (this.pending && this.pointer) {
      const sourceEl = sourceEls.get(this.pending)
      const from = this.sceneEndpoint(sourceEl, rects)
      if (from) {
        cables.push({
          id: -1,
          destination: -1,
          from,
          to: this.pointer,
          selected: true,
        })
      }
    }
    this.publish(width, height, obstacles, cables)
  }

  moveDialog(dialog) {
    const previous = this.stableRects.get(dialog)
    if (
      !previous ||
      this.frame ||
      this.animations.has(dialog) ||
      this.closing.has(dialog)
    ) {
      this.invalidate()
      return
    }
    const rect = dialog.getBoundingClientRect()
    if (rect.width !== previous.width || rect.height !== previous.height) {
      this.invalidate()
      return
    }
    const dx = rect.left - previous.left
    const dy = rect.top - previous.top
    const id = this.id(dialog)
    const obstacle = this.sceneObstacles.find((item) => item.id === id)
    if (!obstacle) return
    const z = Number(dialog.style.zIndex) || 0
    if (!dx && !dy && obstacle.z === z) return
    obstacle.z = z
    this.stableRects.set(dialog, rect)
    this.dialogs.get(dialog).geometryStyle = dialog.style.cssText
    obstacle.left += dx
    obstacle.right += dx
    obstacle.top += dy
    obstacle.bottom += dy
    const points = new Set()
    for (const cable of this.sceneCables) {
      if (cable.from.dialog === id) points.add(cable.from)
      if (cable.to.dialog === id) points.add(cable.to)
    }
    for (const point of points) {
      point.x += dx
      point.y += dy
    }
    this.publish(
      this.hitWidth,
      this.hitHeight,
      this.sceneObstacles,
      this.sceneCables,
    )
  }

  readStyle() {
    const css = getComputedStyle(this.canvas)
    const number = (name, fallback) => {
      const value = Number.parseFloat(css.getPropertyValue(name))
      return Number.isFinite(value) ? Math.max(0, value) : fallback
    }
    const configuredColor =
      css.getPropertyValue("--audio-cable-color").trim() || "random" // "#fff"
    const randomColors = configuredColor === "random"
    const palette = randomColors
      ? Array.from({ length: 20 }, (_, index) =>
          css.getPropertyValue(`--audio-cable-palette-${index + 1}`).trim(),
        ).filter(Boolean)
      : undefined
    this.randomCableColors = randomColors && palette.length > 0
    this.cableStyle = {
      color: randomColors ? "#fff" : configuredColor,
      palette,
      selectedColor:
        css.getPropertyValue("--audio-cable-selected-color").trim() ||
        css.getPropertyValue("--accent-color").trim() ||
        "#00f",
      borderColor:
        css.getPropertyValue("--audio-cable-border-color").trim() || "#0008",
      width: number("--audio-cable-width", 2),
      borderWidth: number("--audio-cable-border-width", 1),
      straightLines: this.mixer.patchOptions.useStraightCables,
    }
  }

  cableColor(id) {
    if (!this.randomCableColors) return 0
    return ((id - 1) % this.cableStyle.palette.length) + 1
  }

  publish(width, height, obstacles, cables) {
    if (!this.cableStyle) this.readStyle()
    const signature = JSON.stringify([
      width,
      height,
      obstacles,
      cables,
      this.cableStyle,
    ])
    if (signature === this.sceneSignature) return
    this.sceneSignature = signature
    const capacity = 4 + obstacles.length * 6 + cables.length * 12
    if (!this.scene || this.scene.values.length < capacity) {
      this.scene = createPatchScene(Math.max(256, capacity * 2))
    }
    this.revision = writePatchScene(
      this.scene,
      width,
      height,
      obstacles,
      cables,
    )
    if (this.hitWidth !== width || this.hitHeight !== height) {
      this.hitWidth = width
      this.hitHeight = height
      this.hits = new SharedArrayBuffer(16 + width * height * 8)
      this.hitMeta = new Int32Array(this.hits, 0, 4)
      this.hitPixels = new Int32Array(this.hits, 16)
    }
    this.configureWorker()
  }

  configureWorker() {
    const style = this.cableStyle
    if (
      this.workerBuffer === this.scene.buffer &&
      this.workerHits === this.hits &&
      this.workerStyle === style
    ) {
      return this.workerConfiguration
    }
    this.workerBuffer = this.scene.buffer
    this.workerHits = this.hits
    this.workerStyle = style
    const configuration = {
      buffer: this.scene.buffer,
      style: this.cableStyle,
      hits: this.hits,
    }
    this.workerConfiguration = (this.workerConfiguration ?? Promise.resolve())
      .then(async () => {
        const thread = await this.thread
        await thread.configure(configuration)
      })
      .catch((error) => this.handlePaintError(error))
    return this.workerConfiguration
  }

  async trackOpening(dialog) {
    this.opening.add(dialog)
    this.invalidate()
    await dialog.app?.ready
    await new Promise(requestAnimationFrame)
    const animations = dialog.getAnimations()
    await Promise.allSettled(animations.map((animation) => animation.finished))
    if (this.controller.signal.aborted || this.closing.has(dialog)) return
    dialog.recalculateSize?.()
    this.opening.delete(dialog)
    this.dirtyRects.add(dialog)
    this.invalidate()
  }

  hideDialog(dialog) {
    if (!dialog) return
    this.opening.delete(dialog)
    this.closing.add(dialog)
    this.invalidate()
  }

  edgeIds = new WeakMap()
  edgeId({ source, target }) {
    let targets = this.edgeIds.get(source)
    if (!targets) {
      targets = new WeakMap()
      this.edgeIds.set(source, targets)
    }
    if (!targets.has(target)) targets.set(target, this.nextId++)
    return targets.get(target)
  }

  sceneEndpoint(el, rects) {
    const endpoint = this.endpoint(el, rects)
    if (!endpoint) return
    const frame = el.ownerDocument.defaultView.frameElement
    const dialog = (frame ?? el).closest("ui-dialog")
    if (dialog && !rects.has(dialog)) return
    if (dialog && this.animations.has(dialog)) {
      return this.endpointCache?.get(el)
    }
    const knobInlet = el.classList.contains("audio-patch-param-inlet")
    const inlet = el.classList.contains("audio-patch-port--inlet")
    const outlet = el.classList.contains("audio-patch-port--outlet")
    const point = {
      x: endpoint.x,
      y: endpoint.y,
      dialog: dialog ? this.id(dialog) : 0,
      terminal: knobInlet ? 3 : inlet ? 1 : outlet ? 2 : 0,
    }
    this.endpointCache ??= new WeakMap()
    this.endpointCache.set(el, point)
    return point
  }

  handlePaintError(error) {
    if (!this.controller.signal.aborted) {
      this.paintError = error
      console.error("Audio cable worker:", error)
    }
  }

  destroy() {
    if (!this.controller) return
    cancelAnimationFrame(this.frame)
    this.controller.abort()
    this.clearSelection()
    this.focusTarget()
    this.showParamPorts(false)
    this.graph.destroy()
    this.themeObserver.disconnect()
    this.resizeObserver.disconnect()
    for (const { observer, forget } of this.dialogs.values()) {
      observer.disconnect()
      forget?.()
    }
    for (const el of [...this.ports.keys(), ...this.targets.keys()]) {
      if (el.classList.contains("audio-patch-port")) el.remove()
    }
    this.canvas.remove()
    this.documents.clear()
    this.ports.clear()
    this.targets.clear()
    this.paramPorts.clear()
    this.paramControls.clear()
    this.dialogs.clear()
    this.edges.clear()
    this.stableRects.clear()
    this.dirtyRects.clear()
    this.animations.clear()
  }
}
