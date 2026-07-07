const parser = new DOMParser();

export const xml = url =>
  fetch(url)
    .then(res => res.text())
    .then(res => parser.parseFromString(res, "text/xml"));

export const html = url =>
  fetch(url)
    .then(res => res.text())
    .then(res => parser.parseFromString(res, "text/html"));

export const image = url => {
  if (url instanceof HTMLImageElement) {
    if (url.complete) return Promise.resolve(url);
    return new Promise((resolve, reject) => {
      url.onload = () => resolve(url);
      url.onerror = reject;
    });
  }
  return new Promise((resolve, reject) => {
    const asset = new Image();
    asset.onload = () => resolve(asset);
    asset.onerror = reject;
    asset.src = url;
  });
};

export const font = document.fonts
  ? url => document.fonts.load(url)
  : () => new Promise(resolve => window.setTimeout(resolve, 100));
