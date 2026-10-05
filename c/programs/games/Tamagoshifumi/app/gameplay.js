import Stack from "../js/core/Stack.js"

import { randomItem, rng } from "../js/chance.js"

class Deck extends Stack {}

const TR = {
  attack: "ROCK",
  block: "PAPER",
  grab: "SCISSORS",
}

class Player {
  constructor(n = 1) {
    this._main = ""
    this._lover = ""
    this.n = n
    this.win = 0
    this.deck = new Deck()
    this.poo = 0
    /*  */
    this.lang = "fr"
    this.unlocked = []
    this.btsScores = []
  }

  toJSON() {
    return {
      win: this.win,
      prog: this.prog,
      main: this.main,
      lover: this.lover,
      lang: this.lang,
      unlocked: this.unlocked,
      btsScores: this.btsScores,
    }
  }

  assign(config) {
    if (config) {
      if (config.deck) {
        this.deck.from(config.deck)
        delete config.deck
      }
      Object.assign(this, config)
      this.setup()
    }
    if (this.win > 7) this.win = 7
  }

  set main(val) {
    this._main = val
    this.setup()
  }
  get main() {
    return this._main
  }

  set lover(val) {
    this._lover = val
    this.setup()
  }
  get lover() {
    return this._lover
  }

  bar() {
    return Math.max(0, this.hp / this.life)
  }

  setup() {
    if (this.main && this.lover) {
      this.character = $.characters[this.main]

      this.unlocked.forEach($.unlock)

      this.hp = this.character.hp
      this.life = this.character.hp

      this.moves = {
        main: this.character.moves,
        lover: $.characters[this.lover].moves,
      }
    }
  }

  random() {
    const fakeRandom = () =>
      Math.random() > 0.5
        ? "train"
        : randomItem(this.main === "kuno" ? $.CARDS_KUNO : $.CARDS)

    this.deck.clear().add(fakeRandom()).add(fakeRandom()).add(fakeRandom())

    this.poo = 0
    this.deck.forEach((item) => {
      if (item === "drink" || item === "food") this.poo++
      if (item === "wc") this.poo = 0
    })
  }

  move(type) {
    const move = { type, move: type }

    if (type === "super") {
      move.color = "#ff0"
      move.type = this.moves.main.super.type
      move.damage = this.moves.main.super.damage
      move.heal = this.moves.main.super.heal
      move.super = true
      move.inputs = this.moves.main.super.inputs
    } else if (type === "lover") {
      move.color = "#e6e"
      move.type = this.moves.lover.super.type
      move.damage = this.moves.lover.super.damage
      move.heal = this.moves.lover.super.heal
      move.lover = true
      move.inputs = this.moves.lover.super.inputs
    } else {
      move.damage = this.moves.main[type].damage
      move.heal = this.moves.main[type].heal
      move.inputs = TR[type]
    }

    if (this.poo) {
      const dice = Math.round(rng(this.poo, 5))
      if (dice === 5) {
        move.pooped = true
        this.poo--
      }
    }

    // if (this.n === 1) move.pooped = true;

    return move
  }

  hit(d) {
    this.hp -= d
    if (this.hp <= 0) return true
  }

  heal(h) {
    this.hp += h
    if (this.hp > this.life) this.hp = this.life
  }

  quit() {
    this.fresh()
    this.win = 0
  }

  fresh() {
    this.deck.length = 0
    this.poo = 0
    this.hp = this.life
  }

  reset() {
    this.fresh()
    this.main = undefined
    this.lover = undefined
    this.prog = undefined
    this.win = 0
  }
}

class Rival extends Player {
  constructor(game, main) {
    super(game, 2)

    this.main = main
    this.random()

    if (player) {
      const CH = $.CHARS.filter(
        (item) =>
          item !== main && item !== player.main && item !== player.lover,
      )

      this.lover = randomItem(CH)
    }
  }

  randomMove() {
    const MOVES = ["attack", "block", "grab"]
    if (this.deck.has("train")) MOVES.push("super", "super")
    if (this.deck.has("love")) MOVES.push("lover")
    return randomItem(MOVES)
  }

  move(type) {
    if (type) return super.move(type)
    return super.move(this.randomMove())
  }

  bts() {
    return $.bts(true)
  }
}

class Boss extends Player {
  constructor(game) {
    super(game, 2)
    this.boss = true
    this.mimic()
  }

  mimic() {
    this.main = player.main
    this.lover = player.lover
    this.poo = player.poo
    this.deck.push(...player.deck)
    this.setup()
    this.hp = this.hp * 2
    this.life = this.life * 2
  }

  move(type, ptype) {
    return super.move(ptype)
  }

  bts() {
    return $.bts(true)
  }
}

const gameplay = {
  Player,
  Rival,
  Boss,

  check(t1, t2) {
    if (t1 === "attack") {
      if (t2 === "attack") return 0
      if (t2 === "block") return 2
      if (t2 === "grab") return 1
    }
    if (t1 === "block") {
      if (t2 === "attack") return 1
      if (t2 === "block") return 0
      if (t2 === "grab") return 2
    }
    if (t1 === "grab") {
      if (t2 === "attack") return 2
      if (t2 === "block") return 1
      if (t2 === "grab") return 0
    }
  },

  round(check, m1, m2) {
    if (m1.super) player.deck.delete("train")
    if (m1.lover) player.deck.delete("love")

    if (m2.super) rival.deck.delete("train")
    if (m2.lover) rival.deck.delete("love")

    function getDamage(m, p1, p2) {
      const { damage } = m
      const drink = p1.deck.count("drink")
      const food = p2.deck.count("food")

      const d =
        (m.lover && p1.lover === "marco") || (m.super && p1.main === "marco")
          ? 0
          : Math.max(1, damage + drink - food)

      if (window.dev) {
        console.log("______________________________________")
        console.log("damage = hit + self-drink - rival-food")
        console.log(`${d} = ${damage} + ${drink} - ${food}`)
      }
      return d
    }

    if (check === 1) {
      const damage = getDamage(m1, player, rival)
      if (m1.heal) player.heal(m1.heal)
      return rival.hit(damage) === true ? 1 : 0
    } else if (check === 2) {
      const damage = getDamage(m2, rival, player)
      if (m2.heal) rival.heal(m2.heal)
      return player.hit(damage) === true ? 2 : 0
    }
  },

  randomChar: () => randomItem($.CHARS),
}

export default gameplay
