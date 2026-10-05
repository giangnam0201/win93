/* eslint-disable max-depth */

import { BinaryHeap } from "../structure/BinaryHeap.js"

//! Copyright (c) Brian Grinstead <http://briangrinstead.com>. MIT License.
// @src http://github.com/bgrins/javascript-astar

function pathTo(node) {
  let curr = node
  const path = []
  // while (curr) {
  while (curr.parent) {
    path.unshift(curr)
    curr = curr.parent
  }

  return path
}

/**
 * Perform an A* Search on a graph given a start and end node.
 *
 * @param {Graph} graph
 * @param {GridNode} start
 * @param {GridNode} end
 * @param {object} [options]
 * @param {boolean} [options.closest] Specifies whether to return the path to the closest node if the target is unreachable.
 * @param {Function} [options.heuristic] Heuristic function (see heuristics).
 */
export function astar(graph, start, end, options) {
  graph.cleanDirty()
  const heuristic = options?.heuristic || heuristics.manhattan
  const closest = options?.closest ?? false

  const openHeap = new BinaryHeap((node) => node.f)
  let closestNode = start // set the start node to be the closest if required

  start.h = heuristic(start, end)
  graph.markDirty(start)

  openHeap.push(start)

  while (openHeap.size() > 0) {
    // Grab the lowest f(x) to process next.  Heap keeps this sorted for us.
    const currentNode = openHeap.pop()

    // End case -- result has been found, return the traced path.
    if (currentNode === end) {
      return pathTo(currentNode)
    }

    // Normal case -- move currentNode from open to closed, process each of its neighbors.
    currentNode.closed = true

    // Find all neighbors for the current node.
    const neighbors = graph.neighbors(currentNode)

    for (let i = 0, il = neighbors.length; i < il; ++i) {
      const neighbor = neighbors[i]

      if (neighbor.closed || neighbor.isWall()) {
        // Not a valid node to process, skip to next neighbor.
        continue
      }

      // The g score is the shortest distance from start to current node.
      // We need to check if the path we have arrived at this neighbor is the shortest one we have seen yet.
      const gScore = currentNode.g + neighbor.getCost(currentNode)
      const beenVisited = neighbor.visited

      if (!beenVisited || gScore < neighbor.g) {
        // Found an optimal (so far) path to this node.  Take score for node to see how good it is.
        neighbor.visited = true
        neighbor.parent = currentNode
        neighbor.h = neighbor.h || heuristic(neighbor, end)
        neighbor.g = gScore
        neighbor.f = neighbor.g + neighbor.h
        graph.markDirty(neighbor)
        if (closest) {
          // If the neighbour is closer than the current closestNode or if it's equally close but has
          // a cheaper path than the current closest node then it becomes the closest node
          if (
            neighbor.h < closestNode.h ||
            (neighbor.h === closestNode.h && neighbor.g < closestNode.g)
          ) {
            closestNode = neighbor
          }
        }

        if (beenVisited) {
          // Already seen the node, but since it has been rescored we need to reorder it in the heap
          openHeap.rescoreElement(neighbor)
        } else {
          // Pushing to heap will put it in proper place based on the 'f' value.
          openHeap.push(neighbor)
        }
      }
    }
  }

  return closest
    ? pathTo(closestNode) //
    : [] // No result was found - empty array signifies failure to find path.
}

// See list of heuristics: http://theory.stanford.edu/~amitp/GameProgramming/Heuristics.html
export const heuristics = {
  manhattan(pos0, pos1) {
    const d1 = Math.abs(pos1.x - pos0.x)
    const d2 = Math.abs(pos1.y - pos0.y)
    return d1 + d2
  },

  diagonal(pos0, pos1) {
    const D = 1
    const D2 = Math.sqrt(2)
    const d1 = Math.abs(pos1.x - pos0.x)
    const d2 = Math.abs(pos1.y - pos0.y)
    return D * (d1 + d2) + (D2 - 2 * D) * Math.min(d1, d2)
  },
}

export function cleanNode(node) {
  node.f = 0
  node.g = 0
  node.h = 0
  node.visited = false
  node.closed = false
  node.parent = null
}

/**
 * A graph memory structure.
 * @param {number[]} gridIn 2D array of input weights.
 * @param {object} [options]
 * @param {boolean} [options.diagonal] Specifies whether diagonal moves are allowed.
 */
export class Graph {
  constructor(gridIn, options) {
    /** @type {GridNode[]} */
    this.nodes = []
    /** @type {GridNode[]} */
    this.dirtyNodes = []

    this.diagonal = Boolean(options?.diagonal)
    this.grid = []
    for (let x = 0; x < gridIn.length; x++) {
      this.grid[x] = []

      for (let y = 0, row = gridIn[x]; y < row.length; y++) {
        const node = new GridNode(x, y, row[y])
        this.grid[x][y] = node
        this.nodes.push(node)
      }
    }

    this.init()
  }

  init() {
    this.dirtyNodes.length = 0
    for (let i = 0; i < this.nodes.length; i++) {
      cleanNode(this.nodes[i])
    }
  }

  cleanDirty() {
    for (let i = 0; i < this.dirtyNodes.length; i++) {
      cleanNode(this.dirtyNodes[i])
    }

    this.dirtyNodes.length = 0
  }

  markDirty(node) {
    this.dirtyNodes.push(node)
  }

  neighbors(node) {
    /** @type {GridNode[]} */
    const ret = []
    const { x } = node
    const { y } = node
    const { grid } = this

    // West
    if (grid[x - 1] && grid[x - 1][y]) {
      ret.push(grid[x - 1][y])
    }

    // East
    if (grid[x + 1] && grid[x + 1][y]) {
      ret.push(grid[x + 1][y])
    }

    // South
    if (grid[x] && grid[x][y - 1]) {
      ret.push(grid[x][y - 1])
    }

    // North
    if (grid[x] && grid[x][y + 1]) {
      ret.push(grid[x][y + 1])
    }

    if (this.diagonal) {
      // Southwest
      if (grid[x - 1] && grid[x - 1][y - 1]) {
        ret.push(grid[x - 1][y - 1])
      }

      // Southeast
      if (grid[x + 1] && grid[x + 1][y - 1]) {
        ret.push(grid[x + 1][y - 1])
      }

      // Northwest
      if (grid[x - 1] && grid[x - 1][y + 1]) {
        ret.push(grid[x - 1][y + 1])
      }

      // Northeast
      if (grid[x + 1] && grid[x + 1][y + 1]) {
        ret.push(grid[x + 1][y + 1])
      }
    }

    return ret
  }

  toString() {
    const graphString = []
    const nodes = this.grid
    for (let x = 0; x < nodes.length; x++) {
      const rowDebug = []
      const row = nodes[x]
      for (let y = 0; y < row.length; y++) {
        rowDebug.push(row[y].weight)
      }

      graphString.push(rowDebug.join(" "))
    }

    return graphString.join("\n")
  }
}

class GridNode {
  f = 0
  g = 0
  h = 0
  visited = false
  closed = false
  parent = null

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} weight
   */
  constructor(x, y, weight) {
    this.x = x
    this.y = y
    this.weight = weight
  }

  getCost(fromNeighbor) {
    // Take diagonal weight into consideration.
    if (
      fromNeighbor &&
      fromNeighbor.x !== this.x &&
      fromNeighbor.y !== this.y
    ) {
      return this.weight * 1.414_21
    }

    return this.weight
  }

  isWall() {
    return this.weight === 0
  }

  toString() {
    return `[${this.x} ${this.y}]`
  }
}
