# mutisia-web

The website for Mutisia Studio (mutisiastudio.com). It has the page for
Pomoluna, an Android focus-timer app, in English (`/`) and Spanish (`/es/`),
plus a privacy policy in each language.

It is plain HTML, CSS and a little JavaScript. There is no build step,
no framework and nothing is loaded from other websites.

## View it on your computer

From this folder, start a tiny web server:

```
python3 -m http.server 8123
```

Then open http://localhost:8123/ in your browser. Stop it with Ctrl+C.

## Run the checks

The checks are a script that makes sure the pages exist, link to each
other, and load nothing from outside. It needs only Node.js:

```
node tools/check.mjs
```

It prints `OK` when everything passes. Otherwise it lists what failed.

## Layout

- `index.html`, `es/index.html`: the home pages
- `privacy/`, `es/privacidad/`: the privacy policies
- `assets/`: styles, scripts, the font and the icon
- `CNAME`: the domain name used by the hosting
