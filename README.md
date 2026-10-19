# Knowing the How

Small, interactive pages that explain how everyday things work.

| Topic | Page |
| --- | --- |
| Why does the Moon change shape? | [`moon-phases/`](moon-phases/) |

## Layout

```
index.html        landing page listing every topic
assets/           shared styles and helpers (style.css, moon.js)
<topic>/          one folder per explainer, self-contained HTML/CSS/JS
```

No build step: every page is plain HTML, CSS and JavaScript.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Publish

GitHub → Settings → Pages → Source: "Deploy from a branch", branch `main`, folder `/ (root)`.
The site will be at `https://yuxiaojian.github.io/knowing-the-how/`.
