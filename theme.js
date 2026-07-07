/* eslint-disable unicorn/consistent-function-scoping */
// import "../42/ui/desktop/workspaces.js"
// import "../42/ui/desktop/workspaces.js"
import "./42/ui/layout/menu.js"
import "./42/ui/layout/tabs.js"
import "./42/ui/control/knob.js"
import "./42/ui/control/volume.js"
import "./42/ui/media/picto.js"
import "./42/ui/desktop/dock.js"

// import { os } from "./42/api/os.js"
import { dialog, alert } from "./42/ui/layout/dialog.js"
import { toast } from "./42/ui/layout/toast.js"
import { fileIndex } from "./42/api/fileIndex.js"

// document.body.className = "desktop"

const lorem =
  "Lorèm, ipsum dôlor sit amét consectetur adipisicing elit. Quas, quo quidem voluptate, consectetur, sint repellendus expedita consequatur pariatur delectus cum inventore iure aperiam? Ad facere nemo tenetur nesciunt quam autem voluptatibus vel temporibus dolorem atque. Dolores beatae magnam iure, architecto eius explicabo aut molestias voluptas itaque dolorum sunt quisquam."
const lorem2 =
  "Lorèm, ipsum dôlor sit amét consectetur adipisicing elit.\nQuas, quo quidem voluptate, consectetur, sint repellendus expedita\nconsequatur pariatur delectus cum inventore iure aperiam?\nAd facere nemo tenetur nesciunt quam autem voluptatibus vel temporibus dolorem atque.\nDolores beatae magnam iure, architecto eius explicabo aut molestias voluptas itaque dolorum sunt quisquam."

const audioContext = new AudioContext()
const audioNode = new GainNode(audioContext, { gain: 0.01 })
const audioParam = audioNode.gain

let menuCnt = 0
function makeMenu(init) {
  menuCnt++
  return [
    {
      label: "Submenu",
      content: () => makeMenu(),
    },
    {
      label: "Menuitem",
      picto: "plus",
      shortcut: "Ctrl+Alt+Del",
    },
    {
      label: "Menuitem",
      disabled: true,
      picto: "places/folder",
      shortcut: "Ctrl+P",
    },
    {
      label: "Highlighted",
      class: init
        ? "ui-menu__menuitem ui-menu__menuitem--highlight"
        : undefined,
    },
    {
      label: "Empty Submenu",
      content: () => [],
    },
    "---",
    {
      label: "Checked",
      tag: "checkbox",
      value: true,
    },
    {
      label: "Indeterminate",
      tag: "checkbox",
      value: undefined,
    },
    {
      label: "Disabled",
      tag: "checkbox",
      disabled: true,
    },
    {
      label: "Radio 1",
      tag: "radio",
      name: "menu-choice" + menuCnt,
      value: "foo",
    },
    {
      label: "Radio 2",
      tag: "radio",
      name: "menu-choice" + menuCnt,
      value: "bar",
      checked: true,
    },
    {
      label: "Disabled",
      tag: "radio",
      name: "menu-choice" + menuCnt,
      value: "baz",
      checked: true,
      disabled: true,
    },
  ]
}

function makeDemo() {
  const components = [
    {
      tag: ".cols.shrink.gap-xxl",
      content: [
        {
          tag: "ui-menu",
          content: makeMenu(true),
        },
        {
          content: {
            tag: "ui-volume.h-full",
            indicator: "both",
            audioNode,
            audioParam,
          },
        },
        // {
        //   tag: "ui-volume",
        //   disabled: true,
        //   audioNode,
        //   audioParam,
        // },
      ],
    },
    {
      tag: "ui-tabs.w-full._grow",
      // side: "bottom",
      current: 1,
      content: [
        {
          label: "Tab 1",
          content: "Tab Content 1",
        },
        {
          label: "Long Tab 2",
          content: {
            tag: ".document.ma-xs.pa.inset.h-full.scroll-xy",
            content: [
              { tag: "h2", content: "Title" },
              `%md Text **strong** [link](#)\n *italic*.\n`,
            ],
          },
        },
        {
          label: "Tab 3",
          disabled: true,
          content: "Tab Content 3",
        },
        {
          label: "Tab 4",
          content: "Tab Content 4",
        },
      ],
    },
  ]

  const controls = (name) => ({
    tag: ".rows.gap",
    content: [
      { tag: "input.focus", value: "Focused input" },
      {
        tag: "textarea.scroll-xy",
        wrap: "off",
        value: name === "disabled" ? "" : lorem2,
        rows: 4,
      },
      {
        tag: "textarea.scroll",
        // wrap: "off",
        value: name === "disabled" ? "" : lorem2,
        rows: 4,
      },
      {
        tag: "textarea.scroll-x",
        wrap: "off",
        value: name === "disabled" ? "" : lorem,
        rows: 1,
      },
      { tag: "select", content: ["Option 1", "Option 2", "Option 3"] },
      { tag: "number", value: 42 },
      { tag: "date" },
      // { tag: "file" },
      // {
      //   tag: "selectmenu",
      //   content: ["Option 1", "Option 2", "Option 3"],
      // },
      { tag: "input", list: "list" },
      { tag: "datalist", id: "list", content: ["a", "b", "c"] },
      {
        tag: "color.w-full",
        value: "#bfa2dd",
      },
      { tag: "range.w-full" },
      { tag: "range.focus.w-full" },
      {
        content: [
          {
            tag: "checkbox",
            label: "Checked",
            value: true,
          },
          {
            tag: "checkbox",
            label: "Unchecked",
            value: false,
          },
          // "---",
          {
            content: [
              {
                tag: "checkbox",
                label: "Indeterminate",
                value: undefined,
              },
              {
                tag: "checkbox.focus",
                label: "Focus",
              },
            ],
          },
          // "---",
          {
            label: "Radio 1",
            tag: "radio",
            name: "choice" + name,
            value: "foo",
          },
          {
            label: "Radio 2",
            tag: "radio",
            name: "choice" + name,
            value: "bar",
            checked: true,
          },
          {
            label: "Focus",
            tag: "radio.focus",
            name: "choice" + name,
            value: "baz",
          },
        ],
      },

      {
        tag: ".grid-3.w-full",
        content: [
          { tag: "ui-knob" }, //
          { tag: "ui-knob.focus", value: 50 }, //
          { tag: "ui-knob", value: 100 }, //
        ],
      },
    ],
  })

  const buttons = () => ({
    tag: ".rows.gap",
    content: [
      {
        // tag: ".cols.gap",
        content: [
          // {
          //   tag: "button",
          //   content: "A",
          // },
          // " ",
          {
            tag: "button",
            picto: "plus",
          },
          " ",
          {
            tag: "button",
            picto: { before: "plus" },
            content: "Btn",
          },
          " ",
          {
            tag: "button",
            picto: { after: "plus" },
            content: "Btn",
          },
          " ",
          {
            tag: "button",
            content: "Btn",
          },
          // " ",
          // {
          //   tag: "button",
          //   picto: { before: "plus", after: "plus" },
          //   content: "Button",
          // },
        ],
      },
      {
        content: [
          {
            tag: "button",
            picto: "places/folder",
          },
          " ",
          {
            tag: "button",
            picto: "places/user-trash",
            content: "Btn",
          },
          " ",
          {
            tag: "button",
            picto: { after: "type/audio" },
            content: "Btn",
          },
        ],
      },
      {
        content: [
          {
            tag: "button.default",
            content: "Default",
          },
          " ",
          {
            tag: "button.focus",
            content: "Focus",
          },
          " ",
          {
            tag: "button",
            aria: { pressed: true },
            content: "Pressed",
          },
          " ",
          {
            tag: "button.active",
            content: "Active",
          },
        ],
      },
    ],
  })

  const outputs = {
    tag: ".rows.gap.shrink",
    content: [
      // "---",

      {
        tag: "div",
        content: [
          {
            tag: "input",
            value: "Input",
          },
          " ",
          {
            tag: "button",
            content: "Ok",
          },
        ],
      },
      {
        tag: "div > progress.w-full",
        value: 0.5,
      },
      {
        tag: "div > meter.w-full",
        value: 0.5,
      },
      // { tag: "div > range.w-full" },
      {
        // tag: "p",
        content: `%md Text **strong** [link](#)\n *italic*.`,
      },
    ],
  }

  return [
    {
      tag: ".grid-3.gap-sm.ma-xs",
      // tag: ".split-3.gap-sm.ma-xs",
      // tag: ".cols.gap.ma",
      content: [
        {
          tag: "fieldset",
          label: "Components",
          content: {
            tag: ".rows.gap.h-full",
            content: [
              components,
              // "---",
              { tag: "hr.ma-false" },
              outputs,
            ],
          },
        },
        {
          content: [
            {
              tag: "fieldset",
              label: "Controls",
              content: controls(),
            },
            {
              tag: "fieldset",
              label: "Buttons",
              content: buttons(),
            },
          ],
        },
        {
          content: [
            {
              tag: "fieldset",
              label: "Controls (disabled)",
              disabled: true,
              content: controls("disabled"),
            },
            {
              tag: "fieldset",
              label: "Buttons (disabled)",
              disabled: true,
              content: buttons(),
            },
          ],
        },
      ],
    },
  ]
}

function makeClasses() {
  const classes = {
    tag: ".rows.gap",
    content: [
      {
        tag: ".grid-2.gap",
        content: [
          ".inset-shallow", //
          ".outset-shallow",
          ".inset",
          ".outset",
        ].map((x) => ({
          tag: `${x}.pa.pa-y-xs`,
          content: x,
        })),
      },
      {
        tag: ".grid-2.gap",
        content: [
          ".message.negative",
          ".message.warning",
          ".message.positive",
          ".message.info",
          // ".pattern-checkerboard",
          // ".pattern-checkerboard-dark",
        ].map((x) => ({
          tag: `${x}.pa.pa-y-xs`,
          content: x,
        })),
      },
      {
        tag: ".grid-2.gap.pa.pattern-checkerboard-dark",
        content: [
          ".desktop", //
          ".ground",
          ".panel",
          ".document",
          ".code",
          ".screen",
        ].map((x) => ({
          tag: `${x}.pa.pa-y-xs`,
          content: x,
        })),
      },
    ],
  }

  return { tag: "fieldset.ma-xs", content: classes }
}

toast(lorem.slice(0, 97), {
  timeout: false,
  animateFrom: false,
})
toast(lorem.slice(0, 97), {
  picto: "warning",
  timeout: false,
  animateFrom: false,
})
toast(lorem.slice(0, 97), {
  label: "System",
  picto: "computer",
  timeout: false,
  animateFrom: false,
})

dialog({
  x: 15,
  y: 350,
  // width: 300,
  label: "Classes",
  // picto: "apps/settings",
  content: makeClasses(),
})

dialog({
  y: 15,
  // width: 300,
  label: "Themes",
  picto: "apps/shutdown",
  content: () => {
    const x = fileIndex.glob("**/*.theme.css")
    const content = [...x]
    // console.log(x)

    return {
      tag: "select",
      content,
    }
  },
})

alert(new Error(lorem.slice(0, 84) + "."), {
  x: 15,
  y: 140,
  on: {
    "once": true,
    "ui:dialog.before-activate"(e) {
      e.preventDefault()
    },
  },
  // decline: "Cancel",
})

dialog({
  y: 100,
  label: lorem,
  picto: "emblems/help",
  content: makeDemo(),
})

// console.log(getComputedStyle(document.body).fontSize)

// os.exec("appearance")

// @ts-ignore
// sys42.showCommandPalette()
