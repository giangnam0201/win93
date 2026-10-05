import { randomItem } from "../../../../42/lib/type/array/randomItem.js"
import { playSound } from "../../../../42/api/os/systemSounds.js"
import { alert } from "../../../../42/ui/layout/dialog.js"

const A = [
  "retro-engineering",
  "reverse engineering",
  "deprogrammed obsolescence",
  "media archeology",
  "beige computer days",
  "recycling",
  "retrocomputing",
  "datamoshing",
  "parody",
  "inception",
  "666",
  "acid",
  "freedom",
  "infinity",
  "legacy",
  "pony",
  "art",
  "demoscene",
  "memetic",
  "hysteria",
  "proselytism",
  "liminal space",
  "thought contagion",
  "install gentoo",
  "dolphin",
  "corgi",
  "doge",
  "hydra",
  "helix",
  "yoda",
  "cat",
  "glitch",
  "troll",
  "noob",
  "ninja",
  "wizard",
  "ape",
  "monk",
  "y2k",
  "prompt engineering",
  "side quest",
  "floppy disk",
  "yolo",
  "dank",
  "shrek",
  "humans",
  "meta-humans",
  "numa numa",
  "trololo",
  "double rainbow",
  "hello world",
  "dystopia",
  "simulation",
  "fork bomb",
  "inbox zero",
  "standing desk",
  "post-truth",
  "late stage capitalism",
  "tl;dr",
]

const B = [
  "0",
  "easter egg",
  "pixel art",
  "php",
  "html",
  "html5",
  "javascript",
  "glsl",
  "webgl",
  "web3.0",
  "infinity",
  "NaN",
  "Math.random()",
  "π",
  "inception",
  "css3",
  "css",
  "bitcrusher",
  "free software",
  "prosthetic knowledge",
  "(x,y,z)",
  "vec3(0.0)",
  "virus",
  "a e s t h e t i c",
  "internet",
  "teh internetz",
  "hug of death",
  "wifi",
  "open source",
  "gnu",
  "os",
  "linux",
  "unix",
  "hyperlink",
  "copyleft",
  "creative commons",
  "MySQL",
  "rss",
  "nodejs",
  "server",
  "hack",
  "iframe",
  "canvas",
  "glitch",
  "ASCII",
  "utf-8",
  "emoji",
  "cthulhu",
  "unicode",
  "skills",
  "emulator",
  "crunch",
  "tech debt",
  "async await",
  "a11y",
  "i18n",
  "voxel",
  "low poly",
  "deepfake",
  "mobile first",
  "whitespace",
  "autotune",
  "github",
  "4k",
  "rng",
  "marquee",
  "afk",
  "dark mode",
  "cable management",
  "planned obsolescence",
  "force push",
  "monorepo",
  "npm install",
  "any%",
  "while(true)",
  "/dev/null",
  "segfault",
  "recursion",
  "table layout",
  "slop",
  "jailbreak",
  "hallucination",
  "bookmarklet",
  "segmentation fault",
  "floating point exception",
  "dead code",
  "buffer overflow",
  "race condition",
  "meltdown",
  "spectre",
  "directx",
  "polyfill",
  "opengl",
  "webgl2",
  "notepad++",
  "dreamweaver",
  "cookie banner",
  "svg",
  "p2p",
  "flash",
  "jQuery",
  "ajax",
  "java applet",
  "dark pattern",
  "rubber duck debugging",
  "http2",
  "ipv4",
  "yahoo",
  "cassette",
  "laserdisc",
  "regex",
  "GPU",
  "saas",
  "xss",
  "csrf",
]

const C = [
  "uchronia",
  "escapism",
  "brainrot",
  "anemoia",
  "popart",
  "anachronism",
  "dadaism",
  "surrealism",
  "new-realism",
  "meta-realism",
  "future",
  "matrix",
  "inception",
  "unproductivity",
  "procrastination",
  "useless",
  "unprofitability",
  "spaghetti code",
  "viral",
  "bytebeat",
  "acid",
  "epic fail",
  "epic win",
  "fap",
  "swag",
  "nope",
  "chuck norris",
  "over 9000",
  "tralalero tralala",
  "meta",
  "meta-meta",
  "lulz",
  "poop",
  "glitch",
  "life",
  "system32.dll",
  "myspace",
  "loominati",
  "virtual PC",
  "cyber party",
  "poney",
  "cthulhu",
  "zerg rush",
  "forever alone",
  "hug",
  "manifesto",
  "internet for ever",
  "fuck teh cloud",
  "web3.0",
  "null",
  "AI slop",
  "exit strategy",
  "eggplant",
  "soylent",
  "battlestation",
  "MVP",
  "DDoS",
  "stonks",
  "burnout",
  "passive income",
  "spatial computing",
  "crt monitor",
  "paradigm shift",
  "enshittification",
  "doomscrolling",
  "longtermism",
  "paperclip",
  "shoggoth",
  "hyperstition",
  "dreamcore",
  "dadcore",
  "metaverse",
  "futurism",
  "creepypasta",
  "terms of service",
  "digital detox",
  "fixing teh internet",
  "Z̤̲̙̙͎̥̝A͎̣͔̙͘L̥̻̗̳̻̳̳͢G͉̖̯͓̞̩̦O̹̹̺",
]

const WTF = [A, B, C]

function chance(p) {
  return !(Math.random() * 100 >= (p || 50))
}

let sloganDone = false

function manifesto() {
  if (chance(1) && !sloganDone) {
    sloganDone = true
    return `tomorrow is teh future`
  }

  if (chance(2)) {
    const str = randomItem(randomItem(WTF))
    return `${str} + ${str} = ${str}`
  }

  if (chance(15)) {
    return `${randomItem(randomItem(WTF))} + ${randomItem(randomItem(WTF))} = ${randomItem(randomItem(WTF))}`
  }

  return `${randomItem(A)} + ${randomItem(B)} = ${randomItem(C)}`
}

const QUACK_URL =
  "/c/users/windows93/interface/themes/windows9x/schemes/Windows 93/QUACK.ogg"

let dialogEl

/**
 * @param {import("42/api/os/App.js").App} app
 */
export async function launchApp(app) {
  return new Promise((resolve) => {
    alert(manifesto(), {
      label: "MANIFESTO",
      icon: "question",
      dialog: {
        width: 350,
        sound: QUACK_URL,
      },
      on: {
        "ui:dialog.open"(e, target) {
          dialogEl = target
          resolve(dialogEl)
        },
        "ui:dialog.close"() {
          app.destroy()
        },
      },
      decline: {
        content: "wtf?",
        onclick() {
          playSound(QUACK_URL)
          dialogEl.contentEl.textContent = manifesto()
        },
      },
    })
  })
}

export function destroyApp() {
  dialogEl?.close()
}
