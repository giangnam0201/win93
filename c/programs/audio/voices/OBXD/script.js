import { OBXD } from "./OBXD.js"
import { Piano } from "./libs/Piano.js"

const audioCtx = new AudioContext({ latencyHint: "interactive" })

const container = document.querySelector("div#container")
const frontpanel = document.querySelector("div#frontpanel")
const presets = document.querySelector("select")
const random = document.querySelector("#random")

// create WAM
// ----------
await OBXD.importScripts(audioCtx)
const obxd = new OBXD(audioCtx)
const gain = new GainNode(audioCtx, { gain: 0.9 })
obxd.connect(gain)
gain.connect(audioCtx.destination)

// frontpanel
// ----------
const gui = await obxd.loadGUI("skin")
frontpanel.append(gui)
// @ts-ignore
container.style.width = gui.width + "px"
// @ts-ignore
frontpanel.style.height = gui.height + "px"
frontpanel.className = "ready"
container.className = "ready"

// midi keyboard
// -------------
const midikeys = new Piano({
  container: document.querySelector("#keys"),
  height: 60,
  octaves: 6,
  startNote: "C2",
  oct: 4,
  // whiteNotesColour: "white",
  // blackNotesColour: "black",
  activeColour: "color-mix(in srgb, var(--accent-color, orange), white 50%)",
})

midikeys.keyDown = (note) => {
  obxd.onMidi([0x90, note, 100])
}

midikeys.keyUp = (note) => obxd.onMidi([0x80, note, 100])

// load bank and select a preset
// -----------------------------
await obxd.loadBank("presets/factory.fxb")
obxd.selectPatch(0)

for (let i = 0, l = obxd.patches.length; i < l; i++) {
  presets.append(new Option(obxd.patches[i], String(i)))
}

presets.addEventListener("input", () => {
  obxd.selectPatch(presets.value)
})

random.addEventListener("pointerdown", () => {
  const patch = new Array(70).fill(0).map(() => Math.random())
  obxd.setPatch(patch)
})

// console.log(obxd)
globalThis.obxd = obxd

/*  */

// obxd.onMidi([0x90, 47, 100])

// // DEEP BASS
// obxd.setPatch([
//   0.155_116_468_182_027_4, 0.183_191_677_681_602_94, 0.889_695_038_355_237_3,
//   0.134_401_790_475_599_86, 0.821_178_922_232_341_3, 0.171_831_114_067_631_4,
//   0.896_566_165_729_32, 0.581_555_527_913_154_6, 0.636_229_256_041_344_5,
//   0.952_419_134_756_607_8, 0.154_700_215_243_909_64, 0.173_349_972_892_656_86,
//   0.882_784_713_999_962_1, 0.818_827_403_709_853_1, 0.912_560_922_088_334_4,
//   0.760_635_015_896_456_3, 0.854_008_548_669_682_5, 0.003_579_288_332_234_087_4,
//   0.481_919_379_494_271_77, 0.106_425_091_877_234_26, 0.691_113_688_308_851_8,
//   0.444_009_167_361_848_7, 0.491_992_919_103_906_1, 0.140_587_948_095_789_45,
//   0.898_240_892_212_238_5, 0.197_558_159_295_624_37, 0.880_758_787_551_182,
//   0.131_445_401_486_968_6, 0.839_571_009_479_753_3, 0.770_323_538_446_634,
//   0.024_196_754_173_372_303, 0.212_392_086_798_190_33, 0.288_341_936_535_850_83,
//   0.424_016_126_904_411_6, 0.769_758_448_154_601_8, 0.413_808_912_238_014_86,
//   0.402_859_901_893_007_47, 0.187_394_515_246_773_75, 0.947_510_448_417_082_4,
//   0.623_341_829_971_019_6, 0.588_041_065_047_396_4, 0.836_507_066_734_784_9,
//   0.354_719_293_482_575_14, 0.344_574_192_942_589_6, 0.549_547_380_927_406_7,
//   0.057_455_998_925_699_75, 0.137_923_196_578_205_95, 0.375_374_591_856_787_23,
//   0.784_178_798_977_702_3, 0.031_681_374_056_323_76, 0.842_357_765_430_436_4,
//   0.130_205_869_175_849_42, 0.849_648_140_114_545_7, 0.716_154_612_371_99,
//   0.099_024_113_062_010_64, 0.328_311_440_535_205_9, 0.557_037_802_325_241_1,
//   0.117_409_082_407_622_82, 0.844_110_522_658_260_8, 0.672_947_456_301_805_4,
//   0.000_086_719_323_893_591_5, 0.850_546_891_798_792_2, 0.639_428_791_606_690_7,
//   0.083_457_998_613_709_4, 0.837_377_116_408_060_8, 0.815_858_254_150_381_4,
//   0.867_189_269_749_929_7, 0.510_238_831_984_791_9, 0.137_950_837_524_032_14,
//   0.226_840_568_644_236_52,
// ])
