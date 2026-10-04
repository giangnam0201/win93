/** @param {IdleRequestOptions} [options] */
export async function untilIdle(options) {
  await new Promise((resolve) => requestIdleCallback(resolve, options))
}
