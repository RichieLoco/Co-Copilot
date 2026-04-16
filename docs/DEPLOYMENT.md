# Deployment Guide

Co-Copilot runs anywhere that supports Node.js 18+ or Docker. This guide covers the most common deployment scenarios.

> 👋 **First time?** Start with the [Docker](#docker) section — it's the simplest path.

---

## Table of contents

- [Docker](#docker)
- [Docker Compose](#docker-compose)
- [Raspberry Pi](#raspberry-pi)
- [Synology NAS](#synology)
- [Unraid](#unraid)
- [TrueNAS SCALE](#truenas)
- [VPS (Hetzner, DigitalOcean, Linode, etc.)](#vps)
- [Bare-metal Node.js](#bare-metal)
- [HTTPS with nginx or Caddy](#https)
- [Upgrading](#upgrading)
- [Uninstalling](#uninstalling)

---

## Docker

The fastest way to get running:

```bash
docker run -d \
  --name co-copilot \
  --restart unless-stopped \
  -p 3000:3000 \
  ghcr.io/RichieLoco/co-copilot:latest
```

Open `http://YOUR-HOST-IP:3000`, paste your GitHub token, and you're done.

### Building from source

If you'd rather build locally:

```bash
git clone https://github.com/RichieLoco/co-copilot.git
cd co-copilot
docker build -t co-copilot .
docker run -d --name co-copilot --restart unless-stopped -p 3000:3000 co-copilot
```

### Useful commands

```bash
docker logs -f co-copilot     # tail logs
docker restart co-copilot     # restart
docker stop co-copilot        # stop
docker rm -f co-copilot       # remove (persistent data is in your browser, not container)
```

---

## Docker Compose

Recommended for NAS/home-server setups because it survives reboots cleanly and is easy to version-control.

```yaml
# docker-compose.yml
services:
  co-copilot:
    image: ghcr.io/RichieLoco/co-copilot:latest
    container_name: co-copilot
    restart: unless-stopped
    ports:
      - "3000:3000"
```

Then:

```bash
docker compose up -d
```

To update to the latest version:

```bash
docker compose pull
docker compose up -d
```

---

## Raspberry Pi

Co-Copilot runs well on a Pi 3B+ or newer. The multi-arch Docker images include `linux/arm64` and `linux/arm/v7`, so the same commands work.

### Pi 4 / Pi 5 (64-bit Raspberry Pi OS)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in for the group change to take effect

docker run -d \
  --name co-copilot \
  --restart unless-stopped \
  -p 3000:3000 \
  ghcr.io/RichieLoco/co-copilot:latest
```

### Pi 3 or older (32-bit OS)

Same commands — Docker will auto-pull the `arm/v7` image.

### Auto-start on boot

Docker's `--restart unless-stopped` handles this. No systemd unit needed.

### Performance notes

- Cold-start takes ~3 seconds on a Pi 4
- Streaming chat feels instant — the Pi is just forwarding bytes, the heavy lifting happens on GitHub's servers
- RAM usage is ~40MB idle, ~80MB during active chat
- No SD card wear concerns — Co-Copilot doesn't write to disk

---

## Synology

### Option 1: Container Manager (DSM 7.2+)

1. Open **Container Manager** on your Synology
2. Go to **Registry** → search for `co-copilot` → **Download** `ghcr.io/RichieLoco/co-copilot:latest`
3. Go to **Container** → **Create**
4. Select the image
5. Set container name: `co-copilot`
6. Enable **Auto-restart**
7. Under **Port Settings**, map local port `3000` → container port `3000`
8. Click **Next** → **Done**

Open `http://YOUR-SYNOLOGY-IP:3000`.

### Option 2: SSH + Docker Compose

If you have SSH access:

```bash
ssh admin@YOUR-SYNOLOGY-IP
sudo -i
mkdir -p /volume1/docker/co-copilot && cd /volume1/docker/co-copilot
cat > docker-compose.yml <<'EOF'
services:
  co-copilot:
    image: ghcr.io/RichieLoco/co-copilot:latest
    container_name: co-copilot
    restart: unless-stopped
    ports:
      - "3000:3000"
EOF
docker compose up -d
```

### Accessing via DSM Reverse Proxy (for HTTPS)

1. **Control Panel** → **Login Portal** → **Advanced** → **Reverse Proxy**
2. Create a new rule:
   - Source: `https://copilot.yourdomain.synology.me:443`
   - Destination: `http://localhost:3000`
3. Under **Custom Header**, add `WebSocket` entries (for streaming):
   - `Upgrade` → `$http_upgrade`
   - `Connection` → `$connection_upgrade`
4. Save

---

## Unraid

### Community Applications

If Co-Copilot is in the Community Applications store (check `Apps` tab), install it from there in one click.

### Manual Docker template

Otherwise, use the **Add Container** flow:

- **Name:** `co-copilot`
- **Repository:** `ghcr.io/RichieLoco/co-copilot:latest`
- **Network Type:** `Bridge`
- **Add Port:** Container `3000` → Host `3000`, Protocol `TCP`
- **Auto-restart:** enabled

Apply. Co-Copilot is accessible at `http://YOUR-UNRAID-IP:3000`.

---

## TrueNAS

### TrueNAS SCALE (Cobia 23.10+)

Use the **Custom App** option in the Apps section:

1. **Apps** → **Discover Apps** → **Custom App**
2. **Application Name:** `co-copilot`
3. **Image Repository:** `ghcr.io/RichieLoco/co-copilot`
4. **Image Tag:** `latest`
5. **Port Forwarding:** Container `3000` → Node `3000`
6. **Restart Policy:** `Unless stopped`
7. **Install**

### TrueNAS CORE (FreeBSD-based)

TrueNAS CORE doesn't have native Docker. Install Co-Copilot inside a FreeBSD jail with Node.js, following the [Bare-metal Node.js](#bare-metal) instructions below.

---

## VPS

Any VPS with ≥512MB RAM works. Tested on:
- Hetzner Cloud CX11 (€4/month)
- DigitalOcean $6 droplet
- Oracle Cloud Always Free tier (free)

### Setup on Ubuntu 24.04

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Run Co-Copilot
docker run -d \
  --name co-copilot \
  --restart unless-stopped \
  -p 3000:3000 \
  ghcr.io/RichieLoco/co-copilot:latest

# Put it behind nginx with HTTPS (see next section)
```

Do not expose port 3000 directly to the internet without HTTPS — the PAT in your browser is sent on every request, and we want that encrypted in transit.

---

## Bare metal

No Docker, just Node.js directly.

```bash
# Install Node.js 20 (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Clone and build
git clone https://github.com/RichieLoco/co-copilot.git
cd co-copilot
npm install
npm run build

# Run
npm start
# Or with PM2 for auto-restart:
sudo npm install -g pm2
pm2 start server.js --name co-copilot
pm2 save
pm2 startup   # follow printed instructions
```

### systemd unit (no PM2)

Create `/etc/systemd/system/co-copilot.service`:

```ini
[Unit]
Description=Co-Copilot
After=network.target

[Service]
Type=simple
User=co-copilot
WorkingDirectory=/opt/co-copilot
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo useradd -r -s /bin/false co-copilot
sudo mv /path/to/co-copilot /opt/
sudo chown -R co-copilot:co-copilot /opt/co-copilot
sudo systemctl enable --now co-copilot
sudo systemctl status co-copilot
```

---

## HTTPS

Don't expose Co-Copilot over plain HTTP beyond your local network. Your GitHub token is sent on every request — it must be encrypted in transit.

### Caddy (easiest)

Install Caddy (see https://caddyserver.com/docs/install), then create a `Caddyfile`:

```caddy
copilot.yourdomain.com {
    reverse_proxy localhost:3000 {
        flush_interval -1
    }
}
```

Start Caddy. It automatically obtains and renews a Let's Encrypt certificate.

### nginx

```nginx
server {
    listen 80;
    server_name copilot.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name copilot.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/copilot.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/copilot.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Critical for streaming chat responses:
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }
}
```

Get a certificate with certbot:

```bash
sudo certbot --nginx -d copilot.yourdomain.com
```

### Tailscale (no public domain needed)

If you don't want your Co-Copilot instance on the public internet at all, put it behind [Tailscale](https://tailscale.com). You access it from any of your devices via the Tailscale IP, and it's never exposed externally.

```bash
# On your host:
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# Now visit http://YOUR-TAILSCALE-IP:3000 from any Tailscale-connected device
```

---

## Upgrading

### Docker / Docker Compose

```bash
docker compose pull
docker compose up -d
```

### Bare metal

```bash
cd /path/to/co-copilot
git pull
npm install
npm run build
pm2 restart co-copilot
# or: sudo systemctl restart co-copilot
```

Your chat history and projects are stored in your browser's `localStorage` — they're unaffected by upgrades.

---

## Uninstalling

### Docker

```bash
docker compose down
# or: docker rm -f co-copilot && docker rmi ghcr.io/RichieLoco/co-copilot:latest
```

### Bare metal

```bash
pm2 delete co-copilot
# or: sudo systemctl disable --now co-copilot
rm -rf /opt/co-copilot
```

### Clearing browser data

To remove your saved token, projects, and chat history, open Co-Copilot in the browser → open DevTools (F12) → Application → Local Storage → right-click `http://YOUR-HOST:3000` → Clear.

Or simply clear your browser's site data for that origin.

### Revoking the GitHub token

Go to https://github.com/settings/personal-access-tokens and delete the Co-Copilot token. Do this **before** uninstalling if you want to be tidy.

---

## Troubleshooting

**Container won't start:**
```bash
docker logs co-copilot
```

**Can't reach Co-Copilot from another device on LAN:**
- Check firewall: `sudo ufw allow 3000/tcp` (Ubuntu) or equivalent
- Verify Docker bound to `0.0.0.0`: `docker port co-copilot` should show `0.0.0.0:3000`
- On Synology/QNAP, check the firewall app

**Chat responses cut off mid-stream:**
- Your reverse proxy is buffering. Add `proxy_buffering off` (nginx) or `flush_interval -1` (Caddy).

**Models list is incomplete:**
- Your PAT might not be a fine-grained token with `Models: Read`. See [TOKEN_SETUP.md](TOKEN_SETUP.md).

**Premium requests shows "—":**
- Add `Plan: Read` to your PAT's Account permissions
- Org-billed Copilot seats can't use the user-level billing endpoint (known GitHub limitation)
