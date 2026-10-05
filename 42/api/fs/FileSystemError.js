// @read https://en.wikipedia.org/wiki/Errno.h
// @read http://www.gnu.org/software/libc/manual/html_node/Error-Codes.html
// @thanks https://github.com/jvilk/BrowserFS/blob/master/src/core/api_error.ts

export class FileSystemError extends Error {
  static EPERM = 1
  static ENOENT = 2
  static EIO = 5
  static EBADF = 9
  static EACCES = 13
  static EBUSY = 16
  static EEXIST = 17
  static ENOTDIR = 20
  static EISDIR = 21
  static EINVAL = 22
  static EFBIG = 27
  static ENOSPC = 28
  static EROFS = 30
  static ENOTEMPTY = 39
  static ELOOP = 40
  static ENOTSUP = 95

  constructor(errno, path, description = "", options) {
    errno = Math.abs(errno)
    const message = FileSystemError.descriptions[errno]
    const code = FileSystemError.codes[errno]

    super(
      options?.auto === false
        ? description
        : `${message}${description ? ` (${description})` : ""}${path ? ` ‘${path}’` : ""}`,
    )

    Object.defineProperty(this, "name", { value: "FileSystemError" })

    this.path = path
    this.errno = errno
    this.code = code
  }
}

FileSystemError.codes = {}

for (const key of Object.keys(FileSystemError)) {
  FileSystemError.codes[FileSystemError[key]] = key
}

FileSystemError.descriptions = {
  [FileSystemError.EPERM]: "Operation not permitted",
  [FileSystemError.ENOENT]: "No such file or directory",
  [FileSystemError.EIO]: "Input/output error",
  [FileSystemError.EBADF]: "Bad file descriptor",
  [FileSystemError.EACCES]: "Permission denied",
  [FileSystemError.EBUSY]: "Resource busy or locked",
  [FileSystemError.EEXIST]: "File exists",
  [FileSystemError.ENOTDIR]: "File is not a directory",
  [FileSystemError.EISDIR]: "File is a directory",
  [FileSystemError.EINVAL]: "Invalid argument",
  [FileSystemError.EFBIG]: "File is too big",
  [FileSystemError.ENOSPC]: "No space left on disk",
  [FileSystemError.EROFS]: "Cannot modify a read-only file system",
  [FileSystemError.ENOTEMPTY]: "Directory is not empty",
  [FileSystemError.ELOOP]: "Too many levels of symbolic links",
  [FileSystemError.ENOTSUP]: "Operation is not supported",
}
