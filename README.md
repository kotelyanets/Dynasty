<div align="center">

# 👑 Dynasty

### A premium, self-hosted Music PWA for the modern era

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)](https://fastify.dev)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

![Dynasty Banner](https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80)

</div>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#1-backend-setup)
  - [Frontend Setup](#2-frontend-setup)
  - [Install as PWA](#3-install-as-pwa-on-ios--android)
- [Configuration](#-configuration)
- [API Overview](#-api-overview)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Overview

**Dynasty** is a state-of-the-art, self-hosted music streaming application. It gives you full control over your music library — no subscriptions, no censorship, no cloud required. Stream your FLAC and MP3 collection with audiophile-grade quality from any device on your local network, or deploy it on your own server for anywhere access.

> *Your music. Your rules. Your Dynasty.*

---

## 🚀 Features

### 🎵 Core Player
| Feature | Description |
|---|---|
| **Gapless Streaming** | 206 Partial Content streaming with iOS/Safari seek support |
| **Synced Lyrics** | `.lrc` karaoke-style lyrics synchronized to playback |
| **Lock Screen Controls** | Full MediaSession API — artwork, scrubber, prev/next on iOS |
| **Audio Visualizer** | Real-time spectrum bars and waveform visualizer |
| **3D Lyrics Mesh** | Immersive Three.js canvas behind full-screen lyrics |
| **ReplayGain** | Loudness normalization (LUFS) for consistent volume across tracks |

### 📚 Library Management
| Feature | Description |
|---|---|
| **Auto-Scanner** | ID3 tag parser that builds the database from your music folder |
| **Virtual List** | TanStack Virtual renders 10,000+ tracks with ~96 DOM nodes |
| **Smart Playlists** | Rule-based playlists (Most Played, Recently Added, etc.) |
| **Drag & Drop** | Reorder playlist tracks with `@dnd-kit` |
| **Cover Art** | Automatic extraction, deduplication, and on-the-fly resizing via `sharp` |
| **Fuzzy Search** | Backend SQLite search with client-side Fuse.js fallback |

### 🌐 Social & Sync
| Feature | Description |
|---|---|
| **Listening Party** | Synchronized playback rooms over Socket.io (SharePlay-like) |
| **Collaborative Playlists** | Invite others to add tracks to a shared playlist (Blend) |
| **Play Replay** | Monthly listening stats and year-in-review summaries |
| **Track Heatmap** | Seek-event heatmap showing the most replayed moments |

### 📱 App Experience
| Feature | Description |
|---|---|
| **PWA / Installable** | Add to Home Screen on iOS & Android for a native feel |
| **Offline Mode** | Service Worker caches the app shell and audio for offline playback |
| **Glassmorphic UI** | Fluid animations with Framer Motion and modern Tailwind CSS 4 |
| **Dark-first Design** | Polished dark theme with dynamic color extracted from album art |
| **Swipe Gestures** | `@use-gesture/react` swipe-to-dismiss and swipe-to-navigate |

### 🔒 Security & Performance
| Feature | Description |
|---|---|
| **Rate Limiting** | `@fastify/rate-limit` — 100 req/min per IP |
| **Security Headers** | `@fastify/helmet` with Content Security Policy |
| **Zod Validation** | All request bodies and query params validated with Zod v4 |

---

## 🛠 Tech Stack

### Frontend
| Layer | Technology |
|---|---|
| UI Framework | React 19 + TypeScript |
| Build Tool | Vite 7 |
| Styling | Tailwind CSS 4 |
| State Management | Zustand 5 |
| Animation | Framer Motion |
| 3D / Canvas | Three.js |
| Routing | React Router v7 |
| Virtual List | TanStack Virtual |
| Drag & Drop | dnd-kit |
| Gestures | @use-gesture/react |
| Real-time | socket.io-client |

### Backend
| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 18 |
| HTTP Framework | Fastify 5 |
| ORM | Prisma 5 |
| Database | SQLite (zero-infrastructure) |
| Image Processing | Sharp |
| Audio Metadata | music-metadata |
| Real-time | Socket.io |
| Validation | Zod v4 |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND  (React 19 + Vite PWA)                                │
│  ───────────────────────────────────────────────────────────    │
│  • React + TypeScript + Tailwind CSS 4                          │
│  • Zustand singleton <audio> player + MediaSession API          │
│  • TanStack Virtual for 10,000+ song libraries                  │
│  • Framer Motion animations + Three.js 3D lyrics canvas         │
│  • Service Worker → installable on iPhone / Android             │
└──────────────────────────┬──────────────────────────────────────┘
                           │  HTTP/REST + Socket.io
┌──────────────────────────┴──────────────────────────────────────┐
│  BACKEND  (Node.js + Fastify 5 + SQLite)                        │
│  ───────────────────────────────────────────────────────────    │
│  • 206 Partial Content streaming  (iOS seek support)            │
│  • Prisma ORM + SQLite  (file:./dev.db)                         │
│  • music-metadata  →  ID3 tag parsing                           │
│  • sharp  →  cover art extraction & on-the-fly resizing         │
│  • Socket.io  →  Listening Party real-time sync                 │
│  • @fastify/helmet + rate-limit + Zod  →  production hardening  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                    ┌──────┴───────┐
                    │  ./music/    │  ← Your FLAC / MP3 library
                    │   Artist/    │
                    │     Album/   │
                    │       *.flac │
                    └──────────────┘
```

---

## 📦 Getting Started

### Prerequisites

- **Node.js** v18 or later
- **npm** (comes with Node.js)
- A local FLAC / MP3 music library

---

### 1. Backend Setup

```bash
# Clone the repository
git clone https://github.com/kotelyanets/Dynasty.git
cd Dynasty

# Install backend dependencies
cd server
npm install
```

Create `server/.env` (copy from the example):

```bash
cp .env.example .env
```

Edit `server/.env`:

```env
PORT=3001
MUSIC_DIR=/absolute/path/to/your/music
DATABASE_URL=file:./prisma/dev.db
NODE_ENV=development
```

Initialize the database and scan your library:

```bash
# Generate Prisma client + run migrations
npx prisma generate
npx prisma migrate dev --name init

# Scan your music folder → builds the SQLite database
npm run scan

# Start the backend
npm run dev
# → API ready at http://localhost:3001
```

---

### 2. Frontend Setup

Open a **new terminal** in the project root:

```bash
# Install frontend dependencies
npm install
```

Create `.env` at the **project root**:

```bash
# Same machine
VITE_API_URL=http://localhost:3001

# iPhone / device on the same Wi-Fi network
# VITE_API_URL=http://192.168.1.XXX:3001

# Demo mode (static mock data, no backend needed)
# VITE_API_URL=
```

Start the dev server:

```bash
npm run dev
# → Frontend at http://localhost:5173
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

### 3. Install as PWA on iOS / Android

**iOS (Safari)**
1. Open Safari → navigate to your app URL
2. Tap the **Share** button → **"Add to Home Screen"**
3. Dynasty now lives on your Home Screen with lock-screen media controls

**Android (Chrome)**
1. Open Chrome → navigate to your app URL
2. Tap the **⋮ menu** → **"Add to Home Screen"** (or use the install banner)

---

## ⚙️ Configuration

| Variable | File | Description |
|---|---|---|
| `VITE_API_URL` | `.env` (root) | URL of the Fastify backend. Leave empty for demo mode. |
| `PORT` | `server/.env` | Port the backend listens on (default `3001`). |
| `MUSIC_DIR` | `server/.env` | Absolute path to your music folder. |
| `DATABASE_URL` | `server/.env` | Prisma SQLite connection string (default `file:./prisma/dev.db`). |
| `NODE_ENV` | `server/.env` | `development` or `production`. |

---

## 📡 API Overview

| Endpoint | Method | Description |
|---|---|---|
| `/api/tracks` | `GET` | Paginated track list |
| `/api/albums` | `GET` | All albums |
| `/api/artists` | `GET` | All artists |
| `/api/search` | `GET` | Full-text search across tracks, albums, artists |
| `/api/stream/:id` | `GET` | Audio stream (206 Partial Content, iOS-compatible) |
| `/api/covers/:file` | `GET` | Cover art with optional `?w=&h=&format=webp&q=` resizing |
| `/api/lyrics/:id` | `GET` | Synced `.lrc` lyrics for a track |
| `/api/playlists` | `GET/POST` | Create & list playlists |
| `/api/playlists/:id` | `GET/PUT/DELETE` | Manage a playlist |
| `/api/smart-playlists` | `GET` | Rule-based auto-playlists |
| `/api/play-history` | `GET/POST` | Listening history & Replay stats |
| `/health` | `GET` | Health check (`{ status: "ok" }`) |

---

## 🔧 Troubleshooting

<details>
<summary><strong>❌ "Failed to fetch" errors in the browser</strong></summary>

**Cause:** Backend not running or wrong `VITE_API_URL`.

1. Verify the backend: `curl http://localhost:3001/health`
2. Check `.env` at the project root has the correct `VITE_API_URL`
3. Restart the Vite dev server after changing `.env`

</details>

<details>
<summary><strong>❌ Seeking doesn't work on iPhone</strong></summary>

**Cause:** Backend not sending `Accept-Ranges: bytes` header.

Test it:
```bash
curl -I http://localhost:3001/api/stream/TRACK_ID | grep Accept-Ranges
# Expected: Accept-Ranges: bytes
```

The `server/src/routes/stream.ts` must set this header on every response.

</details>

<details>
<summary><strong>❌ Cover art images broken (404)</strong></summary>

**Cause:** `VITE_API_URL` is missing or the `api.ts` mapper is not prepending the base URL.

Check `src/services/api.ts` and verify cover URLs start with the backend base URL.

</details>

<details>
<summary><strong>❌ Scanner crashes with "EMFILE: too many open files"</strong></summary>

**Cause:** Too many files open in parallel (common on large libraries).

```bash
ulimit -n 4096   # macOS / Linux
```

</details>

<details>
<summary><strong>❌ Lyrics not showing</strong></summary>

Place `.lrc` files alongside the matching audio file (same base name) inside your `MUSIC_DIR`. The backend serves them via `/api/lyrics/:trackId`.

</details>

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push the branch: `git push origin feat/my-feature`
5. Open a Pull Request

Please keep PRs focused and include a clear description of the changes.

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](./LICENSE) file for details.

---

<div align="center">

Made with ❤️ for the love of music · **Dynasty** © 2025

</div>
