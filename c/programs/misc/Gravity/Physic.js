/* eslint-disable max-params */
/*
 - Mr. Doobs :: http://mrdoob.com/92/Google_Gravity
 - GravityScript :: http://gravityscript.googlecode.com/
 - Alex Arnell's inheritance.js :: http://code.google.com/p/inheritance/
 - Box2Djs :: http://box2d-js.sourceforge.net/
 - jGravity :: http://tinybigideas.com/plugins/jquery-gravity/
 */

import { Canceller } from "../../../../42/lib/class/Canceller.js"
import { zIndex } from "../../../../42/lib/dom/zIndex.js"
import { on } from "../../../../42/lib/event/on.js"
import { untilRepaint } from "../../../../42/lib/timing/untilRepaint.js"
import { ensureElement } from "../../../../42/lib/type/element/ensureElement.js"
import { measure } from "../../../../42/lib/type/element/measure.js"
import { setTemp } from "../../../../42/lib/type/element/setTemp.js"

function createBox(world, x, y, width, height, fixed, element) {
  if (fixed === undefined) {
    fixed = true
  }

  const boxSd = new b2BoxDef()

  if (!fixed) {
    boxSd.density = 1
  }

  boxSd.extents.Set(width, height)

  const boxBd = new b2BodyDef()
  boxBd.AddShape(boxSd)
  boxBd.position.Set(x, y)
  boxBd.userData = { element }

  return world.CreateBody(boxBd)
}

export function Physic(el, options = {}) {
  el = ensureElement(el)

  let worldAABB
  let world
  let mouseJoint
  let rafId

  let wallsSetted = false

  const { cancel, signal } = new Canceller(options.signal)
  this.cancel = cancel
  this.signal = signal

  signal.addEventListener("abort", () => {
    cancelAnimationFrame(rafId)
    for (const forget of forgetList) forget()
  })

  const delta = [0, 0]
  const iterations = 1
  const timeStep = 1 / 25
  const walls = []
  const wallThickness = options.wallThickness ?? 200
  const bodies = []
  const properties = []
  const orientation = { x: 0, y: 1 }
  const pointer = { buttons: 0, x: 0, y: 0 }
  const forgetList = []

  const stage = el.getBoundingClientRect()
  const elements = [...el.querySelectorAll(options.items ?? ":scope > *")]

  let { position } = getComputedStyle(el)
  if (position === "static") position = "relative"

  setTemp(el, {
    signal,
    "data-asleep": "true",
    "style": { position },
    "class": {
      "scrollbar-false": true,
      "selection-false": true,
    },
  })

  on(el, {
    signal,
    "pointermove || pointerup || pointercancel": (e) => {
      pointer.buttons = e.buttons
      pointer.x = e.x - stage.x
      pointer.y = e.y - stage.y
    },
  })

  this.addElement = async (el) => {
    await untilRepaint()
    const animations = el.getAnimations()
    if (animations.length > 0) {
      await Promise.all(animations.map((anim) => anim.finished))
    }

    elements.push(el)
    const rect = el.getBoundingClientRect()
    this.registerElement(el, this.registerProperties(rect))
  }

  this.removeElement = async (el) => {
    await untilRepaint()
    const animations = el.getAnimations()
    if (animations.length > 0) {
      await Promise.all(animations.map((anim) => anim.finished))
    }

    const index = elements.indexOf(el)
    if (index === -1) return
    forgetList[index]()
    forgetList.splice(index, 1)

    elements.splice(index, 1)
    properties.splice(index, 1)

    world.DestroyBody(bodies[index])
    bodies.splice(index, 1)
  }

  this.registerProperties = (rect) => {
    const property = [
      rect.x - stage.x,
      rect.y - stage.y,
      rect.width,
      rect.height,
    ]
    properties.push(property)
    return property
  }

  this.registerElement = (element, property) => {
    forgetList.push(
      setTemp(element, {
        signal,
        "data-asleep": "true",
        "style": {
          position: "fixed",
          gridArea: "none",
          margin: 0,
          top: 0,
          left: 0,
          bottom: "auto",
          right: "auto",
          translate: `${property[0]}px ${property[1]}px`,
          rotate: "0deg",
        },
      }),
    )

    bodies.push(
      createBox(
        world,
        property[0] + (property[2] >> 1),
        property[1] + (property[3] >> 1),
        property[2] / 2,
        property[3] / 2,
        false,
      ),
    )
  }

  const init = async () => {
    // init box2d
    worldAABB = new b2AABB()
    worldAABB.minVertex.Set(-wallThickness, -wallThickness)
    worldAABB.maxVertex.Set(
      stage.width + wallThickness,
      stage.height + wallThickness,
    )

    world = new b2World(worldAABB, new b2Vec2(0, 0), true)

    setWalls()

    const rects = await measure(elements)

    for (let i = 0; i < rects.length; i++) {
      const rect = rects[i]
      this.registerProperties(rect)
    }

    for (let i = 0; i < elements.length; i++) {
      const animations = elements[i].getAnimations()
      if (animations.length > 0) {
        await Promise.all(animations.map((anim) => anim.finished))
      }

      this.registerElement(elements[i], properties[i])
    }

    loop()
  }

  function loop() {
    if (signal.aborted) return
    // if (getBrowserDimensions()) setWalls()

    delta[0] += (0 - delta[0]) * 0.5
    delta[1] += (0 - delta[1]) * 0.5

    world.m_gravity.x = orientation.x * 350 + delta[0]
    world.m_gravity.y = orientation.y * 350 + delta[1]

    mouseDrag(pointer)
    world.Step(timeStep, iterations)

    for (let i = 0; i < elements.length; i++) {
      const body = bodies[i]
      const element = elements[i]

      const x = body.m_position0.x - (properties[i][2] >> 1) + "px"
      const y = body.m_position0.y - (properties[i][3] >> 1) + "px"
      element.style.translate = `${x} ${y}`
      element.style.rotate = `${body.m_rotation0}rad`
    }

    rafId = requestAnimationFrame(loop)
  }

  function mouseDrag(e) {
    if (options.drag !== false) {
      if (e.buttons && !mouseJoint) {
        const body = getBodyAtMouse(pointer)

        if (body) {
          const md = new b2MouseJointDef()
          md.body1 = world.m_groundBody
          md.body2 = body
          md.target.Set(e.x, e.y)
          md.maxForce = 30_000 * body.m_mass
          md.timeStep = timeStep
          mouseJoint = world.CreateJoint(md)
          body.WakeUp()
        }
      }

      if (e.buttons === 0) {
        if (mouseJoint) {
          world.DestroyJoint(mouseJoint)
          mouseJoint = null
        }
      }

      if (mouseJoint) {
        const p2 = new b2Vec2(e.x, e.y)
        mouseJoint.SetTarget(p2)
      }
    }
  }

  function getBodyAtMouse({ x, y }) {
    // Make a small box.
    const mousePVec = new b2Vec2()
    mousePVec.Set(x, y)

    const aabb = new b2AABB()
    aabb.minVertex.Set(x - 1, y - 1)
    aabb.maxVertex.Set(x + 1, y + 1)

    // Query the world for overlapping shapes.
    const kMaxCount = 10
    const shapes = []
    const count = world.Query(aabb, shapes, kMaxCount)
    let body = null

    // console.log(shapes)

    for (let i = 0; i < count; ++i) {
      if (shapes[i].m_body.IsStatic() === false) {
        if (shapes[i].TestPoint(mousePVec)) {
          body = shapes[i].m_body
          break
        }
      }
    }

    return body
  }

  function setWalls() {
    if (wallsSetted) {
      world.DestroyBody(walls[0])
      world.DestroyBody(walls[1])
      world.DestroyBody(walls[2])
      world.DestroyBody(walls[3])

      walls[0] = null
      walls[1] = null
      walls[2] = null
      walls[3] = null
    }

    walls[0] = createBox(
      world,
      stage.width / 2,
      -wallThickness,
      stage.width,
      wallThickness,
    )
    walls[1] = createBox(
      world,
      stage.width / 2,
      stage.height + wallThickness,
      stage.width,
      wallThickness,
    )
    walls[2] = createBox(
      world,
      -wallThickness,
      stage.height / 2,
      wallThickness,
      stage.height,
    )
    walls[3] = createBox(
      world,
      stage.width + wallThickness,
      stage.height / 2,
      wallThickness,
      stage.height,
    )

    wallsSetted = true
  }

  // function getBrowserDimensions() {
  //   let changed = false

  //   if (stage[0] !== window.screenX) {
  //     delta[0] = (window.screenX - stage[0]) * 50
  //     stage[0] = window.screenX
  //     changed = true
  //   }

  //   if (stage[1] !== window.screenY) {
  //     delta[1] = (window.screenY - stage[1]) * 50
  //     stage[1] = window.screenY
  //     changed = true
  //   }

  //   if (stage[2] !== window.innerWidth) {
  //     stage[2] = window.innerWidth
  //     changed = true
  //   }

  //   if (stage[3] !== window.innerHeight) {
  //     stage[3] = window.innerHeight
  //     changed = true
  //   }

  //   return changed
  // }

  init()
}
