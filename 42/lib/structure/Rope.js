/* eslint-disable unicorn/prefer-string-slice */
//! Copyright (c) 2014 Automattic, Inc. MIT License.
// @src https://github.com/component/rope

const { isNaN } = Number

export class Rope {
  // The threshold used to split a leaf node into two child nodes.
  static SPLIT_LENGTH = 1000

  // The threshold used to join two child nodes into one leaf node.
  static JOIN_LENGTH = 500

  // The threshold used to trigger a tree node rebuild when rebalancing the rope.
  static REBALANCE_RATIO = 1.2

  /**
   * Adjusts the tree structure, so that very long nodes are split
   * and short ones are joined.
   */
  #adjust() {
    if (this.value !== undefined) {
      if (this.length > Rope.SPLIT_LENGTH) {
        const divide = Math.floor(this.length / 2)
        this.left = new Rope(this.value.slice(0, Math.max(0, divide)))
        this.right = new Rope(this.value.slice(Math.max(0, divide)))
        delete this.value
      }
    } else if (this.length < Rope.JOIN_LENGTH) {
      this.value = this.left.toString() + this.right.toString()
      delete this.left
      delete this.right
    }
  }

  /**
   * Creates a rope data structure.
   * @param {string} str - String to populate the rope.
   */
  constructor(str) {
    this.value = str
    this.length = str.length
    this.#adjust()
  }

  /**
   * Removes text from the rope between the `start` and `end` positions.
   * The character at `start` gets removed, but the character at `end` is
   * not removed.
   *
   * @param {number} start - Initial position (inclusive).
   * @param {number} end - Final position (not-inclusive).
   */
  remove(start, end) {
    if (start < 0 || start > this.length) {
      throw new RangeError("Start is not within rope bounds.")
    }

    if (end < 0 || end > this.length) {
      throw new RangeError("End is not within rope bounds.")
    }

    if (start > end) {
      throw new RangeError("Start is greater than end.")
    }

    if (this.value === undefined) {
      const leftLength = this.left.length
      const leftStart = Math.min(start, leftLength)
      const leftEnd = Math.min(end, leftLength)
      const rightLength = this.right.length
      const rightStart = Math.max(0, Math.min(start - leftLength, rightLength))
      const rightEnd = Math.max(0, Math.min(end - leftLength, rightLength))
      if (leftStart < leftLength) {
        this.left.remove(leftStart, leftEnd)
      }

      if (rightEnd > 0) {
        this.right.remove(rightStart, rightEnd)
      }

      this.length = this.left.length + this.right.length
    } else {
      this.value =
        this.value.slice(0, Math.max(0, start)) +
        this.value.slice(Math.max(0, end))
      this.length = this.value.length
    }

    this.#adjust()
  }

  /**
   * Inserts text into the rope on the specified position.
   *
   * @param {number} position - Where to insert the text.
   * @param {string} value - Text to be inserted on the rope.
   */
  insert(position, value) {
    if (typeof value !== "string") value = String(value)

    if (position < 0 || position > this.length) {
      throw new RangeError("position is not within rope bounds.")
    }

    if (this.value === undefined) {
      const leftLength = this.left.length
      if (position < leftLength) {
        this.left.insert(position, value)
        this.length = this.left.length + this.right.length
      } else {
        this.right.insert(position - leftLength, value)
      }
    } else {
      this.value =
        this.value.slice(0, Math.max(0, position)) +
        value.toString() +
        this.value.slice(Math.max(0, position))
      this.length = this.value.length
    }

    this.#adjust()
  }

  /**
   * Rebuilds the entire rope structure, producing a balanced tree.
   */
  rebuild() {
    if (this.value === undefined) {
      this.value = this.left.toString() + this.right.toString()
      delete this.left
      delete this.right
      this.#adjust()
    }
  }

  /**
   * Finds unbalanced nodes in the tree and rebuilds them.
   */
  rebalance() {
    if (this.value === undefined) {
      if (
        this.left.length / this.right.length > Rope.REBALANCE_RATIO ||
        this.right.length / this.left.length > Rope.REBALANCE_RATIO
      ) {
        this.rebuild()
      } else {
        this.left.rebalance()
        this.right.rebalance()
      }
    }
  }

  /**
   * Returns text from the rope between the `start` and `end` positions.
   * The character at `start` gets returned, but the character at `end` is
   * not returned.
   *
   * @param {number} start - Initial position (inclusive).
   * @param {number} end - Final position (not-inclusive).
   */
  substring(start, end) {
    if (this.value !== undefined) {
      return this.value.substring(start, end)
    }

    if (end === undefined) {
      end = this.length
    }

    if (start < 0 || isNaN(start)) {
      start = 0
    } else if (start > this.length) {
      start = this.length
    }

    if (end < 0 || isNaN(end)) {
      end = 0
    } else if (end > this.length) {
      end = this.length
    }

    const leftLength = this.left.length
    const leftStart = Math.min(start, leftLength)
    const leftEnd = Math.min(end, leftLength)
    const rightLength = this.right.length
    const rightStart = Math.max(0, Math.min(start - leftLength, rightLength))
    const rightEnd = Math.max(0, Math.min(end - leftLength, rightLength))

    if (leftStart !== leftEnd) {
      if (rightStart !== rightEnd) {
        return (
          this.left.substring(leftStart, leftEnd) +
          this.right.substring(rightStart, rightEnd)
        )
      }

      return this.left.substring(leftStart, leftEnd)
    }

    if (rightStart !== rightEnd) {
      return this.right.substring(rightStart, rightEnd)
    }

    return ""
  }

  /**
   * Returns a string of `length` characters from the rope, starting
   * at the `start` position.
   *
   * @param {number} start - Initial position (inclusive).
   * @param {number} length - Size of the string to return.
   */
  substr(start, length) {
    if (this.value !== undefined) {
      return this.value.substr(start, length)
    }

    let end
    if (start < 0) {
      start = this.length + start
      if (start < 0) start = 0
    }

    if (length === undefined) {
      end = this.length
    } else {
      if (length < 0) length = 0
      end = start + length
    }

    return this.substring(start, end)
  }

  slice(start, end) {
    if (this.value !== undefined) {
      return this.value.slice(start, end)
    }

    if (start < 0) {
      start = Math.max(0, this.length + start)
    }

    if (end < 0) {
      end = Math.max(0, this.length + end)
    }

    const leftLength = this.left.length
    const leftStart = Math.min(start, leftLength)
    const leftEnd = Math.min(end, leftLength)
    const rightLength = this.right.length
    const rightStart = Math.max(0, Math.min(start - leftLength, rightLength))
    const rightEnd = Math.max(0, Math.min(end - leftLength, rightLength))

    if (leftStart !== leftEnd) {
      if (rightStart !== rightEnd) {
        return (
          this.left.slice(leftStart, leftEnd) +
          this.right.slice(rightStart, rightEnd)
        )
      }

      return this.left.slice(leftStart, leftEnd)
    }

    if (rightStart !== rightEnd) {
      return this.right.slice(rightStart, rightEnd)
    }

    return ""
  }

  /**
   * Returns the character at `position`.
   * @param {number} position
   */
  charAt(position) {
    return this.substring(position, position + 1)
  }

  /**
   * Returns the code of the character at `position`.
   * @param {number} position
   */
  charCodeAt(position) {
    return this.substring(position, position + 1).charCodeAt(0)
  }

  [Symbol.toPrimitive]() {
    if (this.value !== undefined) {
      return this.value
    }

    return this.left.toString() + this.right.toString()
  }

  toString() {
    return this[Symbol.toPrimitive]()
  }
}
