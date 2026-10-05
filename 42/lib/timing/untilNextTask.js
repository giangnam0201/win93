import { queueTask } from "./queueTask.js"

export async function untilNextTask() {
  await new Promise((resolve) => queueTask(resolve))
}
