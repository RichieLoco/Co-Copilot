# Screenshots

The README expects the following screenshot files in this folder. Replace these with actual PNG screenshots before publishing.

## Expected filenames

| Filename | Dimensions | What it should show |
|----------|-----------|---------------------|
| `screenshot-main.png` | 1920×1200 (or 2× retina) | The full interface with a conversation in progress — sidebar visible, usage widget populated, model picker visible in header, streaming response in middle, code block with syntax highlighting |
| `screenshot-models.png` | ~800×700 | The model picker dropdown open, showing multiple providers with their models grouped |
| `screenshot-usage.png` | ~800×500 | The sidebar usage widget expanded, showing premium request count, cost, and per-model breakdown |
| `screenshot-code.png` | ~1000×600 | A code block in a chat response, showing syntax highlighting and the Copy button |
| `screenshot-projects.png` | ~800×700 | The sidebar with multiple projects, each containing multiple conversations |

## How to take good screenshots

1. **Use a large window** — at least 1600px wide so the sidebar + chat + model picker all fit
2. **Real content** — use actual conversations, not Lorem Ipsum. Ask the model about something real.
3. **Populated state** — have multiple projects, a few conversations each, and some premium requests logged
4. **Retina/2× resolution** — take them on a high-DPI display or scale up afterwards
5. **Consistent theme** — all screenshots should use the same dark theme (the default)
6. **Clean browser chrome** — use Firefox's "Take Screenshot" feature or Chrome's DevTools to capture just the app area, no tabs or URL bar
7. **No personal info** — blur or fake your username, don't expose real tokens, project names, or conversation content

## Optimising for README file size

PNG screenshots at 2× resolution can be 500KB–2MB each. Before committing:

```bash
# Install optipng and jpegoptim
sudo apt install optipng pngquant

# Reduce to ~8-bit palette (still looks great):
pngquant --quality 70-90 --ext .png --force screenshot-*.png

# Further compress without quality loss:
optipng -o7 screenshot-*.png
```

Target file size: < 300KB each.

## Alternative: animated demo

Consider replacing the main screenshot with a GIF or MP4 of the app in action:

- **Terminalizer** or **asciinema + svg-term** for terminal demos
- **LICEcap** or **Peek** for GIF screen recordings (Linux/Windows)
- **Kap** for MP4 (macOS)

Keep GIFs under 3MB for fast README loading.
