//! Copyright 2021 Dustin Hagemeier <dustin@commit.international>. MIT License.
// @src https://github.com/commit-intl/micro-down

/*
 * tag helper
 */
const tag = (tag, text, values) =>
  `<${
    tag +
    (values
      ? " " +
        Object.keys(values)
          .map((k) => (values[k] ? `${k}="${encode(values[k]) || ""}"` : ""))
          .join(" ")
      : "")
  }>${text}</${tag}>`
/**
 * Outdent all rows by first as reference.
 */
const outdent = (text) =>
  text.replaceAll(new RegExp("^" + (text.match(/^\s+/) || "")[0], "gm"), "")

/**
 * Encode double quotes and HTML tags to entities.
 */
const encode = (text) =>
  text
    ? text
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
    : ""

/**
 * Recursive list parser.
 */
const listR = /(?:(^|\n)([+-]|\d+\.) +(.*(\n[\t ]+.*)*))+/g
const list = (text, temp) => {
  temp = text.match(/^[+-]/m) ? "ul" : "ol"
  return text
    ? `<${temp}>${text.replaceAll(/(?:[+-]|\d+\.) +(.*)\n?(([\t ].*\n?)*)/g, (match, a, b) => `<li>${inlineBlock(`${a}\n${outdent(b || "").replaceAll(listR, list)}`)}</li>`)}</${temp}>`
    : ""
}

/**
 * Function chain of replacements.
 */
const chain = (t, regex, replacement, parser) => (match) => {
  match = match.replace(regex, replacement)
  return tag(t, parser ? parser(match) : match)
}

const block = (text, options) =>
  p(
    text,
    [
      // BLOCK STUFF ===============================

      // comments
      /<!--((.|\n)*?)-->/g,
      "<!--$1-->",

      // pre format block
      /^("""|```)(.*)\n((.*\n)*?)\1/gm,
      (match, wrapper, c, text) =>
        wrapper === '"""'
          ? tag("div", parse(text, options), { class: c })
          : options && options.preCode
            ? tag("pre", tag("code", encode(text), { class: c }))
            : tag("pre", encode(text), { class: c }),

      // blockquotes
      /(^>.*\n?)+/gm,
      chain("blockquote", /^> ?(.*)$/gm, "$1", inline),

      // tables
      /((^|\n)\|.+)+/g,
      chain("table", /^.*(\n\|\s*---.*?)?$/gm, (match, subline) =>
        chain("tr", /\|(-?)([^|]*)\1(\|$)?/gm, (match, type, text) =>
          tag(type || subline ? "th" : "td", inlineBlock(text)),
        )(match.slice(0, match.length - (subline || "").length)),
      ),

      // lists
      listR,
      list,
      // anchor
      /#\[([^\]]+?)]/g,
      '<a name="$1"></a>',

      // headlines
      /^(#+) +(.*)$/gm,
      (match, h, text) => tag("h" + h.length, inlineBlock(text)),

      // horizontal rule
      /^(===+|---+)(?=\s*$)/gm,
      "<hr>",
    ],
    parse,
    options,
  )

const inlineBlock = (text, dontInline) => {
  const temp = []
  const injectInlineBlock = (text) =>
    text.replaceAll(/\\(\d+)/g, (_, code) =>
      injectInlineBlock(temp[Number(code) - 1]),
    )

  text = (text || "")
    // inline code block
    .replaceAll(
      /`([^`]*)`/g,
      (match, text) => "\\" + temp.push(tag("code", encode(text))),
    )
    // inline media (a / img / iframe)
    .replaceAll(
      /[!&]?\[([!&]?\[.*?\)|[^\]]*?)]\((.*?)( .*?)?\)|(\w+:\/\/[\w!$'()*+,./~-]+)/g,
      (match, text, href, title, link) => {
        if (link) {
          return dontInline
            ? match
            : "\\" + temp.push(tag("a", link, { href: link, target: "_blank" }))
        }

        if (match[0] === "&") {
          text = text.match(/^(.+),(.+),([^ \]]+)( ?.+?)?$/)
          return (
            "\\" +
            temp.push(
              tag("iframe", "", {
                width: text[1],
                height: text[2],
                frameborder: text[3],
                class: text[4],
                src: href,
                title,
              }),
            )
          )
        }

        return (
          "\\" +
          temp.push(
            match[0] === "!"
              ? tag("img", "", { src: href, alt: text, title, crossorigin: "anonymous", loading: "lazy", style: "max-width:100%;" })
              : tag("a", inlineBlock(text, 1), {
                  href,
                  title,
                  target: "_blank",
                }),
          )
        )
      },
    )

  text = injectInlineBlock(dontInline ? text : inline(text))
  return text
}

const inline = (text) =>
  p(
    text,
    [
      // bold, italic, bold & italic
      /([*_]{1,3})((.|\n)+?)\1/g,
      (match, k, text) => {
        k = k.length
        text = inline(text)
        if (k > 1) text = tag("strong", text)
        if (k % 2) text = tag("em", text)
        return text
      },

      // strike through
      /(~{1,3})((.|\n)+?)\1/g,
      (match, k, text) =>
        tag([undefined, "u", "s", "del"][k.length], inline(text)),

      // replace remaining newlines with a <br>
      / {2}\n|\n {2}/g,
      "<br>",
    ],
    inline,
  )

const p = (text, rules, parse, options) => {
  let i = 0
  let f
  while (i < rules.length) {
    if ((f = rules[i++].exec(text))) {
      return (
        parse(text.slice(0, f.index), options) +
        (typeof rules[i] === "string"
          ? rules[i].replaceAll(/\$(\d)/g, (m, d) => f[d])
          : rules[i].apply(this, f)) +
        parse(text.slice(f.index + f[0].length), options)
      )
    }

    i++
  }

  return text
}

const parse = (text, options) => {
  // clean input
  text = text
    .replaceAll(/[\b\v\f\r]/g, "")
    .replaceAll(/\\./g, (match) => `&#${match.charCodeAt(1)};`)

  let temp = block(text, options)

  if (temp === text && !temp.match(/^\s*$/i)) {
    temp = inlineBlock(temp)
      // handle paragraphs
      .replaceAll(/((.|\n)+?)(\n\n+|$)/g, (match, text) =>
        tag("p", text.trim()),
      )
  }

  return temp.replaceAll(/&#(\d+);/g, (match, code) =>
    String.fromCharCode(Number(code)),
  )
}

export const Markdown = {
  compile: parse,
  parse,
  block,
  inline,
  inlineBlock,
}
