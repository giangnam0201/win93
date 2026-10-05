export async function streamToFile(readable, filename, options) {
  const chunks = []

  const pipeOptions = {}
  if (options?.signal) pipeOptions.signal = options.signal

  try {
    await readable.pipeTo(
      new WritableStream({ write: (data) => void chunks.push(data) }),
      pipeOptions
    )
  } catch (err) {
    if (err.name === "AbortError") throw err
    throw err
  }

  return new File(chunks, filename, options)
}
