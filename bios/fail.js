/* eslint-disable */
void (function () {
  var boot = document.querySelector("output#boot")
  var span = document.createElement("span")
  var currentScript = /** @type {HTMLScriptElement} */ (document.currentScript)
  var isDynamic = currentScript.src.indexOf("dynamic") !== -1
  span.className = "red"
  span.textContent =
    "--- " +
    (isDynamic ? "IMPORT" : "INIT") +
    " FAILURE ---\n" +
    "Current browser does not support required JavaScript modules.\n\n" +
    "PLEASE UPGRADE BROWSER FOR OPTIMAL EXPERIENCE."
  boot.appendChild(span)
})()
