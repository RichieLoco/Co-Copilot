# Screenshots

The README uses SVG mockups that ship with the repo so nothing appears broken on first push. Replace them with real PNG screenshots once you have a running deployment for a more authentic look.

## Current files (SVG mockups)

| File | Shows |
|------|-------|
| `screenshot-main.svg` | Full interface with sidebar, chat, code block, model picker |
| `screenshot-models.svg` | Model picker dropdown grouped by provider |
| `screenshot-usage.svg` | Sidebar usage widget expanded with per-model breakdown |
| `screenshot-code.svg` | Syntax-highlighted code block with copy button |
| `screenshot-projects.svg` | Sidebar with multiple projects and conversations |

## Replacing with real screenshots

1. Deploy Co-Copilot and populate it with real content
2. Take PNG screenshots at 2x resolution
3. Drop them in this folder as `screenshot-main.png`, etc.
4. Update `README.md` to change `.svg` → `.png` in the image references
5. Optionally delete the `.svg` files

### Optimising PNGs

```bash
# Reduce file size without visible quality loss:
pngquant --quality 70-90 --ext .png --force screenshot-*.png
optipng -o7 screenshot-*.png
```

Target: under 300KB each.
