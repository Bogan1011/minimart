#!/usr/bin/env bash
# MiniMart Mayhem: one-time setup for the Ubuntu PC that hosts LAN games.
# Ubuntu 22.04 or 24.04 LTS. Run as a normal sudo user:   sudo bash setup.sh
# Safe to run again.
#
# What it does
#   - installs nginx (serves the web build) and ufw (firewall)
#   - creates a 'minimart' service user and /opt/minimart/{web,server}, /var/lib/minimart, /var/log/minimart
#   - nginx site on port 80: the game page, plus /ws forwarded to the Unity server's WebSocket port 7777
#   - firewall: SSH and port 80 from the local network only
#   - a systemd service for the Unity server build (installed but not started until a build is deployed)
#   - stops the PC sleeping
set -euo pipefail

if [[ $EUID -ne 0 ]]; then echo "Run with sudo: sudo bash setup.sh"; exit 1; fi
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Local network to allow, e.g. 192.168.1.0/24. Detected from the default route; override with LAN=... sudo -E bash setup.sh
IFACE="$(ip route | awk '/^default/ {print $5; exit}')"
LAN="${LAN:-$(ip route | awk -v i="$IFACE" '$0 ~ "dev "i && /proto kernel/ && /scope link/ {print $1; exit}')}"
if [[ -z "$LAN" ]]; then echo "Couldn't detect the local network. Run: LAN=192.168.1.0/24 sudo -E bash setup.sh"; exit 1; fi
echo "== Local network: $LAN"

echo "== Packages"
apt-get update -y
apt-get install -y nginx ufw openssh-server curl

echo "== User and folders"
id minimart &>/dev/null || useradd --system --home /opt/minimart --shell /usr/sbin/nologin minimart
mkdir -p /opt/minimart/web /opt/minimart/server /var/lib/minimart/saves /var/log/minimart
chown -R minimart:minimart /opt/minimart/server /var/lib/minimart /var/log/minimart
# the deploying user may write the web and server folders
if [[ -n "${SUDO_USER:-}" ]]; then
  chown -R "$SUDO_USER":www-data /opt/minimart/web
  chown -R "$SUDO_USER":minimart /opt/minimart/server
  chmod -R g+rX /opt/minimart/web /opt/minimart/server
fi
if [[ ! -f /opt/minimart/web/index.html ]]; then
  cat > /opt/minimart/web/index.html <<'HTML'
<!doctype html><meta charset="utf-8"><title>MiniMart Mayhem</title>
<body style="font-family:sans-serif;padding:2em">
<h1>MiniMart server is up</h1><p>No game build deployed yet. Build the web player in Unity and copy it to /opt/minimart/web.</p>
HTML
fi

echo "== nginx"
install -m 644 "$HERE/nginx-minimart.conf" /etc/nginx/sites-available/minimart
ln -sf /etc/nginx/sites-available/minimart /etc/nginx/sites-enabled/minimart
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

echo "== Game server service (starts once a server build is deployed)"
install -m 644 "$HERE/minimart-server.service" /etc/systemd/system/minimart-server.service
systemctl daemon-reload
if [[ -x /opt/minimart/server/MiniMartServer.x86_64 ]]; then
  systemctl enable --now minimart-server
else
  echo "   No server build yet: service installed, not started."
fi

echo "== Firewall"
ufw allow from "$LAN" to any port 22 proto tcp comment 'SSH (LAN)'
ufw allow from "$LAN" to any port 80 proto tcp comment 'MiniMart web + game (LAN)'
ufw --force enable
ufw status verbose

echo "== Never sleep (it's a server)"
systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target >/dev/null

IP="$(hostname -I | awk '{print $1}')"
echo
echo "Done. From another PC on the LAN, open:  http://$IP/"
echo "Give this PC a fixed address (router DHCP reservation for $IP is easiest)."
