import { alert, confirm } from "../../../../../42/ui/layout/dialog.js"

function b64_decode(value) {
  return JSON.parse(decodeURIComponent(escape(atob(value))))
}

function b64_stringify(value) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(value))))
}

function dropGuy(sheet) {
  try {
    sheet = sheet.replaceAll(/\s/g, "")
    sheet = b64_decode(sheet)
    storage.loadRoster((games) => {
      if (
        !games[sheet.Traits.Name] ||
        confirm(
          `A character named ${sheet.Traits.Name} already exists. Overwrite it?`,
        )
      ) {
        storage.addToRoster(sheet, () => storage.loadRoster(loadGames))
      }
    })
  } catch (err) {
    console.log(err)
    setTimeout(() => alert("Invalid character data", 1))
  }
}

function load() {
  if (!window.localStorage) {
    roster.html(
      "<b>Hrumph:</b> This browser does not support local storage. You can still play fast and loose: your character will live only as long as the game stays running in your browser.",
    )
    return
  }

  storage.loadRoster(loadGames)

  window.addEventListener("dragover", (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "copy"
  })
  window.addEventListener("drop", (e) => {
    e.preventDefault()
    e.stopImmediatePropagation()
    const { files } = e.dataTransfer
    for (let i = 0; i < files.length; i++) {
      files[i].text().then(dropGuy)
    }
  })

  document.querySelector("#pickup").addEventListener("change", (e) => {
    for (const file of e.target.files) {
      console.log(file)
      const reader = new FileReader()
      reader.readAsText(file, "UTF-8")
      reader.onload = function (evt) {
        dropGuy(evt.target.result)
      }

      reader.onerror = function (evt) {
        console.log("error reading file")
      }
    }

    e.target.value = ""
  })
}

function loadGames(games) {
  const roster = $("#roster")
  roster.empty()

  const newone = window.location.href.split("#")[1]

  let count = 0

  $.each(games, (key, c) => {
    const name = c.Traits.Name

    const br = brag(c)
    roster.append(br)
    br.find(".go").click(() => {
      window.location.href = "main.html#" + escape(name)
    })

    br.find(".delete").click(async () => {
      if (
        await confirm(
          `Terminate ${Pick(["faithful", "noble", "loyal", "brave"])} ${name}?`,
        )
      ) {
        delete games[name]
        storage.storeRoster(games)
        load()
      }
    })

    br.find(".sheet").click(() => {
      alert(template($("#sheet").html(), games[name]))
      // TODO: put in a window or whatev
    })

    br.find("a.save").attr(
      "href",
      `data:text/plain;name=${name}.pqw,${b64_stringify(c)}`,
    )
    br.find("a.save").attr("download", `${name}.pqw`)

    if (name === newone) {
      br.addClass("lit")
    }

    br.click((e) => {
      if (e.altKey) {
        let text = b64_stringify(c)
        text = text.match(/.{1,80}/g).join("\n")
        $("dialog#copy pre").text(text)
        $("dialog#copy span").text(name)
        sel = window.getSelection()
        window.setTimeout(() => {
          const range = document.createRange()
          range.selectNodeContents($("dialog#copy pre")[0])
          sel.removeAllRanges()
          sel.addRange(range)
        }, 1)
        $("dialog#copy")[0].showModal()
        // window.prompt("Copy to clipboard", text);
      }
    })
    br.find("a.go").attr(
      "data-downloadurl",
      `text/plain:${name}.pqw:data:text/plain,${b64_stringify(c)}`,
    )

    ++count
  })
  if (!count) {
    roster.html(
      "<span class='inline-block center-self'>No saved games were found.<br>Roll up a new character to get started.</span>",
    )
  }
}

function brag(sheet) {
  const brag = $(template($("#badge").html(), sheet))
  if (sheet.motto) {
    brag.find(".bs").text('"' + sheet.motto + '"')
  }

  if (sheet.online) {
    brag.addClass("online")
    brag.find(".bs").text("Realm of " + sheet.online.realm)
    brag.find(".icon.go").html("&#x273F;")
  }

  return brag
}

function clearRoster() {
  storage.storeRoster({}, load)
}

$(document).ready(() => {
  load()

  $("#roll").click(() => {
    window.location = "newguy.html"
  })

  $("#test").click(() => {
    window.location = "newguy.html?sold"
  })

  $("#clear").click(clearRoster)
})
