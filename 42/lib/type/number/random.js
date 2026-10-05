const { random } = Math

export const randomInteger = (min = 0, max = 9, r = random) =>
  Math.floor(r() * (max - min + 1)) + min
