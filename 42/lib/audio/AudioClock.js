import { defer } from "../type/promise/defer.js"

const CLOCK_DEFAULTS = {
  toleranceLate: 0.1,
  toleranceEarly: 0.001,
}

const workletLoading = new WeakMap()

class AudioClockEvent {
  onexpired

  constructor(clock, deadline, func) {
    this.clock = clock
    this.func = func
    this._cleared = false // Flag used to clear an event inside callback

    this.toleranceLate = clock.toleranceLate
    this.toleranceEarly = clock.toleranceEarly
    this._latestTime = null
    this._earliestTime = null
    this.deadline = null
    this.repeatTime = null

    this.schedule(deadline)
  }

  // Unschedules the event
  clear() {
    this.clock._removeEvent(this)
    this._cleared = true
    return this
  }

  // Sets the event to repeat every `time` seconds.
  repeat(time) {
    if (time === 0) throw new Error("delay cannot be 0")
    this.repeatTime = time
    if (!this.clock._hasEvent(this)) {
      this.schedule(this.deadline + this.repeatTime)
    }

    return this
  }

  // Sets the time tolerance of the event.
  // The event will be executed in the interval `[deadline - early, deadline + late]`
  // If the clock fails to execute the event in time, the event will be dropped.
  tolerance(values) {
    if (typeof values.late === "number") this.toleranceLate = values.late
    if (typeof values.early === "number") this.toleranceEarly = values.early
    this._refreshEarlyLateDates()
    if (this.clock._hasEvent(this)) {
      this.clock._removeEvent(this)
      this.clock._insertEvent(this)
    }

    return this
  }

  // Returns true if the event is repeated, false otherwise
  isRepeated() {
    return this.repeatTime !== null
  }

  // Schedules the event to be ran before `deadline`.
  // If the time is within the event tolerance, we handle the event immediately.
  // If the event was already scheduled at a different time, it is rescheduled.
  schedule(deadline) {
    this._cleared = false
    this.deadline = deadline
    this._refreshEarlyLateDates()

    if (this.clock.context.currentTime >= this._earliestTime) {
      this._execute()
    } else if (this.clock._hasEvent(this)) {
      this.clock._removeEvent(this)
      this.clock._insertEvent(this)
    } else this.clock._insertEvent(this)
  }

  timeStretch(tRef, ratio) {
    if (this.isRepeated()) this.repeatTime *= ratio

    let deadline = tRef + ratio * (this.deadline - tRef)
    // If the deadline is too close or past, and the event has a repeat,
    // we calculate the next repeat possible in the stretched space.
    if (this.isRepeated()) {
      while (this.clock.context.currentTime >= deadline - this.toleranceEarly) {
        deadline += this.repeatTime
      }
    }

    this.schedule(deadline)
  }

  // Executes the event
  _execute() {
    if (this.clock.started === false) return
    this.clock._removeEvent(this)

    if (this.clock.context.currentTime < this._latestTime) this.func(this)
    else {
      if (this.onexpired) this.onexpired(this)
      console.warn("event expired")
    }

    // In the case `schedule` is called inside `func`, we need to avoid
    // overrwriting with yet another `schedule`.
    if (!this.clock._hasEvent(this) && this.isRepeated() && !this._cleared) {
      this.schedule(this.deadline + this.repeatTime)
    }
  }

  // Updates cached times
  _refreshEarlyLateDates() {
    this._latestTime = this.deadline + this.toleranceLate
    this._earliestTime = this.deadline - this.toleranceEarly
  }
}

export class AudioClock {
  constructor(context, options) {
    this.tickMethod = options?.tickMethod ?? "AudioWorkletNode"
    this.toleranceEarly =
      options?.toleranceEarly ?? CLOCK_DEFAULTS.toleranceEarly
    this.toleranceLate = options?.toleranceLate ?? CLOCK_DEFAULTS.toleranceLate
    this.context = context
    this._events = []
    this.started = false

    if (options?.signal) {
      if (options.signal.aborted) this.destroy()
      else options.signal.addEventListener("abort", () => this.destroy())
    }
  }

  async init() {
    if (this.context.state !== "running") {
      await new Promise((resolve) => {
        const stateChangeHandler = () => {
          if (this.context.state === "running") {
            resolve()
            this.context.removeEventListener("statechange", stateChangeHandler)
          }
        }

        this.context.addEventListener("statechange", stateChangeHandler)
      })
    }

    if (this.tickMethod === "AudioWorkletNode") {
      if (workletLoading.has(this.context)) {
        await workletLoading.get(this.context)
      } else {
        const deferred = defer()
        workletLoading.set(this.context, deferred)
        const workletScript = `\
registerProcessor(
  "clock-processor",
  class ClockProcessor extends AudioWorkletProcessor {
    running = true
    constructor(options) {
      super(options)
      this.port.addEventListener("message", ({ data }) => {
        if (data.stop) this.running = false
      })
      this.port.start()
    }
    process() {
      this.port.postMessage("tick")
      return this.running
    }
  }
)`
        try {
          await this.context.audioWorklet.addModule(
            URL.createObjectURL(
              new Blob([workletScript], { type: "application/javascript" }),
            ),
          )
          deferred.resolve()
        } catch (err) {
          deferred.reject(err)
          workletLoading.delete(this.context)
          throw err
        }
      }

      this._clockNode = new AudioWorkletNode(this.context, "clock-processor")
      this._clockNode.connect(this.context.destination)
      this._clockNode.port.onmessage = () => this.tick()
    } else if (this.tickMethod === "ScriptProcessorNode") {
      const bufferSize = 256
      // We have to keep a reference to the node to avoid garbage collection
      this._clockNode = this.context.createScriptProcessor(bufferSize, 1, 1)
      this._clockNode.connect(this.context.destination)
      this._clockNode.onaudioprocess = () => setTimeout(() => this.tick(), 0)
    } else if (this.tickMethod !== "manual") {
      throw new Error("invalid tickMethod " + this.tickMethod)
    }
  }

  // Schedules `func` to run after `delay` seconds.
  setTimeout(func, delay) {
    return this._createEvent(func, this._absTime(delay))
  }

  // Schedules `func` to run before `deadline`.
  callbackAtTime(func, deadline) {
    return this._createEvent(func, deadline)
  }

  // Stretches `deadline` and `repeat` of all scheduled `events` by `ratio`, keeping
  // their relative distance to `tRef`. In fact this is equivalent to changing the tempo.
  timeStretch(tRef, events, ratio) {
    for (const event of events) event.timeStretch(tRef, ratio)
    return events
  }

  // Removes all scheduled events and starts the clock
  start() {
    if (this.started === false) {
      this._clear()
      this.started = true
    }
  }

  // Removes all scheduled events and stops the clock
  stop() {
    if (this.started === true) {
      this._clear()
      this.started = false
    }
  }

  destroy() {
    this.stop()
    this._clear()
    try {
      this._clockNode.disconnect()
      this._clockNode.port.postMessage({ stop: true })
    } catch (err) {
      console.log(err)
    }
  }

  // This function is ran periodically, and at each tick it executes
  // events for which `currentTime` is included in their tolerance interval.
  tick() {
    let event = this._events.shift()

    while (event && event._earliestTime <= this.context.currentTime) {
      event._execute()
      event = this._events.shift()
    }

    // Put back the last event
    if (event) this._events.unshift(event)
  }

  _clear() {
    for (const event of this._events) {
      event._cleared = true
      if (event.onexpired) event.onexpired(event)
    }
    this._events.length = 0
  }

  // Creates an event and insert it to the list
  _createEvent(func, deadline) {
    return new AudioClockEvent(this, deadline, func)
  }

  // Inserts an event to the list
  _insertEvent(event) {
    this._events.splice(this._indexByTime(event._earliestTime), 0, event)
  }

  // Removes an event from the list
  _removeEvent(event) {
    const ind = this._events.indexOf(event)
    if (ind !== -1) this._events.splice(ind, 1)
  }

  // Returns true if `event` is in queue, false otherwise
  _hasEvent(event) {
    return this._events.includes(event)
  }

  // Returns the index of the first event whose deadline is >= to `deadline`
  _indexByTime(deadline) {
    // performs a binary search
    let low = 0
    let high = this._events.length
    let mid
    while (low < high) {
      mid = Math.floor((low + high) / 2)
      if (this._events[mid]._earliestTime <= deadline) low = mid + 1
      else high = mid
    }

    return low
  }

  // Converts from relative time to absolute time
  _absTime(relTime) {
    return relTime + this.context.currentTime
  }

  // Converts from absolute time to relative time
  _relTime(absTime) {
    return absTime - this.context.currentTime
  }
}
