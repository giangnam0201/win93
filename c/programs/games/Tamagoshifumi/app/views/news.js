import {
  frag,
  parse,
  button,
  div,
  pre /*, img  , header, img */,
} from "../../js/html.js"

export default async () => {
  // const { images } = app;

  await app.fetch()

  const l = player.lang === "fr" ? "en" : "fr"

  const el = div(
    { class: "scroll" },
    // header(img(images.stunfest_head)),

    button({ class: `lang ${l}` }, l, () => {
      player.lang = l
      app.go("news")
    }),
  )

  if (app.feeds && app.feeds.closed !== true) {
    const news = parse(app.feeds[player.lang])

    // news.querySelector(".post-item").appendChild(img("http://nope"));

    ;[...news.querySelectorAll("img")].forEach((img) => {
      // img.onerror = e => {
      //   console.log(e);
      //   console.log("img onerror", img.src);
      // };
      img.srcset = ""
      // img.onload = () => {
      //   img.onload = null;
      //   console.log("img load", img.src);
      //   setTimeout(() => {
      //     const { src } = img;
      //     img.src = "./assets/images/blanck.png";
      //     setTimeout(() => {
      //       // img.src = src + "?v=" + new Date().getTime();
      //     }, 500);
      //   }, 500);
      // };
    })

    el.appendChild(frag(...news.querySelectorAll(".post-item")))
  } else if (app.feeds && app.feeds.closed === true) {
    const childs = parse(app.feeds[player.lang]).body.childNodes
    el.appendChild(div({ class: "unavailable" }, frag(...childs)))
  } else {
    el.appendChild(
      div(
        { class: "unavailable error" },
        div("News unavailable for now..."),
        app.feedError && pre(app.feedError),
      ),
    )
  }

  return el
}
