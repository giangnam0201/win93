export const supportsInstall =
  "relList" in HTMLLinkElement.prototype &&
  document.createElement("link").relList.supports("manifest") &&
  "onbeforeinstallprompt" in window
