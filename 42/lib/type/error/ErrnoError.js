const WASM_ERRNO = {
  0: ["SUCCESS", "No error occurred. System call completed successfully"],
  1: ["2BIG", "Argument list too long"],
  2: ["ACCES", "Permission denied"],
  3: ["ADDRINUSE", "Address in use"],
  4: ["ADDRNOTAVAIL", "Address not available"],
  5: ["AFNOSUPPORT", "Address family not supported"],
  6: ["AGAIN", "Resource unavailable, or operation would block"],
  7: ["ALREADY", "Connection already in progress"],
  8: ["BADF", "Bad file descriptor"],
  9: ["BADMSG", "Bad message"],
  10: ["BUSY", "Device or resource busy"],
  11: ["CANCELED", "Operation canceled"],
  12: ["CHILD", "No child processes"],
  13: ["CONNABORTED", "Connection aborted"],
  14: ["CONNREFUSED", "Connection refused"],
  15: ["CONNRESET", "Connection reset"],
  16: ["DEADLK", "Resource deadlock would occur"],
  17: ["DESTADDRREQ", "Destination address required"],
  18: ["DOM", "Mathematics argument out of domain of function"],
  19: ["DQUOT", "Reserved"],
  20: ["EXIST", "File exists"],
  21: ["FAULT", "Bad address"],
  22: ["FBIG", "File too large"],
  23: ["HOSTUNREACH", "Host is unreachable"],
  24: ["IDRM", "Identifier removed"],
  25: ["ILSEQ", "Illegal byte sequence"],
  26: ["INPROGRESS", "Operation in progress"],
  27: ["INTR", "Interrupted function"],
  28: ["INVAL", "Invalid argument"],
  29: ["IO", "I/O error"],
  30: ["ISCONN", "Socket is connected"],
  31: ["ISDIR", "Is a directory"],
  32: ["LOOP", "Too many levels of symbolic links"],
  33: ["MFILE", "File descriptor value too large"],
  34: ["MLINK", "Too many links"],
  35: ["MSGSIZE", "Message too large"],
  36: ["MULTIHOP", "Reserved"],
  37: ["NAMETOOLONG", "Filename too long"],
  38: ["NETDOWN", "Network is down"],
  39: ["NETRESET", "Connection aborted by network"],
  40: ["NETUNREACH", "Network unreachable"],
  41: ["NFILE", "Too many files open in system"],
  42: ["NOBUFS", "No buffer space available"],
  43: ["NODEV", "No such device"],
  44: ["NOENT", "No such file or directory"],
  45: ["NOEXEC", "Executable file format error"],
  46: ["NOLCK", "No locks available"],
  47: ["NOLINK", "Reserved"],
  48: ["NOMEM", "Not enough space"],
  49: ["NOMSG", "No message of the desired type"],
  50: ["NOPROTOOPT", "Protocol not available"],
  51: ["NOSPC", "No space left on device"],
  52: ["NOSYS", "Function not supported"],
  53: ["NOTCONN", "The socket is not connected"],
  54: ["NOTDIR", "Not a directory or a symbolic link to a directory"],
  55: ["NOTEMPTY", "Directory not empty"],
  56: ["NOTRECOVERABLE", "State not recoverable"],
  57: ["NOTSOCK", "Not a socket"],
  58: ["NOTSUP", "Not supported, or operation not supported on socket"],
  59: ["NOTTY", "Inappropriate I/O control operation"],
  60: ["NXIO", "No such device or address"],
  61: ["OVERFLOW", "Value too large to be stored in data type"],
  62: ["OWNERDEAD", "Previous owner died"],
  63: ["PERM", "Operation not permitted"],
  64: ["PIPE", "Broken pipe"],
  65: ["PROTO", "Protocol error"],
  66: ["PROTONOSUPPORT", "Protocol not supported"],
  67: ["PROTOTYPE", "Protocol wrong type for socket"],
  68: ["RANGE", "Result too large"],
  69: ["ROFS", "Read-only file system"],
  70: ["SPIPE", "Invalid seek"],
  71: ["SRCH", "No such process"],
  72: ["STALE", "Reserved"],
  73: ["TIMEDOUT", "Connection timed out"],
  74: ["TXTBSY", "Text file busy"],
  75: ["XDEV", "Cross-device link"],
  76: ["NOTCAPABLE", "Extension: Capabilities insufficient"],
}

export class ErrnoError extends Error {
  constructor(message, cause) {
    let data
    if (cause?.errno in WASM_ERRNO) {
      data = WASM_ERRNO[cause?.errno]
      if (message === "FS error") message = data[1]
    }

    super(message)
    Object.defineProperty(this, "name", { value: "ErrnoError" })

    if (cause?.stack) this.stack = cause.stack
    if (cause?.errno) this.errno = cause.errno
    if (data?.[0]) this.code = "E" + data[0]
    if (cause?.node) this.node = cause.node
  }
}
