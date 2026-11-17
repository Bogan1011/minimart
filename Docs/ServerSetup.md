# Ubuntu server setup (LAN host)

One Ubuntu PC on the LAN hosts every game. It serves the web page and, from the multiplayer proof of concept
(Week 4) on, runs the Unity server build. Players, including whoever sits at this PC, play in Chrome or Edge.

```
 Ubuntu server (8 GB)                               players' PCs
 ┌───────────────────────────────────────┐          ┌──────────────────────┐
 │ nginx :80                             │          │ Chrome / Edge        │
 │   /      → /opt/minimart/web (game)  ◀┼──────────┼─ http://<server-ip>/ │
 │   /ws    → 127.0.0.1:7777            ◀┼──────────┼─ game WebSocket      │
 │ minimart-server (Unity, headless)     │          └──────────────────────┘
 │   saves → /var/lib/minimart/saves     │
 └───────────────────────────────────────┘
```

Only port 80 (and SSH) is opened, and only to the local network.

## What the PC needs

- **Ubuntu 22.04 or 24.04 LTS**, Server or Desktop. 8 GB RAM is plenty: nginx uses a few MB, and the Unity
  server should stay under 2 GB for 8 players (the service caps it at 3 GB).
- 2+ CPU cores, 5 GB free disk.
- **Wired Ethernet** to the router if possible. Wi-Fi works but adds lag spikes for everyone.
- A **fixed IP address**. Easiest: in your router's settings, add a DHCP reservation for this PC.
- No Unity Editor and no GPU needed. Builds are made on the dev PC and copied over.

## 1. One-time setup (on the Ubuntu PC)

Get the repository's `Server/ubuntu` folder onto the PC (git clone, or copy it on a USB stick), then:

```bash
cd Server/ubuntu
sudo bash setup.sh
```

It installs nginx, ufw and OpenSSH; creates `/opt/minimart/web`, `/opt/minimart/server`,
`/var/lib/minimart/saves` and `/var/log/minimart`; sets up the nginx site and the `minimart-server` service;
opens SSH and port 80 to your LAN only; and stops the PC sleeping. It prints the address to open.

If it can't detect your network, pass it: `LAN=192.168.1.0/24 sudo -E bash setup.sh`.

**Check:** from another PC, open `http://<server-ip>/`. You should see "MiniMart server is up".

## 2. On the dev PC (Unity)

1. Unity Hub ▸ Installs ▸ your 6.3 LTS ▸ Add modules: **Web Build Support** and
   **Linux Dedicated Server Build Support**.
2. In the project: **MiniMart ▸ Set Up Project** (once), then **MiniMart ▸ Build Web Player** → `Builds/Web`.
3. From Week 4 on: **MiniMart ▸ Build Linux Server** → `Builds/Server/MiniMartServer.x86_64`.

## 3. Deploy

From the Unity project folder on the dev PC:

- **Windows (PowerShell):** `.\Server\ubuntu\deploy.ps1 <you>@<server-ip>`
- **Linux, macOS or WSL:** `bash Server/ubuntu/deploy.sh <you>@<server-ip>`

They copy `Builds/Web` (and `Builds/Server` if it exists) and restart the game server. `<you>` is your login on
the Ubuntu PC. Then everyone opens `http://<server-ip>/`.

Tip: run `ssh-keygen` then `ssh-copy-id <you>@<server-ip>` (or copy the key by hand on Windows) so deploys
don't ask for a password every time.

## Day to day

| Task | Command (on the server) |
|---|---|
| Is the game server running? | `systemctl status minimart-server` |
| Live server log | `journalctl -u minimart-server -f` or `tail -f /var/log/minimart/server.log` |
| Restart the game server | `sudo systemctl restart minimart-server` |
| Web server log | `sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log` |
| Back up saves | `sudo tar czf ~/minimart-saves-$(date +%F).tgz /var/lib/minimart/saves` |
| Firewall rules | `sudo ufw status` |

## Troubleshooting

- **Page doesn't load from other PCs**: `sudo ufw status` should allow 80 from your LAN; check the IP with
  `hostname -I`; some routers isolate Wi-Fi clients ("AP isolation"), turn that off.
- **Stuck on the Unity loading bar or "unknown content encoding"**: rebuild after running
  **MiniMart ▸ Set Up Project** (it keeps file names the nginx config expects), and redeploy.
- **Players disconnect when the server PC is idle**: the setup masks sleep; also turn off "Automatic suspend"
  in Ubuntu Desktop's power settings.
- **Server crashes**: systemd restarts it after 3 s; read `journalctl -u minimart-server -n 200`.

## Not yet

The Unity server build has nothing to do until networking lands in the Week 4 multiplayer proof of concept, so
until then the service stays stopped and this PC only serves the web page (each browser plays solo). The
networking code will read `-port 7777` and `-saveDir /var/lib/minimart/saves` from the service's command line.
