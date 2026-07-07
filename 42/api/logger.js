// TODO: check https://github.com/unjs/consola

const logger = console.log.bind(console)

logger.assert = console.assert.bind(console)
logger.clear = console.clear.bind(console)
logger.count = console.count.bind(console)
logger.countReset = console.countReset.bind(console)
logger.debug = console.debug.bind(console)
logger.dir = console.dir.bind(console)
logger.dirxml = console.dirxml.bind(console)
logger.error = console.error.bind(console)
logger.group = console.group.bind(console)
logger.groupCollapsed = console.groupCollapsed.bind(console)
logger.groupEnd = console.groupEnd.bind(console)
logger.info = console.info.bind(console)
logger.log = console.log.bind(console)
logger.profile = console.profile.bind(console)
logger.profileEnd = console.profileEnd.bind(console)
logger.table = console.table.bind(console)
logger.time = console.time.bind(console)
logger.timeEnd = console.timeEnd.bind(console)
logger.timeLog = console.timeLog.bind(console)
logger.timeStamp = console.timeStamp.bind(console)
logger.trace = console.trace.bind(console)
logger.warn = console.warn.bind(console)

logger.debug.verbose = console.debug.bind(console)

export { logger }
