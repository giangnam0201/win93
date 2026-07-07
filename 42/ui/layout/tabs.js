import { configure } from "../../api/configure.js"
import { Component } from "../../api/gui/Component.js"
import { toPlanObject } from "../../api/gui/render.js"
import { isPromiseLike } from "../../lib/type/any/isPromiseLike.js"
import { on } from "../../lib/event/on.js"
import { dispatch } from "../../lib/event/dispatch.js"

export class TabsComponent extends Component {
  static plan = {
    tag: "ui-tabs",
    id: true,
    on: { contextmenu: false },
  }

  closable = false

  #content
  get content() {
    return this.#content
  }
  set content(content) {
    this.#content = content
  }

  #displayPicto
  get displayPicto() {
    return this.#displayPicto
  }
  set displayPicto(displayPicto) {
    this.#displayPicto = displayPicto
  }

  current

  async render() {
    let items = this.content

    if (typeof items === "function") {
      items = await items(this)
    } else if (isPromiseLike(items)) {
      items = await items
    }

    if (!Array.isArray(items) || items.length === 0) items = []

    const { id } = this

    const tablist = []
    const panels = []

    if (this.current === undefined) {
      this.current = 0
      for (let i = 0, l = items.length; i < l; i++) {
        if (items[i].selected) this.current = i
      }
    }

    for (let i = 0, l = items.length; i < l; i++) {
      const item = items[i]

      const {
        label, //
        content,
        closable,
        selected,
        ...rest
      } = item

      const labelPlan = toPlanObject(label)
      labelPlan.content = { tag: "span", content: labelPlan.content }

      tablist.push({
        tag: ".ui-tabs__tab",
        role: "tab",
        id: `${id}-tab-${i}`,
        style: { "--index": i },
        dataset: { index: i },
        tabIndex: 0,
        aria: {
          selected: this.current === i,
          controls: `${id}-panel-${i}`,
        },
        content: {
          tag: "span.ui-tabs__label",
          content: [
            configure({ tag: "span.ui-tabs__trigger", ...rest }, labelPlan),
            (closable ?? this.closable) && {
              tag: "button.clear.ui-tabs__close",
              picto: "close",
            },
          ],
        },
      })

      panels.push({
        tag: ".ui-tabs__panel",
        role: "tabpanel",
        id: `${id}-panel-${i}`,
        class: { hide: this.current !== i },
        aria: { labelledby: `${id}-tab-${i}` },
        content,
      })
    }

    return [
      {
        tag: ".ui-tabs__tablist",
        role: "tablist",
        content:
          tablist.length > 0
            ? tablist
            : {
                tag: ".ui-tabs__tab.ui-tabs__tab--empty",
                content: "<empty tabs>",
              },
      },
      {
        tag: ".ui-tabs__panels",
        content: panels,
      },
    ]
  }

  created() {
    on(
      this,
      { signal: this.signal },
      {
        stop: true,
        selector: ".ui-tabs__close",
        pointerdown: (e, target) =>
          this.removePanel(target.parentElement.parentElement.dataset.index),
      },
      {
        "selector": ".ui-tabs__tab",
        "pointerdown || Space || Enter": (e, target) => {
          this.selectPanel(target.dataset.index)
        },
      },
    )
  }

  removePanel(idx) {
    idx = Number(idx)
    const { id } = this

    const tabPanelPairs = /** @type {NodeListOf<HTMLElement>} */ (
      this.querySelectorAll(
        `:scope > .ui-tabs__tablist > .ui-tabs__tab,
         :scope > .ui-tabs__panels > .ui-tabs__panel`,
      )
    )

    const l = tabPanelPairs.length / 2

    let nextPanelIdx

    for (let i = 0; i < l; i++) {
      const tab = tabPanelPairs[i]
      const panel = tabPanelPairs[i + l]
      if (i === idx) {
        if (tab.ariaSelected === "true") {
          nextPanelIdx = tab.nextElementSibling ? idx : idx - 1
        }

        tab.remove()
        panel.remove()
        continue
      }

      if (i > idx) {
        const index = String(i - 1)
        tab.id = `${id}-tab-${index}`
        tab.dataset.index = index
        tab.style.setProperty("--index", index)
        panel.id = `${id}-panel-${index}`
      }
    }

    // console.log(nextPanelIdx)

    if (nextPanelIdx !== undefined) this.selectPanel(nextPanelIdx)
  }

  selectPanel(idx) {
    idx = Number(idx)

    if (
      idx < 0 ||
      idx >= this.firstElementChild.children.length ||
      this.current === idx
    ) {
      return
    }

    this.current = idx

    const tabPanelPairs = this.querySelectorAll(
      `:scope > .ui-tabs__tablist > .ui-tabs__tab,
       :scope > .ui-tabs__panels > .ui-tabs__panel`,
    )

    const l = tabPanelPairs.length / 2

    for (let i = 0; i < l; i++) {
      const tab = tabPanelPairs[i]
      const panel = tabPanelPairs[i + l]
      tab.ariaSelected = i === idx ? "true" : "false"
      panel.classList.toggle("hide", i !== idx)
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        dispatch(this, "ui:tab-change", { detail: { index: idx } })
      })
    })
  }
}

export const tabs = Component.define(TabsComponent)
