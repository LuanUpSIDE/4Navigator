---
type: project
created: 2026-07-18
updated: 2026-07-18
---

# Technical Decisions

- Component metadata uses SemVer while the toolkit release keeps CalVer.
- `manifest.json` and `manifest.lock.json` must remain synchronized with component frontmatter.
- [4Navigator] Stack: Electron Desktop com Chromium WebViews/BrowserViews, grid 2x2 para 4 abas simultâneas, throttling de background desligado (`disableBackgroundThrottling: true`) e controles individuais por painel.

