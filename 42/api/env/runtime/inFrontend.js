import { inNode } from "./inNode.js"
import { inDeno } from "./inDeno.js"

export const inFrontend = !inNode && !inDeno
