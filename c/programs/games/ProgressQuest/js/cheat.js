function Cheats() {
  if ($(".cheater").length > 0) return

  function cheat(label, effect) {
    $("<button/>", {
      class: "cheater",
      text: label,
      click: effect,
    }).appendTo("body")
  }

  cheat("Task", () => {
    TaskBar.reposition(TaskBar.Max())
  })

  cheat("Level", () => {
    LevelUp()
  })

  cheat("Quest", () => {
    QuestBar.reposition(QuestBar.Max())
    TaskBar.reposition(TaskBar.Max())
  })

  cheat("Plot", () => {
    PlotBar.reposition(PlotBar.Max())
    TaskBar.reposition(TaskBar.Max())
  })

  cheat("Pause", () => {
    if (timerid) {
      StopTimer()
    } else {
      StartTimer()
    }
  })

  cheat("Break", () => {
    debugger
  })
  cheat("Equip", () => {
    WinEquip()
  })

  cheat("Item", () => {
    WinItem()
  })

  cheat("Clear items", () => {
    while (Inventory.length() > 1) {
      Inventory.remove1()
    }
  })

  cheat("Spell", () => {
    WinSpell()
  })

  cheat("Stat", () => {
    WinStat()
  })

  cheat("$$$", () => {
    Add(Inventory, "Gold", Random(100))
  })

  cheat("Save", () => {
    SaveGame()
    alert(JSON.stringify(game).length)
  })

  cheat("Quit", quit)
}
