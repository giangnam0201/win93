/** Allocate a versioned position buffer; for the shared-memory renderer. */
export function createPatchScene(capacity) {
  const buffer = new SharedArrayBuffer(16 + capacity * 8)
  return {
    buffer,
    meta: new Int32Array(buffer, 0, 4),
    values: new Float64Array(buffer, 16),
  }
}

/** Publish all positions in one coherent revision. */
export function writePatchScene(scene, width, height, dialogs, cables) {
  const revision = Atomics.add(scene.meta, 0, 1) + 1
  const data = [width, height, dialogs.length, cables.length]
  for (const rect of dialogs) {
    data.push(
      rect.id,
      rect.left,
      rect.top,
      rect.right,
      rect.bottom,
      rect.z ?? 0,
    )
  }
  for (const cable of cables) {
    data.push(
      cable.id,
      cable.destination,
      cable.from.x,
      cable.from.y,
      cable.from.dialog ?? 0,
      cable.from.terminal ?? 0,
      cable.to.x,
      cable.to.y,
      cable.to.dialog ?? 0,
      cable.to.terminal ?? 0,
      Number(cable.selected),
      cable.color ?? 0,
    )
  }
  scene.values.set(data)
  scene.meta[1] = data.length
  Atomics.store(scene.meta, 0, revision + 1)
  return revision + 1
}

/** Copy a stable snapshot without blocking the UI writer. */
export function readPatchScene(buffer) {
  const meta = new Int32Array(buffer, 0, 4)
  const revision = Atomics.load(meta, 0)
  if (revision % 2) return
  const data = new Float64Array(buffer, 16, meta[1]).slice()
  if (revision !== Atomics.load(meta, 0)) return
  const [width, height, dialogCount, cableCount] = data
  const dialogs = []
  const cables = []
  let i = 4
  for (let n = 0; n < dialogCount; n++) {
    const [id, left, top, right, bottom, z] = data.subarray(i, (i += 6))
    dialogs.push({ id, left, top, right, bottom, z })
  }
  for (let n = 0; n < cableCount; n++) {
    const [
      id,
      destination,
      x,
      y,
      dialog,
      fromTerminal,
      tx,
      ty,
      targetDialog,
      toTerminal,
      selected,
      color,
    ] = data.subarray(i, (i += 12))
    const from = { x, y, dialog }
    const to = { x: tx, y: ty, dialog: targetDialog }
    if (fromTerminal) from.terminal = fromTerminal
    if (toTerminal) to.terminal = toTerminal
    cables.push({
      id,
      destination,
      from,
      to,
      selected: Boolean(selected),
      ...(color ? { color } : {}),
    })
  }
  return { revision, width, height, dialogs, cables }
}
