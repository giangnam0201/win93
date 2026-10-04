let activeVJController

/**
 * @param {unknown} controller
 */
export function setActiveVJController(controller) {
  activeVJController = controller
}

export function getActiveVJController() {
  return activeVJController
}
