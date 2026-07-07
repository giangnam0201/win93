// @ts-nocheck
import { ConfigFile } from "../ConfigFile.js"
import { fs } from "../../fs.js"
import { loadDesktopStyle } from "../loadDesktopStyle.js"
import { fileIndex } from "../../fileIndex.js"

const DEFAULTS = {
  activeUser: "windows93",
  users: ["windows93"],
}

export const DEFAULT_DIRECTORIES = {
  "/bookmarks": "[Desktop Entry]\nIcon=folder-bookmark\n",
  "/books": "[Desktop Entry]\nIcon=folder-books\n",
  "/config": "[Desktop Entry]\nIcon=folder-development\n",
  "/desktop": "[Desktop Entry]\nIcon=folder-desktop\n",
  "/documents": "[Desktop Entry]\nIcon=folder-documents\n",
  "/interface": "[Desktop Entry]\nIcon=folder-activities\n",
  "/models": "[Desktop Entry]\nIcon=folder-models\n",
  "/music": "[Desktop Entry]\nIcon=folder-music\n",
  "/pictures": "[Desktop Entry]\nIcon=folder-image\n",
  "/roms": "[Desktop Entry]\nIcon=folder-games\n",
  "/sounds": "[Desktop Entry]\nIcon=folder-sound\n",
  "/videos": "[Desktop Entry]\nIcon=folder-video\n",
}

class UsersManager extends ConfigFile {
  async login(name) {
    if (!this.value.users.includes(name)) {
      throw new Error(`User ${name} does not exist`)
    }

    const userStyle = `/c/users/${name}/config/style.css`
    if (await fs.access(userStyle)) {
      fileIndex.set("/style.css", userStyle)
    } else {
      fileIndex.set("/style.css", 0)
    }

    await this.update({ activeUser: name })
    location.reload()
  }

  async logout() {
    await this.update({
      activeUser: undefined,
      loggedOut: this.value.activeUser,
    })
    location.reload()
  }

  async createUser(name) {
    if (this.value.users.includes(name)) {
      throw new Error(`User ${name} already exists`)
    }

    // Create the base user folder structure
    const basePath = `/c/users/${name}`

    const folders = Object.keys(DEFAULT_DIRECTORIES)
    for (const folder of folders) {
      await fs.writeDir(`${basePath}${folder}`)
      await fs.writeText(
        `${basePath}${folder}/.directory`,
        DEFAULT_DIRECTORIES[folder],
      )
    }

    await fs.writeText(
      `${basePath}/desktop/Home.desktop`,
      `[Desktop Entry]\nExec="$HOME/"\nIcon=user-home`,
    )

    await this.update({ users: [...this.value.users, name] })
  }

  async forkUser(name, forkedUserName) {
    if (!this.value.users.includes(name)) {
      throw new Error(`User ${name} does not exist`)
    }
    if (this.value.users.includes(forkedUserName)) {
      throw new Error(`User ${forkedUserName} already exists`)
    }

    const source = `/c/users/${name}`
    const dest = `/c/users/${forkedUserName}`

    await fs.copy(source, dest, { recursive: true })
    await this.update({ users: [...this.value.users, forkedUserName] })
  }

  async chooseUserDialog() {
    document.body.classList.add("desktop")
    await loadDesktopStyle()
    const { prompt, dialog } = await import("../../../ui/layout/dialog.js")
    const { users, loggedOut } = this.value

    let selectedUser = loggedOut ?? users[0]

    const content = {
      tag: ".cols.ma-y-xs.gap-xs",
      content: [
        {
          tag: "select",
          style: {
            minWidth: "23ch",
          },
          tabIndex: 1,
          content: users,
          value: selectedUser,
          on: {
            change: (e) => {
              selectedUser = e.target.value
            },
          },
        },
        {
          tag: "button.shrink",
          tabIndex: 3,
          title: "Create User",
          picto: "user-new",
          on: {
            click: async () => {
              dialogEl.classList.toggle("hide", true)
              const name = await prompt("Enter new user name:", {
                label: "Create User",
              })
              if (name) {
                dialogEl.close()
                await this.createUser(name)
                await this.login(name)
              } else {
                dialogEl.classList.toggle("hide", false)
              }
            },
          },
        },
      ],
    }

    const dialogEl = await dialog({
      label: "Session",
      icon: "apps/session",
      picto: "apps/session",
      skipSave: true,
      maximizable: false,
      closable: false,
      movable: false,
      resizable: false,
      content,
      footer: [
        {
          tag: "button.w-full",
          tabIndex: 2,
          content: "Log In",
          // picto: "key",
          on: { click: () => this.login(selectedUser) },
        },

        // {
        //   tag: "button",
        //   content: "Fork User",
        //   picto: "copy",
        //   on: {
        //     click: async () => {
        //       const forked = await prompt("Which user do you want to fork?")
        //       if (forked) {
        //         const name = await prompt(
        //           `Enter new user name for the fork of ${forked}:`,
        //         )
        //         if (name) {
        //           await this.forkUser(forked, name)
        //           await this.login(name)
        //         }
        //       }
        //     },
        //   },
        // },
      ],
    })
  }

  async claimRootUserDialog() {
    const { prompt, confirm } = await import("../../../ui/layout/dialog.js")

    const accept = await confirm(
      `%md **Attention:** You are currently logged in as the default user \"windows93\".  \n\n
This account has been updated externally.\n\n
Proceeding will replace your current desktop settings, wallpaper, and home directory files with the updated version.`,
      {
        label: "System Update",
        // icon: "warning",
        icon: "info",
        agree: "Yes, Overwrite",
        decline: "No, keep my files",
      },
    )

    if (accept) {
      document.querySelector("#desktopFolder")?.remove()
      const [
        { fs }, //
        { fileIndex },
        { FS_DRIVER_MASKS },
        { getDriverLazy },
      ] = await Promise.all([
        import("../../fs.js"),
        import("../../fileIndex.js"),
        import("../../fs/FileIndex.js"),
        import("../../fs/getDriverLazy.js"),
      ])
      try {
        const inodes = []
        fileIndex.readDir(
          "/c/users/windows93",
          { absolute: true, recursive: true },
          (p) => {
            if (!p.endsWith("/")) {
              const inode = fileIndex.get(p)
              if (Array.isArray(inode)) inodes.push(inode)
            }
          },
        )

        fileIndex.delete("/c/users/windows93", { silent: true })

        const styleInode = fileIndex.get("/style.css")
        if (
          typeof styleInode === "string" &&
          styleInode.startsWith("/c/users/windows93/")
        ) {
          fileIndex.set("/style.css", 0)
        }

        Promise.all(
          inodes.map(async ([id, mask]) => {
            const driverName = FS_DRIVER_MASKS[mask]
            if (driverName) {
              const driver = await getDriverLazy(driverName)
              if (driver.store?.delete) await driver.store.delete(id)
            }
          }),
        ).catch(console.error)

        await fs.writeDir("/c/users/windows93")
      } catch (err) {
        console.log(err)
      }
      await fileIndex.upgrade("/c/users/windows93")
      localStorage.removeItem("sys42_rootuser_timestamp")
      location.reload()
    } else {
      const ok = await confirm(
        "%md Do you want to create a new user?\n\nYour personal home folder will stay unchanged even after default user updates (no more overwrite warnings).",
        {
          label: "System Update",
          icon: "question",
          agree: "Yes",
          decline: "No",
        },
      )

      if (ok) {
        const name = await prompt("Enter new user name", {
          label: "Create User",
        })
        if (name) {
          await this.createUser(name)
          await this.login(name)
        }
      }
    }
  }
}

export const usersManager = new UsersManager("/users.json5", DEFAULTS)
usersManager.init()
