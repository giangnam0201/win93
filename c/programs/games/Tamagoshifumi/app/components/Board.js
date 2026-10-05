import { empty, frag, div } from "../../js/html.js"

import { emittable } from "../../js/mixin/Emitter.js"

export default class Board {
  constructor() {
    emittable(this)
    this.closed = true
    this.closedDoors = true
    this.el = div({ class: "boardgate" }, [
      (this.doorLeft = div({ class: "door door-left" })),
      (this.doorRight = div({ class: "door door-right" })),
      (this.board = div({ class: "board" })),
    ])
  }

  close() {
    app.log("### board - close")
    this.closed = true
    this.doorLeft.classList.remove("open")
    this.doorRight.classList.remove("open")
    setTimeout(() => {
      this.closedDoors = true
      this.emit("close")
    }, 300)
    return this
  }
  open() {
    app.log("### board - open")
    this.closed = false
    this.doorLeft.classList.add("open")
    this.doorRight.classList.add("open")
    setTimeout(() => {
      this.closedDoors = false
      this.doorLeft.className = "door door-left open"
      this.doorRight.className = "door door-right open"
      this.emit("open")
    }, 300)
    return this
  }

  change(els) {
    app.log("### board - change")
    empty(this.board)
    this.content = els
    this.board.appendChild(frag(this.content))
    return this
  }

  temp(els) {
    app.log("### board - temp")
    empty(this.board)
    this.board.appendChild(frag(els))
    return () => {
      empty(this.board)
      this.board.appendChild(frag(this.content))
    }
  }

  update(els) {
    app.log("### board - update")
    if (this.closed && this.closedDoors === false) {
      this.once("close", () => {
        app.log("### board - once(close)")
        this.change(els)
        setTimeout(() => this.open(), 100)
      })
    } else if (this.closed && this.closedDoors) {
      this.change(els)
      setTimeout(() => this.open(), 100)
    } else {
      this.close()
      this.once("close", () => {
        app.log("### board - once(close)")
        this.change(els)
        setTimeout(() => this.open(), 100)
      })
    }
    return this
  }
}
