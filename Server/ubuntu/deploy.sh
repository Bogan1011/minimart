#!/usr/bin/env bash
# Copy the latest builds from the dev PC (Linux, macOS or WSL) to the Ubuntu server.
# Usage (from the Unity project folder):   bash Server/ubuntu/deploy.sh <user>@<server-ip>
set -euo pipefail
TARGET="${1:?usage: deploy.sh user@server-ip}"
if [[ -d Builds/Web ]]; then
  echo "== Web build"
  rsync -az --delete Builds/Web/ "$TARGET:/opt/minimart/web/"
fi
if [[ -d Builds/Server ]]; then
  echo "== Server build"
  rsync -az --delete Builds/Server/ "$TARGET:/opt/minimart/server/"
  ssh -t "$TARGET" 'chmod +x /opt/minimart/server/MiniMartServer.x86_64 && sudo systemctl enable minimart-server && sudo systemctl restart minimart-server'
fi
echo "Done: http://${TARGET#*@}/"
