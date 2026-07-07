const { d3, pdfu } = window

let patch

const emptyArgs = () => []

// Function to generate the args of sound oscillators
const genOscArgs = () => [Math.round((getRandomInt(1, 15) / 10) * 440)]

// Function to generate the args of modulators
const modOscArgs = () => [Math.round(Math.random() * 10 * 10) / 10]

// Returns a random integer between `min` and `max`
const getRandomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min

// Returns true if the node is a dsp arithmetic operation
// const isArithm = (node) => _.contains(["+~", "-~", "*~", "/~"], node.proto)
const isArithm = (node) => ARITHM_NODES.has(node.proto)

const ARITHM_NODES = new Set(["+~", "-~", "*~", "/~"])
const MODULATION_NODES = new Set(["osc~", "phasor~"])

const modAmount = 40
const fmModAmount = 20
const genList = [
  ["osc~", 50, genOscArgs],
  ["phasor~", 20, genOscArgs],
  ["noise~", 10, emptyArgs],
  ["*~", 60, emptyArgs],
  ["+~", 50, emptyArgs],
]
const modList = [
  ["osc~", 10, modOscArgs],
  ["*~", 10, emptyArgs],
]

// =============== Patch generation =============== //
// Generates a random Pd graph that makes sound
function randomSoundGen() {
  return randomTree(genList, 5, (node) => {
    // Each time a node is created, we pick randomly whether we modulate it or not.
    if (Math.random() * 100 > 100 - modAmount) {
      let mod = null
      while (mod === null) mod = randomTree(modList, 3)
      // Freq modulation if `node` is an oscillator
      if (
        MODULATION_NODES.has(node.proto) &&
        Math.random() * 100 > 100 - fmModAmount
      ) {
        const freq = node.args[0]
        const mult = { proto: "*~", args: [Math.round(Math.random() * 100)] }
        const add = { proto: "+~", args: [freq] }
        patch.addNode(mult)
        patch.addNode(add)
        patch.connections.push(
          { source: { id: mod.id, port: 0 }, sink: { id: mult.id, port: 0 } },
          { source: { id: mult.id, port: 0 }, sink: { id: add.id, port: 0 } },
          { source: { id: add.id, port: 0 }, sink: { id: node.id, port: 0 } },
        )
        return node
        // Amplitude modulation otherwise
      }

      const mult = { proto: "*~", args: [] }
      patch.addNode(mult)
      patch.connections.push(
        { source: { id: node.id, port: 0 }, sink: { id: mult.id, port: 0 } },
        { source: { id: mod.id, port: 0 }, sink: { id: mult.id, port: 1 } },
      )
      return mult
    }

    return node
  })
}

// Generic function for generating a random tree of Pd objects.
function randomTree(objList, maxDepth, nodeCb, curDepth) {
  curDepth = curDepth === undefined ? -1 : curDepth
  curDepth++

  // If max depth is reached, we return null, the parent will take care of picking a leaf
  if (curDepth >= maxDepth) {
    curDepth--
    return null
  }

  let node
  let i
  let cum
  // For picking a leaf, when the tree is too big
  const getLeaf = function (parent) {
    const leaf = { proto: "sig~" }
    leaf.args = parent.proto === "+~" || parent.proto === "-~" ? [0] : [1]
    patch.addNode(leaf)
    return leaf
  }

  // Pick a random proto
  const randVal =
    Math.random() * objList.reduce((memo, obj) => memo + obj[1], 0)

  i = 0
  cum = 0
  while (true) {
    cum += objList[i][1]
    if (cum >= randVal) break
    i++
  }

  const proto = objList[i][0]
  node = { proto, args: objList[i][2]() }

  // If it is a dsp arithmetic, we call the function recursively
  // to get 2 subtrees that we'll connect together.
  if (isArithm(node)) {
    let subtree1 = randomTree(objList, maxDepth, nodeCb, curDepth)
    let subtree2 = randomTree(objList, maxDepth, nodeCb, curDepth)

    // If both subtrees are null, we simply discard the node
    if (subtree1 === null && subtree2 === null) {
      curDepth--
      return null
    }

    patch.addNode(node)
    if (subtree1 === null) subtree1 = getLeaf(node)
    if (subtree2 === null) subtree2 = getLeaf(node)
    patch.connections.push(
      { source: { id: subtree1.id, port: 0 }, sink: { id: node.id, port: 0 } },
      { source: { id: subtree2.id, port: 0 }, sink: { id: node.id, port: 1 } },
    )
    // If addition, we normalize the volume
    if (node.proto === "+~") {
      const norm = { proto: "*~", args: [0.5] }
      patch.addNode(norm)
      patch.connections.push({
        source: { id: node.id, port: 0 },
        sink: { id: norm.id, port: 0 },
      })
      node = norm
    }
  } else patch.addNode(node)

  curDepth--
  if (nodeCb) node = nodeCb(node)
  return node
}

// Function for generating our random patch, and updating the page
export function randomPatch(el) {
  const { width, height } = el.getBoundingClientRect()

  patch = new pdfu.Patch({ nodes: [], connections: [] })

  const dac = { proto: "dac~", args: [] }
  const treeLayout = d3.layout.tree()
  let root

  // We don't want too simple patches
  while (patch.nodes.length <= 2) {
    patch = new pdfu.Patch({ nodes: [], connections: [] })
    root = randomSoundGen()
  }

  // Connect the root of the tree with [dac~]
  patch.addNode(dac)
  patch.connections.push(
    { source: { id: root.id, port: 0 }, sink: { id: dac.id, port: 0 } },
    { source: { id: root.id, port: 0 }, sink: { id: dac.id, port: 1 } },
  )

  // Create the tree layout
  treeLayout.children((node) => {
    const sources = patch.getSources(node)
    return sources.length > 0 ? sources : null
  })

  treeLayout.nodes(dac)

  for (const node of patch.nodes) {
    node.layout = {}
    node.layout.x = Math.round((node.x * width) / 2)
    node.layout.y = Math.round((2 * height) / 3 - (node.y * height) / 2)
    delete node.parent
    delete node.children
  }

  return patch
}
