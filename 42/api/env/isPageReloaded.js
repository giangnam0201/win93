// https://stackoverflow.com/a/79165921/1289275
export function isPageReloaded() {
  return window.performance.navigation
    ? window.performance.navigation.type ===
        window.performance.navigation.TYPE_RELOAD
    : window.performance
        .getEntriesByType("navigation")
        .map((nav) => nav.type)
        .includes("reload")
}
