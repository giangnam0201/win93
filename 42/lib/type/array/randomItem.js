const { random } = Math

export const randomItem = (arr, r = random) => arr[Math.floor(r() * arr.length)]
