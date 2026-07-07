import { Component } from "../../api/gui/Component.js"
import { watchResize } from "../../lib/type/element/watchResize.js"
import { keyboard } from "../../api/env/device/keyboard.js"

import * as THREE from "../../../c/libs/threejs/0.181/three.js"

// import { OrbitControls } from "../../../c/libs/threejs/0.181/addons/controls/OrbitControls.js"
// import { ArcballControls } from "../../../c/libs/threejs/0.181/addons/controls/ArcballControls.js"
import { ArcballControls } from "./model/ArcballControls.js"
import { getBasename } from "../../lib/syntax/path/getBasename.js"
import { Loader } from "../../lib/graphic/webgl/ModelLoader.js"
import { LRU } from "../../lib/structure/LRU.js"
import { defer } from "../../lib/type/promise/defer.js"
import { isInstanceOf } from "../../lib/type/any/isInstanceOf.js"

const MODEL_ANIMATION_CACHE_MAX = 40
const cachedAnimationClips = new LRU(MODEL_ANIMATION_CACHE_MAX)

function getAnimationCacheKey(urlOrBlob, path) {
  if (typeof path === "string" && path.length > 0) return path
  if (typeof urlOrBlob === "string" && urlOrBlob.length > 0) return urlOrBlob

  const name = urlOrBlob?.name
  if (typeof name === "string" && name.length > 0) return name
}

// TODO: check https://github.com/gkjohnson/three-jumpflood-demo
// TODO: check https://github.com/gkjohnson/three-mesh-bvh

// @src https://github.com/tiesfa/threejs_autoscaler/blob/main/js/3dPreviewer.js

function autoScale(mesh) {
  // This part auto scales the model
  const box = new THREE.Box3().setFromObject(mesh)

  const width = box.max.x - box.min.x
  const height = box.max.y - box.min.y

  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return
  }

  const scaleFactor =
    width >= height
      ? 2 / width // Scale based on the width (2)
      : 1.5 / height // Scale based on the height (1.5)

  mesh.scale.setScalar(scaleFactor)

  // Recenter the scaled model so baked FBX root offsets stay in frame.
  box.setFromObject(mesh)
  const center = new THREE.Vector3()
  box.getCenter(center)
  mesh.position.sub(center)
}

export class ModelComponent extends Component {
  static plan = {
    tag: "ui-model",
    props: {
      src: true,
      interactive: true,
      visualization: true,
    },
  }

  get src() {
    return this.getAttribute("src")
  }
  set src(value) {
    this.setAttribute("src", value)
  }

  get autoplay() {
    return this.hasAttribute("autoplay")
  }
  set autoplay(value) {
    this.toggleAttribute("autoplay", value)
  }

  get interactive() {
    return this.getAttribute("interactive") !== "false"
  }
  set interactive(value) {
    this.setAttribute("interactive", value ? "true" : "false")
  }

  get visualization() {
    return this.getAttribute("visualization") ?? "solid"
  }
  set visualization(value) {
    this.setAttribute("visualization", value)
  }

  #solid = new Set()

  syncInteractivity() {
    const { interactive } = this

    if (this.controls) {
      this.controls.enabled = interactive
      this.controls.enablePan = interactive
      this.controls.enableZoom = interactive
      this.controls.enableRotate = interactive && !this.mode
    }

    if (!interactive) this.endPointerRotation()
  }

  setWireframe() {
    if (!this.model) return

    const v = this.visualization

    const solid = v === "both" || v === "solid"

    if (solid) {
      const toRemove = []
      this.model?.traverse((obj) => {
        if (this.#solid.has(obj.uuid)) obj.visible = true
        if (obj.name === "wireframe") toRemove.push(obj)
      })

      if (v === "solid") {
        for (const item of toRemove) item.removeFromParent()
        return
      }
    }

    this.model.traverseVisible((obj) => {
      // console.log(obj)
      if (obj.type === "Mesh" || obj.type === "SkinnedMesh") {
        obj.visible = solid
        this.#solid.add(obj.uuid)
        const linesGeometry = new THREE.EdgesGeometry(obj.geometry)
        const lines = /** @type {any} */ (
          new THREE.LineSegments(
            linesGeometry,
            new THREE.LineBasicMaterial({
              color: "#000000",
            }),
          )
        )

        lines.name = "wireframe"

        // console.log(lines)

        lines.position.x = obj.position.x
        lines.position.y = obj.position.y
        lines.position.z = obj.position.z
        lines.rotation.x = obj.rotation.x
        lines.rotation.y = obj.rotation.y
        lines.rotation.z = obj.rotation.z

        obj.parent.add(lines)
      }
    })
  }

  /**
   * @param {boolean} enabled
   */
  setPointerRotationEnabled(enabled) {
    this.pointerRotationEnabled = enabled
    if (!enabled) this.endPointerRotation()
  }

  /**
   * @param {number} clientX
   * @param {number} clientY
   */
  beginPointerRotation(clientX, clientY) {
    if (!this.pointerRotationEnabled) return false
    this.isPointerRotationActive = true
    this.lastMouseX = clientX
    this.lastMouseY = clientY
    return true
  }

  /**
   * @param {number} clientX
   * @param {number} clientY
   */
  updatePointerRotation(clientX, clientY) {
    if (!this.pointerRotationEnabled || !this.isPointerRotationActive) return
    const deltaX = clientX - this.lastMouseX
    const deltaY = clientY - this.lastMouseY
    this.lastMouseX = clientX
    this.lastMouseY = clientY
    this.rotateByPixels(deltaX, deltaY)
  }

  endPointerRotation() {
    this.isPointerRotationActive = false
  }

  /**
   * @param {number} deltaX
   * @param {number} deltaY
   */
  rotateByPixels(deltaX, deltaY) {
    const velocityX = deltaY * this.rotationSpeed
    const velocityY = deltaX * this.rotationSpeed
    this.group.rotation.x += velocityX
    this.group.rotation.y += velocityY
    this.rotationVelocity.set(velocityY, velocityX)
  }

  /**
   * @param {number} rotationX
   * @param {number} rotationY
   */
  rotateBy(rotationX, rotationY) {
    this.group.rotation.x += rotationX
    this.group.rotation.y += rotationY
  }

  clearAnimation() {
    this.cancelAnimationLoad()
    this.currentAction?.stop()
    this.animationMixer?.stopAllAction()
    this.animationMixer = undefined
    this.currentAction = undefined
    this.currentClip = undefined
    this.animationTime = 0
    this.animationDuration = 0
    this.animationPlaying = false
    this.animations.length = 0
  }

  cancelAnimationLoad() {
    this.animationLoadRequestId++
  }

  hasAnimation() {
    return Boolean(this.currentClip)
  }

  getEmbeddedAnimationCount() {
    return this.availableAnimations.length
  }

  pauseAnimation() {
    this.animationPlaying = false
  }

  resumeAnimation() {
    if (this.currentClip) this.animationPlaying = true
  }

  restartAnimation() {
    if (!this.animationMixer || !this.currentAction || !this.currentClip) {
      return false
    }

    this.currentAction.stop()
    this.currentAction.reset()
    this.currentAction.play()
    this.animationMixer.setTime(0)
    this.animationTime = 0
    this.animationPlaying = true
    return true
  }

  /**
   * @param {number} delta
   */
  scrubAnimation(delta) {
    if (
      !this.animationMixer ||
      !this.currentClip ||
      this.animationDuration <= 0
    ) {
      return false
    }

    this.pauseAnimation()
    let nextTime = this.animationTime + delta
    nextTime %= this.animationDuration
    if (nextTime < 0) nextTime += this.animationDuration
    this.animationTime = nextTime
    this.animationMixer.setTime(nextTime)
    return true
  }

  /**
   * @param {THREE.AnimationClip} clip
   */
  setAnimationClip(clip) {
    this.clearAnimation()
    if (!clip || !this.model) return false

    const mixer = new THREE.AnimationMixer(this.model)
    const action = mixer.clipAction(clip)
    action.reset()
    action.play()

    this.animationMixer = mixer
    this.currentAction = action
    this.currentClip = clip
    this.animationTime = 0
    this.animationDuration = clip.duration || 0
    this.animationPlaying = true
    this.animations.push(mixer)
    return true
  }

  /**
   * @param {number} index
   */
  playEmbeddedAnimation(index = 0) {
    this.cancelAnimationLoad()

    const clip = this.availableAnimations[index]
    if (!clip) {
      this.clearAnimation()
      return false
    }

    return this.setAnimationClip(clip)
  }

  destroyRenderer() {
    this.cancelAnimationLoad()
    this.clearAnimation()
    this.endPointerRotation()
    this.renderer.setAnimationLoop(null)
    this.renderer.dispose()
  }

  async getAnimationClip(urlOrBlob, path) {
    const cacheKey = getAnimationCacheKey(urlOrBlob, path)

    if (!cacheKey) {
      const { blob, blobPath } = await this.#loadModel(urlOrBlob, path)
      console.debug("load anim", blobPath)
      const animationModel = await this.loader.loadFile(blob, blobPath)
      return animationModel.animations?.[0]
    }

    let cachedClip = cachedAnimationClips.get(cacheKey)
    if (!cachedClip) {
      cachedClip = (async () => {
        const { blob, blobPath } = await this.#loadModel(urlOrBlob, path)
        console.debug("load anim", blobPath)
        const animationModel = await this.loader.loadFile(blob, blobPath)
        return animationModel.animations?.[0]
      })().catch((error) => {
        cachedAnimationClips.delete(cacheKey)
        throw error
      })

      cachedAnimationClips.set(cacheKey, cachedClip)
    }

    return cachedClip
  }

  /**
   * @param {number} width
   * @param {number} height
   * @param {{
   *   syncElementSize?: boolean
   *   lockResize?: boolean
   * }} [options]
   */
  setRenderSize(width, height, options) {
    width = Math.max(1, Math.round(width))
    height = Math.max(1, Math.round(height))

    if (options?.lockResize) this.renderSizeLocked = true
    else if (options?.lockResize === false) this.renderSizeLocked = false

    if (this.renderWidth === width && this.renderHeight === height) {
      return
    }

    this.renderWidth = width
    this.renderHeight = height
    // if (options?.syncElementSize !== false) {
    //   this.style.width = `${width}px`
    //   this.style.height = `${height}px`
    // }
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
    this.loop()
  }

  constructed() {
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      autoClear: false,
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: false,
      autoClearDepth: false,
      autoClearStencil: false,
    })
    renderer.autoClearColor = false
    renderer.setPixelRatio(globalThis.devicePixelRatio || 1)

    const scene = new THREE.Scene()
    const camera = /** @type {any} */ (
      new THREE.PerspectiveCamera(45, 1, 0.1, 1000)
    )
    camera.position.set(0, 0, 3)

    const hemiLight = new THREE.HemisphereLight(0xcc_cc_cc, 0x44_44_44, 3)
    scene.add(hemiLight)

    const ambLight = new THREE.AmbientLight(0x40_40_40)
    scene.add(ambLight)

    const dirLight = /** @type {any} */ (
      new THREE.DirectionalLight(0xff_ff_ff, 2.5)
    )
    dirLight.position.set(1.5, 3, 2.5)
    scene.add(dirLight)

    const group = /** @type {any} */ (new THREE.Group())
    scene.add(group)

    this.mode = true
    this.pointerRotationEnabled = true
    this.isPointerRotationActive = false
    this.lastMouseX = 0
    this.lastMouseY = 0
    this.rotationSpeed = 0.005
    this.rotationVelocity = new THREE.Vector2()
    this.rotationDamping = 0
    this.animationLoadRequestId = 0
    this.availableAnimations = []
    this.animationMixer = undefined
    this.currentAction = undefined
    this.currentClip = undefined
    this.animationTime = 0
    this.animationDuration = 0
    this.animationPlaying = false
    this.renderWidth = 0
    this.renderHeight = 0
    this.renderSizeLocked = false

    const controls = /** @type {any} */ (
      new ArcballControls(
        camera,
        /** @type {HTMLElement} */ (renderer.domElement),
        scene,
      )
    )
    controls.setGizmosVisible(false)
    controls.dampingFactor = 0
    controls.enableDamping = true
    controls.enablePan = true
    controls.enableRotate = !this.mode
    controls.update()

    this.clearEnabled = true
    let spacePrev = false

    keyboard.listen()
    const keySpeedSlow = 0.006
    const keySpeedMid = 0.02
    const keySpeedFast = 0.08
    let keySpeed = keySpeedMid

    const zoomOptions = {
      deltaX: 0,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      preventDefault: () => {},
    }
    function zoomUp() {
      zoomOptions.deltaY = -500 * keySpeed
      controls._onWheel(zoomOptions)
    }
    function zoomDown() {
      zoomOptions.deltaY = 500 * keySpeed
      controls._onWheel(zoomOptions)
    }

    this.clock = new THREE.Clock()

    this.handlePointerDown = (event) => {
      if (!this.interactive) return
      if (event.button !== 0) return
      this.beginPointerRotation(event.clientX, event.clientY)
    }
    this.handlePointerUp = (event) => {
      if (!this.interactive) return
      if (event.button !== 0) return
      this.endPointerRotation()
    }
    this.handlePointerMove = (event) => {
      if (!this.interactive) return
      this.updatePointerRotation(event.clientX, event.clientY)
    }

    renderer.domElement.addEventListener("mousedown", this.handlePointerDown)
    renderer.domElement.addEventListener("mouseup", this.handlePointerUp)
    renderer.domElement.addEventListener("mousemove", this.handlePointerMove)

    this.loop = () => {
      const delta = this.clock.getDelta()

      if (this.animationMixer && this.animationPlaying) {
        this.animationMixer.update(delta)
        if (this.animationDuration > 0) {
          this.animationTime =
            (this.animationTime + delta) % this.animationDuration
        }
      }

      if (!this.isPointerRotationActive) {
        group.rotation.y += this.rotationVelocity.x
        group.rotation.x += this.rotationVelocity.y
        this.rotationVelocity.multiplyScalar(1 - this.rotationDamping)
        if (this.rotationVelocity.length() < 0.0001) {
          this.rotationVelocity.set(0, 0)
        }
      }

      if (this.interactive) {
        keySpeed = keyboard.codes.ShiftLeft
          ? keySpeedFast
          : keyboard.codes.ControlLeft
            ? keySpeedSlow
            : keySpeedMid
        if (keyboard.codes.ShiftRight) zoomUp()
        else if (keyboard.codes.ControlRight) zoomDown()

        if (keyboard.codes.ArrowLeft) group.rotation.y -= keySpeed
        else if (keyboard.codes.ArrowRight) group.rotation.y += keySpeed
        if (keyboard.codes.ArrowUp) group.rotation.x -= keySpeed
        else if (keyboard.codes.ArrowDown) group.rotation.x += keySpeed

        if (keyboard.codes.Space && !spacePrev) {
          this.clearEnabled = !this.clearEnabled
        }
        spacePrev = keyboard.codes.Space // toggle
      } else {
        spacePrev = false
      }

      if (this.clearEnabled) renderer.clear()
      renderer.render(scene, camera)
    }

    this.renderer = renderer
    this.camera = camera
    this.scene = scene
    this.group = group
    this.animations = []
    this.controls = controls
    this.loader = new Loader()
    this.modelReady = defer()
    this.syncInteractivity()
  }

  addCube() {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshPhongMaterial({ color: 0x00_ff_00 }),
    )

    const wireframe = /** @type {any} */ (
      new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry), // or WireframeGeometry
        new THREE.LineBasicMaterial({ color: 0x00_00_00 }),
      )
    )

    const group = new THREE.Group()
    // group.add(mesh)
    group.add(wireframe)
    this.scene.add(group)
  }

  async updated(key, val) {
    switch (key) {
      case "src": {
        await this.load(val)
        break
      }

      case "visualization": {
        this.setWireframe()
        break
      }

      case "interactive": {
        this.syncInteractivity()
        break
      }

      default:
        break
    }
  }

  async #loadModel(urlOrBlob, path) {
    let blob

    if (isInstanceOf(urlOrBlob, Blob)) {
      blob = urlOrBlob
    } else {
      blob = await (await fetch(urlOrBlob)).blob()
      const namedBlob = /** @type {Blob & { name?: string }} */ (blob)
      namedBlob.name ??= getBasename(urlOrBlob)
      blob = namedBlob
      path ??= urlOrBlob
    }

    return { blob, blobPath: path }
  }

  async load(urlOrBlob, path, options) {
    this.modelReady ??= defer()
    this.cancelAnimationLoad()

    const { blob, blobPath } = await this.#loadModel(urlOrBlob, path)
    const model = await this.loader.loadFile(blob, blobPath)

    autoScale(model)

    this.availableAnimations = model.animations ?? []

    this.group.clear()
    this.group.add(model)
    this.model = model

    if (
      options?.autoplayEmbeddedAnimation !== false &&
      this.availableAnimations.length > 0
    ) {
      this.playEmbeddedAnimation(0)
    } else this.clearAnimation()

    this.modelReady.resolve()
    this.modelReady = undefined

    this.setWireframe()
  }

  async loadAnimation(urlOrBlob, path) {
    await this.modelReady
    if (!urlOrBlob) {
      this.clearAnimation()
      return false
    }

    const requestId = ++this.animationLoadRequestId
    const clip = await this.getAnimationClip(urlOrBlob, path)
    if (requestId !== this.animationLoadRequestId) return false

    if (!clip) {
      this.clearAnimation()
      return false
    }

    return this.setAnimationClip(clip)
  }

  render() {
    if (this.src) this.updated("src", this.src)
    return this.renderer.domElement
  }

  created() {
    const { signal } = this
    watchResize(this, { signal, firstCall: true }, ({ width, height }) => {
      if (this.renderSizeLocked) return
      this.setRenderSize(width, height)
    })

    signal.addEventListener("abort", () => this.destroyRenderer())

    this.renderer.setAnimationLoop(this.loop)
  }
}

export const model = Component.define(ModelComponent)
