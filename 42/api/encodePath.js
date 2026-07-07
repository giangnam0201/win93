export const entities = {
  "%": "%25",
  " ": "%20",
  '"': "%22",
  "?": "%3F",
  "#": "%23",
}

export function encodePath(path) {
  return path
    .replaceAll("%", entities["%"])
    .replaceAll(" ", entities[" "])
    .replaceAll('"', entities['"'])
    .replaceAll("?", entities["?"])
    .replaceAll("#", entities["#"])
}
