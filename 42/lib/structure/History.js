export class History {
  constructor(options) {
    this.stack = []
    this.index = -1

    this.limit =
      Number.isInteger(options?.limit) && options?.limit > 0
        ? options.limit
        : undefined
  }

  add(entry) {
    // If we're not at the end, drop redo history
    if (this.index < this.stack.length - 1) {
      this.stack = this.stack.slice(0, this.index + 1)
    }

    this.stack.push(entry)
    this.index = this.stack.length - 1

    // Enforce limit if defined
    if (this.limit && this.stack.length > this.limit) {
      const overflow = this.stack.length - this.limit
      this.stack.splice(0, overflow)
      this.index -= overflow
    }
  }

  canUndo() {
    return this.index > 0
  }

  canRedo() {
    return this.index >= 0 && this.index < this.stack.length - 1
  }

  undo() {
    if (!this.canUndo()) return
    this.index--
    return this.current()
  }

  redo() {
    if (!this.canRedo()) return
    this.index++
    return this.current()
  }

  current() {
    return this.index >= 0 ? this.stack[this.index] : undefined
  }

  size() {
    return this.stack.length
  }
}
