import {
  empty,
  frag,
  style,
  img,
  div,
  /*  pre,  */ span,
  button,
} from "../../js/html.js"

import Emitter from "../../js/mixin/Emitter.js"

// import news from "./../views/news.js";
// import events from "./../views/events.js";
import demo from "../views/demo.js"
import stick from "../views/stick.js"
const pages = { /* news, events, */ demo, stick }

const EXPIRE = 1000 * 60 // one minute

export default class App extends Emitter {
  constructor() {
    super()
    this.data = {}
    this.loading = document.querySelector(".loading")
    if (this.loading) this.loading.remove()
    else
      this.loading = div({ class: "loading" }, [span(), span(), span(), span()])

    this.views = {}

    this.images = {
      // stunfest_head: img("./assets/sprites/ui/stunfest_head.png"),
      mysterious: "./assets/sprites/ui/mysterious.png",
    }

    this.el = div({ class: "app" }, [
      (this.style = style()),
      div({ class: "gradient" }),
      (this.pages = div({ class: "pages img-gifs" }, [
        // (this.views.news = div({ class: "page news" })),
        // (this.views.events = div({ class: "page events" })),
        // (this.views.demo = div({ class: "page demo" })),
        (this.views.stick = div({ class: "page stick" })),
      ])),
      div({ id: "nav" }, [
        // button(img("./assets/images/icons/news.png"), {
        //   class: "news",
        //   onclick: () => this.go("news"),
        // }),
        // button(img("./assets/images/icons/events.png"), {
        //   class: "events",
        //   onclick: () => this.go("events"),
        // }),
        // button(img("./assets/images/icons/train.png"), {
        //   class: "demo",
        //   onclick: () => this.go("demo"),
        // }),
        // button(img("./assets/images/icons/stick.png"), {
        button("MENU", {
          class: "stick",
          onclick: () => this.go("stick"),
        }),
      ]),
    ])

    // if (window.dev) {
    //   this.logel = div({ class: "logel" });
    //   this.el.appendChild(this.logel);
    // }
  }

  log(...texts) {
    if (window.dev > 2) {
      console.log(...texts)
      // this.logel.insertBefore(pre(texts.map(String).join(" ")), this.logel.firstChild);
    }
  }

  fetch() {
    if (this.feeds && Date.now() - this.expire < EXPIRE) return this.feeds

    return new Promise((resolve) => {
      const request = new window.XMLHttpRequest()
      request.open("GET", "http://sys42.net/derp/api.php", true)
      request.onload = () => {
        if (request.status >= 200 && request.status < 400) {
          this.feeds = JSON.parse(request.responseText)
          this.expire = Date.now()
        } else {
          this.feedError = request.status
        }
        resolve()
      }

      request.onerror = (err) => {
        this.feedError = String(err)
        resolve()
      }

      request.send()
    })

    // this.api = "http://sys42.net/derp/api.php";
    // try {
    //   const res = await fetch(this.api);
    //   this.feedError = await res.text();
    //   // this.feeds = await res.json();
    //   // this.expire = Date.now();
    //   // return this.feeds;
    // } catch (err) {
    //   this.feedError = String(err);
    // }
  }

  async go(route, ...args) {
    this.emit("change", route)
    window.clearTimeout(this.timerId)
    this.route = route
    if (route !== "stick") {
      game.scene.start("Blanck")
      // $.go(game, "Blanck");
    }
    this.el.className = `app ${route}`
    // document.body.appendChild(this.loading);
    if (route === "stick" && window.board) {
      board.close()
    } else {
      empty(this.views[route])
    }
    // this.timerId = window.setTimeout(async () => {
    Object.keys(this.views).forEach((key) => {
      if (key !== this.route) empty(this.views[key])
    })
    const res = await pages[route](...args)
    // document.body.removeChild(this.loading);
    if (route === "stick") empty(this.views[route])
    this.views[route].appendChild(frag(res))
    // }, 500);
  }
}
