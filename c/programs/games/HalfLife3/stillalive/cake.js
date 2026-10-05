/* Creative Commons License Portal End Credits Web by xBytez/TylaKitty/Valve is licensed under a Creative Commons Attribution-ShareAlike 4.0 International License. Based on a work at https://xbytez.eu/. */
const cake = {
  delayMultiplier: 1000,
  creditsStartTime: 9,
  creditsMaxTime: 173,
  blinkerTime: 0.3 * 1000,
  maxCredits: 15,
  firstLyricsIndex: 0,
  lastCreditsIndex: 0,
  init() {
    cake.lyricsdiv = document.querySelector("#lyricstext")
    cake.creditsdiv = document.querySelector("#creditstext")
    cake.drawLyricsBorder()
    cake.drawCreditsBorder()
    cake.initCredits()
    cake.initBlinker()
    cake.initMusicPlayer()
    cake.processLyricLines()
    cake.processCreditLines()
  },
  initMusicPlayer() {
    const delay = 6.87 * 1000
    cake.player = document.createElement("audio")
    if (cake.player.play) {
      cake.player.setAttribute("prebuffer", "auto")
      cake.player.setAttribute("src", "Still Alive.ogg")
      setTimeout(() => cake.player.play(), delay)
    }
  },
  drawLyricsBorder() {
    let toptext = ""
    for (let x = 0; x < 46; x++) {
      toptext += "-"
    }

    let verttext = ""
    for (let x = 0; x < 32; x++) {
      verttext += "|<br />"
    }

    let horiztext = ""
    for (let x = 0; x < 46; x++) {
      horiztext += "-"
    }

    const left = document.querySelector("#lyricsleft")
    left.innerHTML = verttext
    const top = document.querySelector("#lyricstop")
    top.innerHTML = toptext
    const right = document.querySelector("#lyricsright")
    right.innerHTML = verttext
    const bottom = document.querySelector("#lyricsbottom")
    bottom.innerHTML = horiztext
  },
  drawCreditsBorder() {
    let toptext = ""
    for (let x = 0; x < 43; x++) {
      toptext += "-"
    }

    let verttext = ""
    for (let x = 0; x < 16; x++) {
      verttext += "|<br />"
    }

    // verttext += '|';
    // verttext += '|<br />';
    let horiztext = "| "
    // let horiztext = "  "
    for (let x = 0; x < 43; x++) {
      horiztext += "-"
    }

    horiztext += " |"
    const left = document.querySelector("#creditsleft")
    left.innerHTML = verttext
    const top = document.querySelector("#creditstop")
    top.innerHTML = toptext
    const right = document.querySelector("#creditsright")
    right.innerHTML = verttext
    const bottom = document.querySelector("#creditsbottom")
    bottom.innerHTML = horiztext
  },
  drawPictureBorder() {},
  initBlinker() {
    if (!cake.lyricsBlinker) {
      cake.lyricsBlinker = document.createElement("span")
      document.querySelector("#lyricstext").append(cake.lyricsBlinker)
      cake.blink(cake.lyricsBlinker)
    }

    if (!cake.creditsBlinker) {
      cake.creditsBlinker = document.createElement("span")
      cake.creditsBlinker.id = "creditsBlinker"
      document.querySelector("#creditstext").append(cake.creditsBlinker)
      cake.blink(cake.creditsBlinker)
    }
  },
  blink(blinker) {
    const nextChar = blinker.innerHTML
    let newChar = "_"
    if (nextChar === "_") {
      newChar = "&nbsp;"
    }

    if (nextChar === "&nbsp;") {
      newChar = "_"
    }

    blinker.innerHTML = newChar
    if (cake.blinkerTime !== 300) {
      alert(cake.blinkerTime)
      cake.smash()
    }

    setTimeout(() => {
      cake.blink(blinker)
    }, cake.blinkerTime)
  },
  processLetter(type, lineindex, letter) {
    const line = document.getElementById(type + lineindex)
    if (line) {
      if (letter === "newline") {
        line.append(document.createElement("br"))
      } else {
        if (letter === "<") {
          letter = "&lt;"
        }

        if (letter === ">") {
          letter = "&gt;"
        }

        if (letter === " ") {
          letter = "&nbsp;"
        }

        line.innerHTML += letter
      }
    }
  },
  processLyricLine(index) {
    if (index < cake.firstLyricsIndex) {
      return
    }

    let lastLineDiv
    for (
      let lastIndex = index - 1;
      lastIndex >= 0 && !lastLineDiv && lyrics[lastIndex].clear == 0;
      lastIndex--
    ) {
      lastLineDiv = document.getElementById("lyrics" + lastIndex)
    }

    const newlyrics = document.createElement("span")
    newlyrics.id = "lyrics" + index
    if (lastLineDiv) {
      cake.lyricsdiv.insertBefore(newlyrics, lastLineDiv.nextSibling)
    } else {
      let nextLineDiv
      for (
        let nextIndex = index + 1;
        nextIndex < index + 50 && !nextLineDiv;
        nextIndex++
      ) {
        nextLineDiv = document.getElementById("lyrics" + nextIndex)
      }

      if (nextLineDiv) {
        cake.lyricsdiv.insertBefore(newlyrics, nextLineDiv)
      } else {
        cake.lyricsdiv.insertBefore(newlyrics, cake.lyricsBlinker)
      }
    }

    const curlyric = lyrics[index]
    if (curlyric.changepicture > -1) {
      cake.setPicture(curlyric.changepicture)
    }

    const { clear } = curlyric
    if (clear == 1) {
      cake.clearLyrics()
      cake.firstLyricsIndex = index
    } else {
      const { text } = curlyric
      const delay = curlyric.delay * cake.delayMultiplier
      let letterdelay = 0
      if (text.length > 0) {
        letterdelay = delay / (text.length + 1)
      }

      for (let x = 0; x < text.length; x++) {
        timeout = setTimeout(
          "cake.processLetter('lyrics'," +
            index +
            ',"' +
            text.substring(x, x + 1) +
            '")',
          letterdelay * x,
        )
      }

      if (curlyric.nonewline == 0) {
        timeout = setTimeout(
          "cake.processLetter('lyrics'," + index + ",'newline')",
          letterdelay * text.length,
        )
      }
    }
  },
  processLyricLines() {
    let delay = 0
    for (let index = 0; index < lyrics.length; index++) {
      timeout = setTimeout("cake.processLyricLine(" + index + ")", delay)
      delay += lyrics[index].delay * cake.delayMultiplier
    }
  },
  clearLyrics() {
    cake.lyricsdiv.innerHTML = ""
    cake.lyricsdiv.append(cake.lyricsBlinker)
  },
  setPicture(id) {
    const picture = document.querySelector("#picturetext")
    picture.innerHTML = ""
    const curart = asciiart[String(id) + ""]
    if (curart) {
      for (const line in curart) {
        const node = document.createElement("div")
        let curline = curart[line]
        curline = curline.replaceAll("<", "&lt;")
        curline = curline.replaceAll(">", "&gt;")
        curline = curline.replaceAll(" ", "&nbsp;")
        node.innerHTML = curline
        picture.append(node)
      }
    }
  },
  initCredits() {
    for (let index = 0 - cake.maxCredits; index < 0; index++) {
      const newcredits = document.createElement("div")
      newcredits.id = "credits" + index
      newcredits.innerHTML = "&nbsp;"
      cake.creditsdiv.append(newcredits)
    }
  },
  processCreditLine(index) {
    for (
      let lastIndex = cake.lastCreditsIndex - cake.maxCredits;
      lastIndex >= 0 - cake.maxCredits;
      lastIndex--
    ) {
      const pastLineDiv = document.getElementById("credits" + lastIndex)
      if (pastLineDiv) {
        pastLineDiv.remove()
      } else {
        break
      }
    }

    if (index < cake.lastCreditsIndex - cake.maxCredits) {
      return
    }

    let lastLineDiv
    for (
      let lastIndex = index - 1;
      lastIndex >= 0 && !lastLineDiv;
      lastIndex--
    ) {
      lastLineDiv = document.getElementById("credits" + lastIndex)
    }

    const newcredits = document.createElement("span")
    newcredits.id = "credits" + index
    if (lastLineDiv) {
      cake.creditsdiv.insertBefore(newcredits, lastLineDiv.nextSibling)
    } else {
      cake.creditsdiv.insertBefore(newcredits, cake.creditsBlinker)
    }

    if (index > cake.lastCreditsIndex) {
      cake.lastCreditsIndex = index
    }

    const text = credits[index]
    for (let x = 0; x < text.length; x++) {
      setTimeout(
        "cake.processLetter('credits'," +
          index +
          ',"' +
          text.substring(x, x + 1) +
          '")',
        cake.creditsDelay * x,
      )
    }

    if (index < credits.length - 1) {
      setTimeout(
        "cake.processLetter('credits'," + index + ",'newline')",
        cake.creditsDelay * text.length,
      )
    }
  },
  processCreditLines() {
    let totalchars = 0
    for (let index = 0; index < credits.length; index++) {
      totalchars += credits[index].length + 1
    }

    cake.creditsDelay =
      (cake.creditsMaxTime * cake.delayMultiplier) / totalchars
    let delay = cake.creditsStartTime * cake.delayMultiplier
    for (let index = 0; index < credits.length; index++) {
      setTimeout(() => cake.processCreditLine(index), delay)
      delay += credits[index].length * cake.creditsDelay
    }
  },
}

window.onload = () => cake.init()
