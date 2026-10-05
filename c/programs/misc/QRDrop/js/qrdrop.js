export function renderApp(app) {
  let exportMode = false

  app.menubar = [
    {
      label: 'File',
      content: [
        app.registerAction({
          label: 'Send File',
          picto: 'folder-open',
          shortcut: 'Ctrl+S',
          action: () => app.openFile(),
        }),
        app.registerAction({
          label: 'Receive File',
          picto: 'save',
          shortcut: 'Ctrl+R',
          action: () => app.emit('receive'),
        }),
        '---',
        app.menus.exit(),
      ],
    },
    {
      label: 'Options',
      content: () => [
        app.registerAction({
          label: exportMode ? '✓ Auto-Export' : 'Auto-Export',
          action: () => {
            exportMode = !exportMode
            app.emit('exportMode', exportMode)
          },
        }),
      ],
    },
    app.menus.HelpMenu(),
  ]
}
