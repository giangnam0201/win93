export default {
  options: {
    apps: {
      defaultApps: {
        "application/json": "code",
        "application/json5": "code",
        "text/*": "code",
        "text/markdown": "markdown",
        "text/html": "iframe",
        "text/x-bytebeat": "bytebeat",
        "image/*": "image",
        "audio/*": "media",
        "video/*": "media",
      },
    },
    themes: {
      current: "/42/themes/tribute/windows9x.theme.css",
      options: {
        windows9x: {
          scheme:
            "/c/users/windows93/interface/themes/windows9x/schemes/Windows 93.theme",
        },
      },
    },
  },
  env: {
    USER: "windows93",
    USERS_DIR: "/c/users",
    EDITOR: "code",
  },
}
