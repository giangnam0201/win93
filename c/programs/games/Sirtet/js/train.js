// Copyright (c) 2017 Yiyuan Lee. MIT License.

import { AI } from "./AI.js"
import { Bag } from "./Bag.js"
import { Grid } from "./Grid.js"

function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min) + min)
}

function normalize(candidate) {
  const norm = Math.hypot(
    candidate.heightWeight,
    candidate.linesWeight,
    candidate.holesWeight,
    candidate.bumpinessWeight,
  )
  candidate.heightWeight /= norm
  candidate.linesWeight /= norm
  candidate.holesWeight /= norm
  candidate.bumpinessWeight /= norm
}

function generateRandomCandidate() {
  const candidate = {
    heightWeight: Math.random() - 0.5,
    linesWeight: Math.random() - 0.5,
    holesWeight: Math.random() - 0.5,
    bumpinessWeight: Math.random() - 0.5,
  }
  normalize(candidate)
  return candidate
}

function sort(candidates) {
  candidates.sort((a, b) => b.fitness - a.fitness)
}

function computeFitnesses(candidates, numberOfGames, maxNumberOfMoves) {
  let i = 0
  console.groupCollapsed("candidates")
  for (const candidate of candidates) {
    console.log(`candidate ${++i}/${candidates.length}`)
    const ai = new AI(candidate)
    let totalScore = 0
    for (let j = 0; j < numberOfGames; j++) {
      const grid = new Grid(22, 10)
      const bag = new Bag()
      const workingPieces = [bag.nextPiece(grid), bag.nextPiece(grid)]
      let workingPiece = workingPieces[0]
      let score = 0
      let numberOfMoves = 0
      while (numberOfMoves++ < maxNumberOfMoves && !grid.exceeded()) {
        workingPiece = ai.best(grid, workingPieces)
        while (workingPiece.moveDown(grid));
        grid.addPiece(workingPiece)
        const { distance } = grid.clearLines()
        score += distance
        for (let k = 0; k < workingPieces.length - 1; k++) {
          workingPieces[k] = workingPieces[k + 1]
        }

        workingPieces[workingPieces.length - 1] = bag.nextPiece(grid)
        workingPiece = workingPieces[0]
      }

      totalScore += score
    }

    candidate.fitness = totalScore
  }

  console.groupEnd()
}

function tournamentSelectPair(candidates, ways) {
  const indices = []
  for (let i = 0; i < candidates.length; i++) {
    indices.push(i)
  }

  // Note that the following assumes that the candidates array is
  // sorted according to the fitness of each individual candidates.
  // Hence it suffices to pick the least 2 indexes out of the random
  // ones picked.
  let fittestCandidateIndex1 = null
  let fittestCandidateIndex2 = null
  for (let i = 0; i < ways; i++) {
    const selectedIndex = indices.splice(randomInteger(0, indices.length), 1)[0]
    if (
      fittestCandidateIndex1 === null ||
      selectedIndex < fittestCandidateIndex1
    ) {
      fittestCandidateIndex2 = fittestCandidateIndex1
      fittestCandidateIndex1 = selectedIndex
    } else if (
      fittestCandidateIndex2 === null ||
      selectedIndex < fittestCandidateIndex2
    ) {
      fittestCandidateIndex2 = selectedIndex
    }
  }

  return [
    candidates[fittestCandidateIndex1],
    candidates[fittestCandidateIndex2],
  ]
}

function crossOver(candidate1, candidate2) {
  const candidate = {
    heightWeight:
      candidate1.fitness * candidate1.heightWeight +
      candidate2.fitness * candidate2.heightWeight,
    linesWeight:
      candidate1.fitness * candidate1.linesWeight +
      candidate2.fitness * candidate2.linesWeight,
    holesWeight:
      candidate1.fitness * candidate1.holesWeight +
      candidate2.fitness * candidate2.holesWeight,
    bumpinessWeight:
      candidate1.fitness * candidate1.bumpinessWeight +
      candidate2.fitness * candidate2.bumpinessWeight,
  }
  normalize(candidate)
  return candidate
}

function mutate(candidate) {
  const quantity = Math.random() * 0.4 - 0.2 // plus/minus 0.2
  switch (randomInteger(0, 4)) {
    case 0:
      candidate.heightWeight += quantity
      break
    case 1:
      candidate.linesWeight += quantity
      break
    case 2:
      candidate.holesWeight += quantity
      break
    case 3:
      candidate.bumpinessWeight += quantity
      break
    default:
  }
}

function deleteNLastReplacement(candidates, newCandidates) {
  candidates.splice(-newCandidates.length)
  for (const newCandidate of newCandidates) {
    candidates.push(newCandidate)
  }

  sort(candidates)
}

/**
 * @param {object} [params]
 * @param {number} [params.population] Population size. Default is `100`.
 * @param {number} [params.rounds] Rounds per candidate. Default is `5`.
 * @param {number} [params.moves] Max moves per round. Default is `200`.
 */
async function tune(params) {
  const config = {
    // Theoretical fitness limit = 5 * 200 * 4 / 10 = 400
    population: 100,
    rounds: 5,
    moves: 200,
    ...params,
  }

  const candidates = []

  // Initial population generation
  for (let i = 0; i < config.population; i++) {
    candidates.push(generateRandomCandidate())
  }

  console.log("Computing fitnesses of initial population...", config)
  computeFitnesses(candidates, config.rounds, config.moves)
  sort(candidates)

  let count = 0
  while (true) {
    const newCandidates = []
    for (let i = 0; i < 30; i++) {
      // 30% of population
      const pair = tournamentSelectPair(candidates, 10) // 10% of population

      // console.log('fitnesses = ' + pair[0].fitness + ',' + pair[1].fitness);
      const candidate = crossOver(pair[0], pair[1])
      if (Math.random() < 0.05) {
        // 5% chance of mutation
        mutate(candidate)
      }

      normalize(candidate)
      newCandidates.push(candidate)
    }

    console.group("Computing fitnesses of new candidates. (" + count + ")")
    computeFitnesses(newCandidates, config.rounds, config.moves)
    deleteNLastReplacement(candidates, newCandidates)
    let totalFitness = 0
    for (const candidate of candidates) {
      totalFitness += candidate.fitness
    }

    console.log("Average fitness = " + totalFitness / candidates.length)
    console.log(
      "Highest fitness = " + candidates[0].fitness + "(" + count + ")",
    )
    console.log("Fittest candidate", candidates[0])
    count++

    console.groupEnd()

    await 0
  }
}

let train

if (typeof window === "object") {
  const worker = new Worker(import.meta.url, { type: "module" })
  train = (options) => {
    worker.postMessage(options)
  }
} else {
  self.addEventListener("message", ({ data }) => {
    tune(data)
  })
}

export { train }
