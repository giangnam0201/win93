import assert from 'node:assert/strict'
import { FileIndex } from '../42/api/fs/FileIndex.js'
import { Storable } from '../42/lib/class/Storable.js'

// Reproduce the worker-created database with only an early saved user file.
const saved = [123, 0x13, { modified: 42 }]
const index = new FileIndex({ c: { users: { windows93: { config: { 'note.txt': saved } } } } })
let populations = 0
let commits = 0
index.store = {}
index.config = { populate: async () => {
  populations++
  return { 42: { 'core.js': 0 }, c: { users: { windows93: { desktop: { 'Home.desktop': 0 }, config: {} } } } }
} }
index.save = async () => { commits++ }
await index.init()
assert(index.isDir('/c/users/windows93/desktop/'))
assert.deepEqual(index.get('/c/users/windows93/config/note.txt'), saved)
assert.equal(commits, 1)
await index.init()
assert.equal(populations, 1, 'A healthy index must not repopulate on reload')

// An existing empty database has no upgrade event to run population again.
let initialized = false
await Storable.prototype.init.call({
  store: { get: async () => undefined },
  populate: async () => { initialized = true },
  ready: { resolve() {} },
})
assert(initialized)
console.log('Worker-created index recovers, preserves saved files, and stays stable on reload')
