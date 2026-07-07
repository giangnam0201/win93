// https://modland.com/pub/modules/
// https://nostalgicplayer.dk/modules/format
// http://fileformats.archiveteam.org
// https://sembiance.com/fileFormatSamples/

import { loadArrayBuffer } from "../../../api/load/loadArrayBuffer.js"

export const CODECS = {
  midi: {
    name: "midi",
    kind: "chip-player",
    exts: ["mid", "midi"],
  },
  mdx: {
    name: "mdx",
    exts: ["mdx", "m"],
  },
  sidplayfp: {
    name: "sidplayfp",
    exts: ["sid", "psid"],
  },
  sc68n: {
    name: "sc68n",
    seek: false,
    exts: [
      "sc68", //
      "snd",
      "sndh",
    ],
  },
  vgm: {
    name: "vgm",
    kind: "chip-player",
    exts: [
      "dro", //
      "gym",
      "s98",
      "vgm",
      "vgz",
    ],
  },
  gme: {
    name: "gme",
    kind: "chip-player",
    exts: [
      "gbs", //
      "nsf",
      "nsfe",
      "spc",
      "ay",
    ],
  },
  xmp: {
    // https://github.com/libxmp/libxmp/blob/master/docs/formats.txt
    name: "xmp",
    exts: [
      "4c2",
      "669",
      "amf",
      "dbm",
      "digi",
      "dtm",
      "emod",
      "far",
      "flx",
      "fnk",
      "ft",
      "gdm",
      "gmc",
      "it",
      "j2b",
      "kris",
      "liq",
      "mdl",
      "med",
      "mod",
      "mot",
      "mt",
      "mtm",
      "mus",
      "okt",
      "okta",
      "oxm",
      "psm",
      "ptm",
      "rtm",
      "s3m",
      "sfx",
      "st26",
      "stm",
      "stx",
      "ult",
      "umx",
      "wow",
      "xm",
      "zak",
      // "dmf",
      // "hsc",
      // "imf",
      // "m15",
      // "mod.nt",
    ],
  },
  asap: {
    // https://asap.sourceforge.net/formats.html
    name: "asap",
    exts: [
      "cm3",
      "cmc",
      "cmr",
      "cms",
      "dlt",
      "dmc",
      "fc",
      "mpd",
      "mpt",
      "rmt",
      "sap",
      "tm2",
      "tm8",
      "tmc",
    ],
  },
  adplug: {
    // https://adplug.github.io/
    name: "adplug",
    exts: [
      "a2m", // meh
      "ad", // ?
      "adlib",
      "amd",
      "as3m",
      "bam",
      "cff",
      "cmf",
      "cym", // ?
      "d00",
      "ddt",
      "dfm",
      "dmo",
      "dro", // ?
      "fms", // ?
      "gmd", // ?
      "gms", // ?
      "hsc",
      "jbm",
      "laa",
      "lds",
      "m2m", // ?
      "mad",
      "mdi", // ?
      "mfp", // ?
      "mkj",
      "msc", // ?
      "mtk",
      "mtr",
      "mus",
      "nka", // ?
      "not", // ?
      "pis",
      "rad",
      "raw",
      "rmf", // ?
      "s3m",
      "sa2",
      "sat",
      "sng",
      "sop", // ?
      "src", // ?
      "xad",
      "xms",
      "xsm",
      // "adl",
      // "dtm",
      // "ems",
      // "fmk",
      // "fmt",
      // "imf",
      // "ksm",
      // "m",
    ],
  },
  zxtune: {
    // https://zxtune.bitbucket.io/info/features/#input
    name: "zxtune",
    exts: [
      "$b", // ?
      "$m", // ?
      "as0",
      "asc",
      "ay",
      "ayc", // ?
      "bin", // ?
      "cc3", // ?
      "cc4", // ?
      "charpres", // ?
      "chi", // ?
      "cop", // ?
      "dmm", // ?
      "dsk", // ?
      "dsq", // ?
      "dst", // ?
      "emul",
      "esv", // ?
      "et1", // ?
      "fdi", // ?
      "ftc",
      "gam", // ?
      "gamplus", // ?
      "gtr", // ?
      "hrm", // ?
      "hrp", // ?
      "lzh1", // ?
      "lzh2", // ?
      "lzs", // ?
      "megalz", // ?
      "msp", // ?
      "p", // ?
      "pack2", // ?
      "pcd", // ?
      "pdt", // ?
      "psc", // ?
      "psg", // ?
      "psm", // ?
      "pt1", // ?
      "pt2", // ?
      "pt2", // ?
      "pt3", // ?
      "s", // ?
      "scl", // ?
      "sna128", // ?
      "sqd", // ?
      "sqt", // ?
      "st2", // ?
      "st3", // ?
      "stc", // ?
      "stp", // ?
      "str", // ?
      "szx", // ?
      "td0", // ?
      "tf0", // ?
      "tfc", // ?
      "tfd", // ?
      "tfe", // ?
      "tlz", // ?
      "trd", // ?
      "trs", // ?
      "ts", // ?
      "vtx", // ?
      "ym",
      "z80", // ?
    ],
  },
}

export const CODECS_LIST = Object.values(CODECS)

export async function findCodec(path) {
  const pathLower = path.toLowerCase()

  let ext
  let arrayBuffer

  let codec = CODECS_LIST.find(({ exts }) =>
    exts.some((str) => {
      const found =
        pathLower.endsWith(`.${str}`) || pathLower.startsWith(`${str}.`)
      if (found) ext = str
      return found
    }),
  )

  // Ckeck if .mus is adlibMUS
  if (ext === "mus") {
    arrayBuffer = await loadArrayBuffer(path)
    const uint8Arr = new Uint8Array(arrayBuffer)

    const magic = [
      1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 240,
    ]

    let isAdlibMUS = true
    for (let i = 0, l = magic.length; i < l; i++) {
      if (magic[i] !== uint8Arr[i]) {
        isAdlibMUS = false
        break
      }
    }

    if (isAdlibMUS) codec = CODECS.adplug
  }

  // Ckeck if s3m is using adlib
  if (ext === "s3m") {
    arrayBuffer = await loadArrayBuffer(path)
    const text = new TextDecoder().decode(
      new Uint8Array(arrayBuffer).subarray(48, 600),
    )
    if (text.includes("SCRI")) {
      codec = CODECS.adplug
    }
  }

  return { codec, path, ext, arrayBuffer }
}
