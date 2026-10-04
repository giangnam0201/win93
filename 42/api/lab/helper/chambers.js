// import { env } from "../../env.js"
// import { lab } from "../../lab.js"
// import { Test } from "../Test.js"
// import { ipc } from "../../ipc.js"

// // // console.log(env.realm.toString())

// // ipc.on("42_LAB_TESTS", (...args) => {
// //   console.log(args)
// // })

// ipc
//   .on("42_IPC_PING", (...args) => {
//     console.log("--- 42_IPC_PING", args)
//   })
//   .on("42_LAB_TESTS", (...args) => {
//     console.log("--- 42_LAB_TESTS", args)
//   })

// export function chambers(t, options) {
//   t.test.title += ` (${env.realm.toString()})`

//   if (!env.realm.inTop) {
//     return
//   }

//   if (options?.worker) {
//     const worker = new Worker(t.test.meta.filename, { type: "module" })
//     // console.log(889)
//     ipc.from(worker).on("42_LAB_TESTS", (...args) => {
//       console.log("+++ 42_LAB_TESTS", args)
//     })
//     // worker.onmessage = ({ data }) => {
//     //   console.log("BIP", data)
//     //   if (data?.type === "42_LAB_TESTS") {
//     //     const index = lab.tests.indexOf(t.test)
//     //     const { stats, tests } = data.value

//     //     for (const [key, val] of Object.entries(stats)) {
//     //       lab.stats[key] += val
//     //     }

//     //     for (const item of tests) {
//     //       const test = Test.deserialize(item)
//     //       lab.tests.splice(index + 1, 0, test)
//     //     }
//     //   }
//     // }
//   }
// }

export function chambers(...args) {
  console.log(args)
}
