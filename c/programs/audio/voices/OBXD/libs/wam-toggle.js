// WAM Toggle control
// Jari Kleimola 2018 (jari@webaudiomodules.org)

var WAM = WAM || {}
if (!WAM.Toggle) {
  WAM.Toggle = class WamToggle extends HTMLElement {
    constructor() {
      super()
      this._ = { value: 0, states: 2 }
    }

    connectedCallback() {
      let temp = document.querySelector("#wam-toggle-template")
      if (!temp) {
        temp = document.createElement("template")
        temp.id = "wam-toggle-template"
        temp.innerHTML = `
        <div style="overflow:hidden; height:0; user-select:none;">
          <img draggable="false" style="pointer-events:none;">
        </div>`
      }

      const node = temp.content.cloneNode(true)
      const div = node.querySelector("div")
      const img = node.querySelector("img")
      img.onload = function (e) {
        this._.height = img.clientHeight / this._.states
        div.style.height = this._.height + "px"
        if (this.hasAttribute("pos")) {
          const pos = this.getAttribute("pos").split(",")
          if (pos.length === 2) {
            this.style.position = "absolute"
            this.style.left = pos[0] + "px"
            this.style.top = pos[1] + "px"
          }
        }

        if (this.hasAttribute("value")) {
          this._.value = Number.parseFloat(this.getAttribute("value"))
        }

        this.updateToggle()
      }.bind(this)
      if (this.hasAttribute("strip")) {
        img.src = this.getAttribute("strip")
      }

      div.onclick = this.onclick.bind(this)
      this.append(node)
    }

    static get observedAttributes() {
      return ["strip", "states", "value"]
    }

    attributeChangedCallback(name, oldValue, newValue) {
      switch (name) {
        case "strip":
          var img = this.querySelector("img")
          if (img) img.src = newValue
          break
        case "states":
          this._.states = newValue | 0
          break
        case "value":
          this._.value = Number.parseFloat(newValue)
          if (this._.value > 1.1) this._.value = 0
          else if (this._.value > 1) this._.value = 1
          this.updateToggle()
          break
        default:
      }
    }

    get value() {
      return this._.value
    }
    set value(v) {
      this.setAttribute("value", v)
    }

    get states() {
      return this._.states
    }
    set states(v) {
      this.setAttribute("states", v)
    }

    set strip(v) {
      this.setAttribute("strip", v)
    }

    onclick(e) {
      const v = this._.value + 1 / (this._.states - 1)
      this.value = v
      this.fire(true)
      if (this.classList.contains("oneshot")) {
        setTimeout(() => {
          this.value = 0
        }, 200)
      }
    }

    fire(finish) {
      const detail = { id: this.id, value: this.value, final: finish === true }
      const event = new CustomEvent("change", { detail })
      this.dispatchEvent(event)
    }

    updateToggle() {
      const img = this.querySelector("img")
      if (img) {
        const index = Math.round(this._.value * (this._.states - 1))
        img.style.transform = "translateY(-" + index * this._.height + "px)"
      }
    }
  }

  window.customElements.define("wam-toggle", WAM.Toggle)
}
