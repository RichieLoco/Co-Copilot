# Security Policy

## Supported Versions

Only the latest release of Co-Copilot receives security updates. Please update to the latest version before reporting issues.

## Reporting a Vulnerability

If you discover a security vulnerability, **please do not open a public issue**. Instead, email the maintainer directly:

**security@[YOUR_DOMAIN]** (replace with your contact)

Please include:

- A description of the vulnerability
- Steps to reproduce
- The potential impact
- Any suggested fixes

You should receive a response within 72 hours. If you don't, please follow up.

## Scope

In scope:

- The Co-Copilot Express proxy server (`server.js`)
- The React front-end (`src/App.jsx`, `src/main.jsx`)
- Build and deployment configurations (`Dockerfile`, `docker-compose.yml`, `vite.config.js`)

Out of scope:

- Vulnerabilities in GitHub's API itself — please report those to [GitHub Security](https://github.com/security)
- Issues requiring physical access to a user's device
- Social engineering attacks

## Token Handling

Co-Copilot stores your GitHub Personal Access Token in your browser's `localStorage`. It is sent through the Express proxy in the `Authorization` header on each API request but **is never logged, stored server-side, or transmitted to any third party**.

If you believe your token has been exposed (via a Co-Copilot bug, not your own misconfiguration), revoke it immediately at https://github.com/settings/personal-access-tokens and then report the issue.

## Best Practices for Operators

- **Keep Node.js and dependencies up to date** — run `npm audit` periodically
- **Put Co-Copilot behind a reverse proxy with HTTPS** — do not expose it to the open internet over plain HTTP
- **Use a short token expiration** (30–90 days) and rotate regularly
- **Restrict your PAT to only the permissions it needs**: `Models: Read` and optionally `Plan: Read`
- **Do not share your deployment** with untrusted users — each user should run their own instance with their own token
