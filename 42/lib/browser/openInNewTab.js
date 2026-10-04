export function openInNewTab(url) {
  const a = document.createElement("a")
  a.href = url
  a.rel = "noopener"
  a.referrerPolicy = "same-origin"
  a.target = "_blank"
  a.click()
}
