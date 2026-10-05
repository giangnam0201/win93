/* eslint-disable max-depth */
// @thanks https://github.com/h5bp/server-configs-apache/blob/master/dist/.htaccess
// @read https://www.iana.org/assignments/media-types/media-types.xhtml
// @read https://httpd.apache.org/docs/current/mod/mod_mime.html#addtype
// @see https://github.com/jshttp/mime-db

/*
[1] https://mimesniff.spec.whatwg.org/#matching-a-font-type-pattern

[2] Serving `.ico` image files with a different media type
prevents Internet Explorer from displaying them as images:
https://github.com/h5bp/html5-boilerplate/commit/37b5fec090d00f38de64b591bcddcb205aadf8ee

[3] Servers should use text/javascript for JavaScript resources.
https://html.spec.whatwg.org/multipage/scripting.html#scriptingLanguages

[4] https://cbor.io/spec.html
*/

export const extnames = {}
export const basenames = {}
export const mimetypes = {
  // Data interchange
  application: {
    "json": "json map topojson",
    "json5": "json5",
    "atom+xml": "atom",
    "cbor": "cbor", // [4]
    "octet-stream": "bin",
    "ld+json": "jsonld",
    "manifest+json": "webmanifest",
    "msgpack": "msp msgpack",
    "pdf": "pdf",
    "rss+xml": "rss",
    "vnd.geo+json": "geojson",
    "vnd.ms-fontobject": "eot", // [1]
    "wasm": "wasm",
    "webbundle": "wbn",
    "x-ndjson": "ndjson",
    "x-web-app-manifest+json": "webapp",
    "xml": "xml rdf",
    "xslt+xml": "xslt",
    "x-shockwave-flash": "swf",
    "x-navi-animation": "ani",

    // Archives
    "gzip": "gz tgz",
    "vnd.rar": "rar",
    "x-7z-compressed": "7z",
    "x-tar": "tar",
    "zip": "zip",
  },

  // Web fonts
  font: {
    ttf: "ttf",
    woff: "woff",
    woff2: "woff2",
    collection: "ttc",
    otf: "otf",
  },

  // Media files
  audio: {
    "mpeg": "mp3 mpga mp2 mp2a m2a m3a",
    "flac": "flac",
    "wav": "wav",
    "ogg": "oga ogg spx opus",
    "aac": "adts aac",
    "midi": "mid midi kar rmi",
    "mp4": "m4a f4a f4b mp4a",
    "webm": "weba",
    "x-aiff": "aif aiff aifc",
  },
  video: {
    "mp4": "mp4 f4v f4p m4v mp4v mpg4",
    "webm": "webm",
    "3gpp": "3gp",
    "ogg": "ogv",
    "quicktime": "mov",
    "x-flv": "flv",
    "x-matroska": "mkv",
    "x-ms-wmv": "wmv",
    "x-msvideo": "avi",
  },
  image: {
    "jpeg": "jpg jpeg jpe",
    "gif": "gif",
    "png": "png",
    "webp": "webp",
    "svg+xml": "svg svgz",
    "bmp": "bmp dib",
    "apng": "apng",
    "avif": "avif",
    "tiff": "tif tiff",
    "x-icon": "ico cur", // [2]
  },
  text: {
    "plain": "txt conf log me faq desktop directory",
    "html": "html htm xhtml",
    "css": "css",
    "javascript": "js mjs", // [3]
    "markdown": "md markdown",
    "cache-manifest": "manifest mf appcache",
    "calendar": "ics",
    "csv": "csv",
    "php": "php",
    "tab-separated-values": "tsv",
    "vcard": "vcard vcf",
    "vnd.rim.location.xloc": "xloc",
    "vtt": "vtt",
    "x-ansi": "ans",
    "x-component": "htc",
    "x-nfo": "nfo",
  },
}

const UTF8 = {
  application: [
    "atom+xml",
    "json",
    "ld+json",
    "manifest+json",
    "rss+xml",
    "vnd.geo+json",
    "vnd.rim.location.xloc",
    "x-bb-appworld",
    "x-web-app-manifest+json",
    "xml",
  ],
  image: [
    "svg+xml", //
  ],
  text: [
    "cache-manifest",
    "calendar",
    "css",
    "html",
    "javascript",
    "markdown",
    "plain",
    "vcard",
    "vnd.wap.wml",
    "vtt",
    "x-component",
    "xml",
  ],
}

for (const type in mimetypes) {
  if (Object.hasOwn(mimetypes, type)) {
    for (const subtype in mimetypes[type]) {
      if (Object.hasOwn(mimetypes[type], subtype)) {
        const infos = { mimetype: `${type}/${subtype}` }
        if (UTF8[type]?.includes(subtype)) infos.charset = "utf-8"
        infos.keep = true
        infos.extnames = mimetypes[type][subtype].split(" ").map((x) => `.${x}`)
        mimetypes[type][subtype] = infos
        for (const ext of infos.extnames) extnames[ext] = infos
      }
    }
  }
}

const a = [
  "manifest.json", //
]

// @ts-ignore
mimetypes.application["manifest+json"].basenames = a

for (const filename of a) {
  basenames[filename] = mimetypes.application["manifest+json"]
}

const b = [
  "about",
  "authors",
  "contributor",
  "copying",
  "license",
  "readme",
  "todo",
]

b.push(...b.map((name) => name.toUpperCase()))

// @ts-ignore
mimetypes.text.plain.basenames = b

for (const filename of b) {
  basenames[filename] = mimetypes.text.plain
}
