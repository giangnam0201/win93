export const uuid = () =>
  ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    (
      c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
    ).toString(16)
  );

export const uid = () =>
  Math.round(Math.random() * 16000000)
    .toString(16)
    .padStart(6, "0");

// export const roll = (faces = 6, rolls = 1) =>
//   [...crypto.getRandomValues(new Uint8Array(rolls))].map(
//     n => Math.round(n / 255 * (faces - 1)) + 1
//   );

// // WARNING - bad random with randomItem
// export const randomItem = arr => arr[roll(arr.length)[0] - 1];

export const randomItem = arr => arr[Math.floor(Math.random() * arr.length)];

export const rng = (min, max) => Math.random() * (max - min) + min;

export const shuffle = array => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
};
