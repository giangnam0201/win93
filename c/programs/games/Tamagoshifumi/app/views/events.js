import { frag, parse, div, pre /* , header, img */ } from "../../js/html.js"

export default async () => {
  // const { images } = app;

  await app.fetch()

  const el = div(
    { class: "scroll", id: "sched-content" },
    // header(img(images.stunfest_head))
  )

  if (app.feeds && app.feeds.closed !== true) {
    const sched = parse(app.feeds.sched)

    const login = sched.querySelector("#sched-menu-login")
    if (login) login.remove()
    ;[...sched.querySelectorAll("a[href]")].forEach((el) => {
      el.href = `https://stunfest2018.sched.com${el.getAttribute("href")}`
    })
    ;[...sched.querySelectorAll("style")].forEach((el) => {
      if (el.textContent.includes(".ev_")) document.body.appendChild(el)
    })

    el.appendChild(sched.querySelector("#sched-content-inner").cloneNode(true))
  } else if (app.feeds && app.feeds.closed === true) {
    el.id = ""
    const childs = parse(app.feeds[player.lang]).body.childNodes
    el.appendChild(div({ class: "unavailable" }, frag(...childs)))
  } else {
    el.id = ""
    el.appendChild(
      div(
        { class: "unavailable error" },
        div("Schedule unavailable for now..."),
        app.feedError && pre(app.feedError),
      ),
    )
  }

  return el
}
