export function resetLocalStorage() {
  localStorage.clear()
}

export function resetSessionStorage() {
  sessionStorage.clear()
}

export async function resetServiceWorker() {
  return navigator.serviceWorker
    .getRegistrations()
    .then((registrations) =>
      Promise.all(
        registrations.map((reg) => reg.unregister().then((ok) => [ok, reg])),
      ),
    )
}

export async function resetCaches() {
  return caches
    .keys()
    .then((keys) =>
      Promise.all(
        keys.map((key) => caches.delete(key).then((ok) => [ok, key])),
      ),
    )
}

export async function resetIndexedDB() {
  return window.indexedDB
    .databases() //
    .then((databases) =>
      Promise.all(
        databases.map(
          ({ name }) =>
            new Promise((resolve) => {
              const req = window.indexedDB.deleteDatabase(name)
              req.onerror = () => resolve([false, name])
              req.onsuccess = () => resolve([true, name])
            }),
        ),
      ),
    )
}

export async function resetAllData(options) {
  try {
    if (options?.localStorage !== false) resetLocalStorage()
    if (options?.sessionStorage !== false) resetSessionStorage()
  } catch {}

  const undones = []

  try {
    if (options?.serviceWorker !== false) undones.push(resetServiceWorker())
    if (options?.caches !== false) undones.push(resetCaches())
    if (options?.indexedDB !== false) undones.push(resetIndexedDB())

    return await Promise.all(undones)
  } catch (err) {
    console.log(err)
    return false
  }
}
