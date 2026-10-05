class FuzzyField {
  searchBuffer = ""

  constructor(el, options, callback) {
    let searchTimerId

    const signal = options?.signal ?? el.signal

    this.signal = signal
    this.fuzzySearch = options?.fuzzySearch
    this.timeout = options?.timeout ?? 1350

    callback ??= options?.callback

    el.addEventListener(
      "keydown",
      (e) => {
        if (e.code === "Escape") return void (this.searchBuffer = "")
        if (e.ctrlKey || e.altKey || e.metaKey) return
        if (e.key.length !== 1) return

        clearTimeout(searchTimerId)
        this.searchBuffer += e.key
        // console.log(this.searchBuffer)

        let res = this.fuzzySearch(this.searchBuffer)
        if (options?.multiple !== true) res = res[0]
        if (res) callback(res)

        searchTimerId = setTimeout(() => {
          this.searchBuffer = ""
        }, this.timeout)
      },
      { signal },
    )
  }
}

export function fuzzyField(el, options, callback) {
  return new FuzzyField(el, options, callback)
}
