# Publishing Co-Copilot to GitHub

This is a one-time guide for when you're ready to open-source the project. Follow these steps in order.

## Step 1 — Personalise the repo

Before pushing, swap out the placeholders I left throughout the files:

```bash
# From the project root:
cd co-copilot

# Replace RichieLoco with your actual GitHub username across all files:
grep -rl "RichieLoco" . --exclude-dir=node_modules --exclude-dir=.git | \
  xargs sed -i.bak "s/RichieLoco/your-github-username/g"

# Replace [YOUR NAME] in LICENSE:
sed -i.bak "s/\[YOUR NAME\]/Your Actual Name/g" LICENSE

# Replace the security contact email:
sed -i.bak "s/security@\[YOUR_DOMAIN\]/security@yourdomain.com/g" SECURITY.md

# Remove the backup files:
find . -name "*.bak" -delete
```

Or do it manually in your editor with find-and-replace if you prefer.

Files that contain placeholders:
- `README.md`
- `LICENSE`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `CHANGELOG.md`
- `docs/DEPLOYMENT.md`
- `docs/TOKEN_SETUP.md`
- `.github/FUNDING.yml`
- `.github/workflows/release.yml`
- `.github/ISSUE_TEMPLATE/config.yml`

## Step 2 — Create the repository on GitHub

1. Go to **https://github.com/new**
2. **Repository name:** `co-copilot`
3. **Description:** *A beautiful multi-model chat app for your GitHub Copilot subscription. Claude, GPT, Gemini, Llama — all through the API access you already pay for. Self-hosted, zero tracking.*
4. **Public** (since you want to open-source it)
5. **Do NOT** initialise with README, .gitignore, or license — we have those locally
6. Click **Create repository**

## Step 3 — Push your local repo

```bash
cd co-copilot
git init
git add .
git commit -m "feat: initial public release"
git branch -M main
git remote add origin git@github.com:RichieLoco/co-copilot.git
git push -u origin main
```

If you don't have SSH set up, use HTTPS:
```bash
git remote add origin https://github.com/RichieLoco/co-copilot.git
```

## Step 4 — Polish the repo settings

On the repository page, click **⚙ Settings** at the top.

### General
- **Default branch:** Confirm it's `main`
- **Features:** Enable **Issues**, **Discussions**, **Projects** (optional)
- **Pull Requests:** Enable "Allow squash merging" and "Automatically delete head branches"

### About section (right sidebar of main repo page)

Click the ⚙ next to "About" and fill in:

- **Description:** *A beautiful multi-model chat app for GitHub Copilot subscriptions. Claude, GPT, Gemini, Llama — self-hosted, zero tracking.*
- **Website:** Your deployment URL (if you have one public) or leave blank
- **Topics:** Add these for discoverability:
  ```
  github-copilot  copilot-chat  claude  gpt  llm
  self-hosted  chat-app  react  docker  multi-model
  github-models  ai-chat  chatgpt-alternative  homelab
  raspberry-pi  nas  privacy-first
  ```
- **Releases:** ✓ Show (auto-populates once you tag a release)
- **Packages:** ✓ Show (auto-populates once GHCR publishes)

### Pages (optional)
If you want a docs site at `yourusername.github.io/co-copilot`, set **Source:** `Deploy from a branch`, `main` branch, `/docs` folder. GitHub Pages will serve your markdown files.

### Security
- **Enable Dependabot alerts** (under Security → Code security and analysis)
- **Enable Dependabot security updates**
- **Enable secret scanning** (free for public repos)

### Actions → General
Confirm Actions are enabled. Our CI workflow needs this.

### Actions → General → Workflow permissions
- Select **Read and write permissions** (needed by the release workflow to publish packages)
- Enable **Allow GitHub Actions to create and approve pull requests** (for Dependabot)

## Step 5 — Set up GitHub Container Registry

The release workflow publishes Docker images to `ghcr.io/RichieLoco/co-copilot`. By default, the first publish creates a private package — you want it public so users can `docker pull` without auth.

After your first release tag (Step 7), go to:
**https://github.com/RichieLoco?tab=packages**

Click on `co-copilot` → **Package settings** → **Danger Zone** → **Change visibility** → **Public**.

Also under Package settings, **"Manage actions access"** → add your `co-copilot` repo with **Write** access so future releases can publish.

## Step 6 — Configure Discussions

If you enabled Discussions in Step 4:

1. Go to the **Discussions** tab
2. Click **Get started**
3. Set up default categories:
   - 💬 **General** (announcements)
   - 💡 **Ideas** (feature requests)
   - 🙏 **Q&A** (questions)
   - 🎉 **Show and tell** (users sharing their deployments)
   - 🐛 **Bugs** (route tiny ones here before formal issues)

Pin a welcome post introducing the project and setting the tone.

## Step 7 — Tag your first release

```bash
# Make sure everything is committed
git status

# Tag v1.0.0
git tag -a v1.0.0 -m "Initial public release"
git push origin v1.0.0
```

This triggers the **Release** workflow which:
1. Builds multi-arch Docker images (amd64, arm64, armv7)
2. Pushes them to `ghcr.io/RichieLoco/co-copilot:v1.0.0` and `:latest`
3. Creates a GitHub Release with auto-generated notes

Watch the workflow run under the **Actions** tab. First run takes ~5 minutes.

After it completes:
- Check the **Releases** section on your repo's main page — your release should be there
- Check **Packages** — the Docker image should be published
- Make the package public (Step 5)

## Step 8 — Add screenshots

The README references images in `docs/images/` that don't exist yet. Take real screenshots of your running instance:

1. Deploy Co-Copilot locally
2. Create a few projects and a populated usage widget
3. Have a real conversation with syntax-highlighted code output
4. Take screenshots matching the filenames in `docs/images/README.md`
5. Optimise them with `pngquant` (see `docs/images/README.md`)
6. Commit and push

Until you do this, the README will show broken image links — which looks unprofessional for a premium project.

## Step 9 — Promote it

Once it's polished:

- **Post to /r/selfhosted** — "I built a multi-model chat app that uses your GitHub Copilot subscription"
- **Post to /r/LocalLLaMA** — frame it as "free Claude/GPT if you already pay for Copilot"
- **Hacker News** — "Show HN: Co-Copilot — chat UI for your GitHub Copilot models"
- **Awesome-selfhosted** PR — submit to https://github.com/awesome-selfhosted/awesome-selfhosted
- **Tweet it** — tag @github if you want a chance at retweets
- **Reddit /r/github** — smaller community but targeted
- **Product Hunt** — if you're feeling ambitious

### What makes a successful launch post

A good launch post has:

1. **Clear value prop in the first sentence** — "If you pay for GitHub Copilot, you already have access to Claude Opus, GPT-5.4, Gemini, etc. I built a self-hosted chat UI for those models."
2. **A screenshot or GIF** — people scroll past text walls
3. **Explicit link** to the repo
4. **Acknowledgement of similar tools** — LibreChat, OpenWebUI — with a clear differentiator (uses your existing Copilot subscription instead of requiring separate API keys)
5. **Humble tone** — early project, open to contributions, want feedback

## Step 10 — Maintain it

The healthiest open-source projects have:

- **Fast issue triage** — aim to respond to new issues within a week
- **Labelled issues** — GitHub has defaults like `bug`, `enhancement`, `good first issue`, `help wanted`
- **A roadmap** — create a Project board or a pinned issue listing what's planned
- **Regular releases** — even small versions. Keep CHANGELOG.md updated
- **Security patches promptly** — Dependabot handles most of this automatically
- **Grateful acknowledgement** — thank contributors in release notes

## Common first-week tasks

After your repo goes live, expect to:

1. **Fix broken references** — users will find placeholder `RichieLoco` strings you missed
2. **Clarify the token setup** — even with your excellent docs, 30% of users will get stuck here
3. **Receive feature requests** for things you never thought about
4. **Get PRs with style changes** — decide whether to accept them (fine) or push back (also fine)
5. **Field "why not just use X?" questions** — have a friendly canned response ready

## Recommended labels

Add these issue labels under **Issues → Labels**:

| Label | Colour | Purpose |
|-------|--------|---------|
| `bug` | `#d73a4a` (default) | Broken behaviour |
| `enhancement` | `#a2eeef` (default) | Feature requests |
| `documentation` | `#0075ca` | Doc improvements |
| `good first issue` | `#7057ff` | Easy for newcomers |
| `help wanted` | `#008672` | Maintainer needs help |
| `question` | `#d876e3` | Q&A, not a real issue |
| `duplicate` | `#cccccc` | Closes as dup |
| `wontfix` | `#ffffff` | Deliberately declining |
| `needs-info` | `#fbca04` | Waiting on reporter |
| `dependencies` | `#0366d6` | Dependabot PRs |
| `docker` | `#0db7ed` | Docker-specific |
| `ci` | `#f9d0c4` | GitHub Actions |
| `platform: pi` | `#ffcc80` | Raspberry Pi issues |
| `platform: synology` | `#81d4fa` | Synology issues |
| `platform: unraid` | `#ffab91` | Unraid issues |

## Recommended pinned issues

Create and pin (max 3):

1. **"Welcome & FAQ"** — basic orientation
2. **"Roadmap"** — checkbox list of upcoming features, users can 👍 to prioritise
3. **"Known issues"** — things you know about and don't need more reports on

---

That's it! You're ready to ship. Good luck 🚀
