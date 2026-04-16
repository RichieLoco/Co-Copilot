# Architecture

A quick tour of how Co-Copilot is put together. Useful reading before submitting a PR, or if you want to understand the trade-offs made.

## High-level flow

```
┌──────────────┐       ┌─────────────────────────┐       ┌──────────────────────┐
│   Browser    │       │   Co-Copilot server     │       │       GitHub         │
│              │       │   (port 3000)           │       │                      │
│  React SPA   │──────▶│                         │──────▶│  models.github.ai    │
│              │  HTTP │  ┌───────────────────┐  │ HTTPS │  (catalog + chat)    │
│ localStorage │       │  │ Static /dist      │  │       │                      │
│              │◀──────│  │ Proxy /api/*      │  │◀──────│  api.github.com      │
└──────────────┘       │  └───────────────────┘  │       │  (user + billing)    │
                       │                         │       │                      │
                       │  Node.js + Express      │       └──────────────────────┘
                       └─────────────────────────┘
```

Three moving parts:

1. **React SPA** in the browser — handles all UI, state, and storage
2. **Express proxy** on your server — forwards API calls to GitHub, serves static files
3. **GitHub's APIs** — the actual inference and billing data

## Why a proxy?

GitHub's `models.github.ai` endpoint does not return CORS headers. That means a browser running on any origin other than `github.com` cannot call it directly — the browser blocks the response before JavaScript ever sees it.

A thin server-side proxy solves this because servers don't enforce CORS. The Express proxy:

- Receives `fetch()` calls from the browser at `/api/models/*` or `/api/gh/*`
- Strips the `Host` header and a couple of others
- Forwards everything else (including the `Authorization: Bearer <PAT>` header) to the real GitHub endpoint
- Streams the response body back to the browser unchanged

The proxy has no state, no logging of tokens, and no persistence. It's 100 lines of code in `server.js`.

## Why not a native desktop app?

Browser-based has some real advantages:

- **Zero install friction** — any device on your network can use it
- **Works everywhere** — phone, tablet, laptop, TV browser
- **No platform-specific builds** — one codebase, one Docker image
- **Familiar mental model** — it's just a webpage

The browser's `localStorage` gives you persistence without needing a database, and modern browsers have excellent support for streaming fetches (SSE).

## Storage model

Everything lives in **browser `localStorage`**:

| Key | Contents |
|-----|----------|
| `cc-settings` | Token, username, system prompt, temperature, max tokens, selected model |
| `cc-projects` | Array of project objects `[{id, name, createdAt, updatedAt}]` |
| `cc-cv:{projectId}` | Array of conversation metadata for that project |
| `cc-m:{conversationId}` | Array of messages in that conversation |

This is deliberately per-browser — your phone and your laptop each maintain their own chat history, and there's no sync between them. If you want sync, put Co-Copilot behind a domain and use your browser's built-in profile sync.

### Why not a database?

A database would mean a stateful backend, which means:
- Volume mounts in Docker
- Backup strategy for users
- Migration schema between versions
- Multi-user access control
- Encryption at rest for conversation content

None of that is necessary for a single-user chat client. If Co-Copilot ever grows multi-user support, a database becomes worth it — but not before.

## State management

Zero state libraries. Just `useState`, `useEffect`, `useMemo`, `useCallback`, and `useRef`.

The entire app is a single React component in `src/App.jsx` (~400 lines of logic, ~500 lines of inline styles). This is intentional:

- Easier to read end-to-end
- No prop drilling or context setup
- No component-communication bugs
- Trivial to understand for anyone familiar with React

If that file gets much bigger, we can split it — but splitting too early creates more files to navigate without reducing complexity.

## Streaming chat

When you send a message, the flow is:

1. Browser builds a `fetch()` POST to `/api/models/inference/chat/completions` with `stream: true`
2. Express proxy forwards to `https://models.github.ai/inference/chat/completions`
3. GitHub returns a `text/event-stream` response
4. Proxy pipes the stream back to the browser without buffering
5. Browser reads `data: {...}` lines, parses the JSON, extracts `choices[0].delta.content`
6. Each token is appended to the last assistant message in React state

The `flush_interval -1` in Caddy and `proxy_buffering off` in nginx are critical — they prevent reverse proxies from holding the stream in memory and dumping it all at once.

## Markdown rendering

Co-Copilot has its own tiny markdown parser (~40 lines in `App.jsx`). It handles:

- Fenced code blocks with language tags
- Headings (h1–h3)
- Ordered/unordered lists (single level)
- Inline `code`, `**bold**`, `*italic*`, `[links](url)`

It does **not** handle:

- Tables
- Nested lists
- Images (output; input images are supported via upload)
- HTML passthrough
- Footnotes, task lists, etc.

If you need a full CommonMark/GFM implementation, swap in `marked` or `markdown-it`. But 90% of LLM output fits within the subset above, and the bundled parser keeps the dependency count at zero.

## Syntax highlighting

Also homegrown, ~15 lines. It handles:

- Line comments (`//`, `#`)
- Block comments (`/* */`)
- Strings (`"`, `'`, `` ` ``)
- Numbers
- A hard-coded list of common keywords across JS/TS/Python/Rust/C-family

It's not nearly as sophisticated as Prism or Shiki, but it's fast, tiny, and covers the languages people most commonly ask LLMs about.

## Model discovery

On page load (after a valid token is saved), two fetches fire in parallel:

```js
fetch('/api/models/catalog/models')  // live catalog from GitHub
fetch('/api/gh/user')                // to get your username
```

If the catalog call fails, we fall back to a curated hard-coded list so the UI is still usable. When the user actually sends a message with a fallback model, the real API will either accept it (your plan includes that model) or reject with a clear error (it doesn't).

## Usage tracking

When a token + username is available, we hit:

```
GET /api/gh/users/{username}/settings/billing/premium_request/usage
```

The response has a `usageItems` array with per-model quantity and cost. We sum these for the headline numbers and show each line in an expandable detail view.

This endpoint returns nothing if your Copilot license is billed through an org — that's a documented GitHub limitation, not a Co-Copilot bug.

## Security posture

- **Token storage**: `localStorage` only. No cookies (would be sent to the server and logged in access logs), no sessionStorage (wiped on tab close, annoying UX).
- **Token transmission**: Bearer token in `Authorization` header, HTTPS once it leaves the proxy. You should front Co-Copilot with HTTPS between browser and proxy too.
- **Server-side handling**: The proxy forwards the header and never reads it, logs it, or stores it.
- **Dependencies**: 5 total at runtime (React, ReactDOM, Express, compression, node-fetch — and node-fetch is only for older Node versions). Small attack surface.
- **No outbound network calls** other than to `*.github.*`. The server doesn't phone home, doesn't fetch updates, doesn't send telemetry.

## Performance characteristics

Measured on a Raspberry Pi 4 (2GB):

| Metric | Value |
|--------|-------|
| Cold start | ~2.5s |
| RAM (idle) | 38 MB |
| RAM (active chat) | 75 MB |
| CPU (idle) | <1% |
| CPU (streaming) | ~5% (single core) |
| First paint | ~300ms |

The heavy lifting happens entirely on GitHub's servers. Your host just forwards bytes.

## Dependencies

Runtime:
- `react` — UI
- `react-dom` — obviously
- `express` — proxy + static server
- `compression` — gzip for the SPA bundle

Dev:
- `vite` — dev server with proxy + production bundler
- `@vitejs/plugin-react` — JSX transform

Total bundle size: ~150KB gzipped (React is the bulk).

## File layout

```
co-copilot/
├── src/
│   ├── main.jsx           # 4 lines: React bootstrap
│   └── App.jsx            # ~1000 lines: the entire UI
├── server.js              # ~100 lines: Express proxy
├── index.html             # 20 lines: SPA shell
├── vite.config.js         # Vite config with dev proxy
├── package.json
├── Dockerfile             # Multi-stage build
└── docker-compose.yml
```

## Extending Co-Copilot

Things that would be reasonable enhancements:

- **Export chats** to markdown/JSON (serialize `msgs` array, done)
- **Search across chats** (filter over localStorage content — no backend needed)
- **Keyboard shortcuts** (add a `useEffect` with `addEventListener('keydown', ...)`)
- **Per-project system prompts** (add a field to the project object)
- **Light mode** (extract CSS vars, add a toggle, persist preference)

Things that would probably require architectural changes:

- **Multi-user** (need auth, database, isolation — a much bigger project)
- **Sync across devices** (need a backend, auth, conflict resolution)
- **Shared conversations with URLs** (need persistent server-side storage)
- **Plugins/extensions** (need a plugin API, security sandbox)

If you're thinking about a major architectural addition, please open a discussion first so we can align on the approach.
