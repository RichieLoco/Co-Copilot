# Creating a GitHub Personal Access Token for Co-Copilot

Co-Copilot uses the GitHub Models API, which requires a **Fine-Grained Personal Access Token** — not the older "Classic" style tokens. This guide walks you through the exact steps.

## Step 1 — Open the fine-grained token settings

Go to: **https://github.com/settings/personal-access-tokens/new**

Or manually navigate: profile picture → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.

> ⚠ **Do not use the "Tokens (classic)" page.** Classic tokens don't have the `Models` permission that Co-Copilot needs.

## Step 2 — Fill in the basics

| Field | Value |
|-------|-------|
| **Token name** | `Co-Copilot` (or anything memorable) |
| **Description** | Optional — e.g. "Multi-model chat app" |
| **Resource owner** | Your own account |
| **Expiration** | 90 days is reasonable. Fine-grained tokens must expire. |

## Step 3 — Repository access

Select **"Public Repositories (read-only)"**.

Co-Copilot does **not** touch any repositories, but fine-grained tokens require you to pick something in this section. This is the most restricted option available and has zero effect on your data.

## Step 4 — Permissions (the important part)

Scroll down to the **"Permissions"** section. You'll see two subsections: **Repository permissions** and **Account permissions**.

**Ignore Repository permissions entirely.** Leave all of those set to "No access".

Expand **Account permissions** (not Repository permissions). Find and set:

| Permission | Access Level | Required? | What it does |
|------------|-------------|-----------|--------------|
| **Models** | **Read-only** | ✅ Required | Fetches the model catalog and runs chat inference |
| **Plan** | **Read-only** | Optional | Pulls your premium request usage & cost for the sidebar widget |

Everything else stays at **"No access"**.

## Step 5 — Generate the token

1. Scroll to the bottom and click **Generate token**
2. **Copy the token immediately** — GitHub will only show it once
3. It will look like `github_pat_11ABC...` (about 93 characters long)

## Step 6 — Paste it into Co-Copilot

On Co-Copilot's welcome screen, click **"Connect to GitHub"** and paste the token.

---

## Frequently asked questions

### Why can't I see a "Billing" permission?

GitHub named the permission **"Plan"** under Account permissions, even though the endpoint it unlocks is called `billing/premium_request/usage`. That's just what they called it. If you see **"Plan"**, that's the right one.

### My organisation has restricted fine-grained tokens. What do I do?

If your primary GitHub account is in an organisation that blocks fine-grained PATs, either:
- Create the token under a personal account that owns its own Copilot Pro subscription, or
- Ask your org admin to allow fine-grained PATs with `Models: Read` permission

### Does this token give Co-Copilot access to my code?

**No.** The token you're creating has zero repository permissions — it can only call the Models API and (optionally) read your personal billing info. It cannot read, modify, or create code in any repository.

### What if I want to revoke it later?

Go to https://github.com/settings/personal-access-tokens and click the trash can next to your token. Co-Copilot will stop working immediately — your chat history is stored locally and is unaffected.

### Can I use the same token on multiple devices?

Yes. The token isn't tied to a specific device. You can paste it into Co-Copilot on your phone, laptop, and NAS — all three will share your Copilot allowance (since they all make requests as you).

### The token expires in 90 days. What then?

You'll need to generate a new one. GitHub forces expiration on fine-grained tokens for security reasons (classic tokens don't require expiration, but they also don't have the `Models` permission, so we can't use them). Consider setting a calendar reminder for a few days before expiry.

### Why doesn't Co-Copilot use OAuth instead?

OAuth would be more convenient, but it requires registering a GitHub App and hosting the callback URL publicly — which defeats the purpose of a self-hosted tool. A PAT keeps everything local.

---

## Troubleshooting

**"Invalid token" error in Co-Copilot:**
- Make sure you pasted the whole token (it's ~93 characters starting with `github_pat_`)
- Check the token has **Models: Read** under **Account permissions** (not Repository permissions)
- The token may have expired — check at https://github.com/settings/personal-access-tokens

**Premium requests widget shows "—":**
- Add **Plan: Read** to your token's Account permissions and regenerate
- If your Copilot is billed through an organisation, the user-level endpoint won't return data (known GitHub limitation)

**Token works briefly then stops:**
- Check GitHub's status page: https://www.githubstatus.com/
- Your org might have a policy that auto-revokes PATs after some idle time — ask your org admin
