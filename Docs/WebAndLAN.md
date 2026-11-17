# Web build and LAN play

Decided on 2026-11-17 by Akshay. This overrides the blueprint and the MVP plan wherever they assume Steam,
a Windows installer, or a player hosting from inside the game.

- **Target:** a Unity **web build** (WebGL 2), played in Chrome or Edge.
- **Where:** on a **LAN** first. Internet play comes later, if at all.
- **Server:** a **Unity server build** (headless) running on one LAN PC. It runs the authoritative simulation
  and also serves the web page. Everyone, including whoever owns that PC, plays in a browser. This is the same
  shape as the prototype's `node server.js`.
- **Performance:** **60 fps on an i5 12th gen with Intel Iris Xe** integrated graphics, in the browser.

## Why it has to work this way

A browser tab can't open a listening socket and can't send raw UDP. So a browser can't host a game, and the
usual Unity transports (UDP) don't work from the web player. Every browser needs a **WebSocket** (or WebRTC)
connection to a program that isn't a browser. That program is the server build.

```
 LAN PC (server)                                   every player's PC
 ┌──────────────────────────────────────┐          ┌───────────────────────────┐
 │ MiniMart server build (headless)     │  HTTP    │ Chrome / Edge             │
 │  - serves Builds/Web over HTTP ──────┼─────────▶│  loads the web player     │
 │  - WebSocket listener ◀──────────────┼──────────┼─ game traffic (WSS/WS)    │
 │  - MiniMart.Simulation (authority)   │          │  renders, sends inputs    │
 │  - saves to disk                     │          └───────────────────────────┘
 └──────────────────────────────────────┘
```

## Networking library

It must have a **WebSocket transport that works from the WebGL client** and a **dedicated server** mode.
Candidates, to settle in the Week 4 multiplayer proof of concept:

| Library | Web transport | Notes |
|---|---|---|
| Netcode for GameObjects + Unity Transport | `UseWebSockets` on UnityTransport | Unity's own; Multiplayer Play Mode for testing. |
| Mirror | SimpleWebTransport | Mature, big community, easy dedicated server. |
| FishNet | Bayou | Free, good prediction tools. |

The rules are in `MiniMart.Simulation` with no Unity dependency, so whichever library wins only carries
inputs and state; it doesn't change the rules.

Serving the page: either the server build serves `Builds/Web` itself (a small HTTP listener), or a static file
server runs next to it. Both work on a LAN; the built-in one means one program to start.

## What the web build can't do

| Limitation | What we do |
|---|---|
| No threads by default, no raw sockets | WebSocket transport; keep simulation on the main thread. |
| No local file system | Saves live on the server PC. The browser keeps only settings (PlayerPrefs → IndexedDB). |
| Pointer lock needs a click | "Click to play" overlay; `Esc` frees the mouse (already in `PlayerInputReader`). |
| Background tabs get throttled | `runInBackground` on. The server is authoritative, so a throttled tab only lags its own view. |
| No `Application.Quit` | No Quit button on the web (main menu hides it). |
| `Application.targetFrameRate` is ignored | Set to -1 on WebGL so the browser's vsync paces frames (`GameBootstrap`). |
| Download size | Gzip with decompression fallback, managed stripping, compressed textures. Target under 50 MB. |

## Graphics budget for Iris Xe at 60 fps

`MiniMart ▸ Set Up Project` applies the settings; the rest are rules for art and scenes.

- **URP asset (web quality level):** MSAA off, HDR off, render scale 1.0, one shadow cascade, 25 m shadow
  distance, at most 4 per-object lights, depth and opaque textures off, no SSAO, no post-processing except
  maybe tonemapping.
- **Lighting:** one realtime directional light with hard shadows; bake everything else once the store layout
  settles. Fridge glow is emissive, not lights.
- **Draw calls:** under about 300 per frame. GPU instancing on all materials (the scene builder does this), shared
  materials per product, and the shelf contents batched per slot. A full Superstore needs product LODs or
  impostors for far aisles.
- **Triangles:** under about 300k on screen.
- **Textures:** ASTC/ETC2 or DXT via the web build's texture compression, mostly 512 px, atlases for packaging.
- **Players' view:** the camera keeps MSAA off; FXAA only if it holds 60 fps.

Check performance early: build to the web every sprint and run it on the Iris Xe laptop with the browser's
frame counter or Unity's `Development Build` profiler.

## Conflicts with the plan and blueprint

These parts of `MiniMart_Mayhem_Unity_CSharp_MVP_Plan.md` and `MiniMart_Blueprint.md` no longer apply or change:

| Plan / blueprint says | Now |
|---|---|
| Steam lobbies, invites, Steamworks, Steam friends | LAN: players type the server PC's address, or the server shows a QR code or short link. |
| Steam identity and achievements | A player name typed in the lobby. No achievements for now. |
| Windows installer, "packaged build on a clean PC", Steam test branches | A web folder on the server PC. "Clean PC" test becomes "fresh browser profile on another PC". |
| Listen server (a player hosts in-game), host migration | Dedicated server build on one PC. If it stops, the game stops; it autosaves. |
| "Launches without a browser or Node server" | Reversed: it runs in a browser, served by the Unity server build. |
| Resolution / fullscreen menu | Browser window size; a fullscreen button. |
| Crash logs written next to the exe | Server logs on the server PC; client errors sent to the server log. |
| Unity Transport over UDP | WebSocket transport. |

Everything else in the blueprint stands: scenes, layers, slot-based fixtures, box states, interaction rules,
safe drop, physics states, Target A, and the rest.

## Specs

**Each player:** any PC that runs Chrome or Edge with WebGL 2 at 60 fps. The minimum we test is an **i5 12th gen
with Intel Iris Xe** and 8 GB RAM. Wired or good 5 GHz Wi-Fi on the same LAN.

**Server PC:** Windows or Linux, 4 cores, 8 GB RAM, on the LAN with a fixed IP, port open for HTTP and
WebSockets. It runs headless, so it can also be one of the players' PCs.

**Developer PC:** unchanged, though Unity 6.3 needs the **Web Build Support** module (and **Dedicated Server**
module later). The Iris Xe laptop can run the editor with 16 GB RAM, slowly; web builds take a few minutes each.
