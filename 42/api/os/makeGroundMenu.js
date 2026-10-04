import { inDesktopRealm } from "../env/realm/inDesktopRealm.js"

export async function setGround(app, groundEl = document.body) {
  groundEl.classList.remove(
    "screen",
    "pattern-checkerboard",
    "pattern-checkerboard-dark",
  )

  if (app.state.ground === "transparent") {
    if (!inDesktopRealm) {
      document.documentElement.classList.toggle("clear", true)
    }
    app.dialogEl?.classList.toggle("clear", true)
    return
  }

  if (!inDesktopRealm) document.documentElement.classList.toggle("clear", false)
  app.dialogEl?.classList.toggle("clear", false)

  switch (app.state.ground) {
    case "checkerboard":
    case "checkerboard-dark":
      groundEl.classList.toggle("pattern-" + app.state.ground, true)
      break

    case "black":
      groundEl.classList.toggle("screen", true)
      break
  }
}

export function makeGroundMenu(app, groundEl) {
  const checkGroundState = (el) => app.state.ground === el.value
  const setGroundState = (e, el) => {
    app.state.ground = el.value
    setGround(app, groundEl)
  }

  return [
    {
      tag: "radio",
      name: "ground",
      checked: checkGroundState,
      action: setGroundState,
      value: "black",
    },
    {
      tag: "radio",
      name: "ground",
      checked: checkGroundState,
      action: setGroundState,
      value: "checkerboard",
    },
    {
      tag: "radio",
      name: "ground",
      checked: checkGroundState,
      action: setGroundState,
      value: "checkerboard-dark",
    },
    {
      tag: "radio",
      name: "ground",
      checked: checkGroundState,
      action: setGroundState,
      value: "transparent",
    },
  ]
}
