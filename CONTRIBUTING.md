# Contributing to Co-Copilot

Thanks for your interest in contributing! This document explains how to get set up and what we look for in contributions.

## Getting started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/RichieLoco/co-copilot.git
   cd co-copilot
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Create a branch** for your change:
   ```bash
   git checkout -b feat/my-feature
   ```
5. **Run the dev server**:
   ```bash
   npm run dev
   ```
6. **Make your changes**, commit them, and push to your fork
7. **Open a pull request** against the `main` branch of the upstream repo

## What we're looking for

Co-Copilot aims to stay **small, fast, and self-contained**. We prefer:

- **Zero-dependency solutions** where possible. If you need a library, make the case for it.
- **Single-file components** that are easy to reason about.
- **Dark-theme-first visual design** — light mode is a future enhancement, not a prerequisite.
- **No telemetry, no analytics, no phone-home code**. Ever.

Changes that broaden hardware/OS support (Pi Zero, older NAS models, ARM32) are especially welcome.

## Code style

- **Formatting**: we don't enforce Prettier or ESLint configs yet. Just match the surrounding code.
- **JavaScript**: modern ES modules, React function components with hooks, no class components.
- **Naming**: camelCase for variables and functions, PascalCase for components, SCREAMING_SNAKE_CASE for constants.
- **Comments**: explain *why*, not *what*. The code should already show what it does.

## Commit messages

Conventional Commits are preferred but not required:

```
feat: add export-to-markdown feature
fix: correct premium request parsing for multi-model responses
docs: clarify Raspberry Pi deployment steps
refactor: extract proxy logic into separate module
chore: bump vite to 6.1
```

## Pull request checklist

- [ ] Tested locally against a real Copilot Pro/Pro+ token
- [ ] No new runtime dependencies (unless justified in the PR description)
- [ ] Updated relevant docs (README, DEPLOYMENT.md, etc.)
- [ ] No token, secret, or personal info included in commits
- [ ] Build passes: `npm run build`

## Reporting bugs

Please [open an issue](https://github.com/RichieLoco/co-copilot/issues/new?template=bug_report.md) with:

- What you expected to happen
- What actually happened
- Steps to reproduce
- Your environment (OS, Node version, browser, deployment method)
- Any relevant console output (**scrub your token first!**)

## Suggesting features

[Open a feature request](https://github.com/RichieLoco/co-copilot/issues/new?template=feature_request.md) or start a [discussion](https://github.com/RichieLoco/co-copilot/discussions) if you want to chat through the idea first.

## Security issues

See [SECURITY.md](SECURITY.md). **Do not** open a public issue for security vulnerabilities — email the maintainers directly.

## Code of Conduct

Be kind, be constructive, assume good faith. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for the full text.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
