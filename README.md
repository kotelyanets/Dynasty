<div align="center">

# 👑 Dynasty

### Self-hosted music streaming, built with React + Fastify

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)](https://fastify.dev)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

</div>

---

## Overview

Dynasty is a polished, installable Progressive Web App for streaming your own music library.
It combines a modern React frontend with a Fastify + Prisma backend, so you can scan local audio files, browse albums/artists, and stream tracks with a responsive player experience.

### Highlights

- 🎵 Self-hosted music library (FLAC/MP3)
- ⚡ Fast React 19 + Vite 7 frontend
- 📱 Installable PWA (iOS/Android/Desktop)
- 🔎 Search, playlists, and library browsing
- 🎚️ iOS-friendly streaming with byte-range support
- 🔐 API hardening via Fastify security middleware

---

## Tech Stack

### Frontend

- React 19 + TypeScript
- Vite 7
- Tailwind CSS 4
- Zustand
- Framer Motion

### Backend

- Node.js + Fastify 5
- Prisma 5
- SQLite
- music-metadata
- Sharp
- Socket.io

---

## Project Structure

```text
Dynasty/
├── src/                  # Frontend (React + Vite)
├── server/               # Backend (Fastify + Prisma)
│   ├── prisma/           # DB schema + migrations
│   └── src/              # API routes and services
├── public/               # Static frontend assets
├── README.md
└── SETUP.md
```

---

## Quick Start

### 1) Clone and install dependencies

```bash
git clone https://github.com/kotelyanets/Dynasty.git
cd Dynasty
npm install
cd server && npm install && cd ..
```

### 2) Configure environment

Create the frontend `.env` at repository root:

```bash
cp .env.example .env
```

Create `server/.env`:

```env
PORT=3001
MUSIC_DIR=/absolute/path/to/your/music
DATABASE_URL=file:./prisma/dev.db
NODE_ENV=development
```

### 3) Initialize backend database

```bash
cd server
npx prisma generate
npx prisma migrate deploy
npm run scan
```

### 4) Run backend and frontend

In terminal 1:

```bash
cd server
npm run dev
```

In terminal 2:

```bash
npm run dev
```

App: `http://localhost:5173`

---

## Available Scripts

### Frontend (root)

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

### Backend (`server/`)

```bash
npm run dev
npm run build
npm run scan
npm run db:generate
npm run db:migrate
npm run db:migrate:prod
```

---

## Configuration

| Variable | File | Description |
|---|---|---|
| `VITE_API_URL` | `.env` (root) | API base URL. Example: `http://localhost:3001`. |
| `PORT` | `server/.env` | Fastify server port (default: `3001`). |
| `MUSIC_DIR` | `server/.env` | Absolute path to your music folder. |
| `DATABASE_URL` | `server/.env` | Prisma DB URL, e.g. `file:./prisma/dev.db`. |
| `NODE_ENV` | `server/.env` | `development` or `production`. |

---

## API Overview

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/tracks` | `GET` | Paginated track list |
| `/api/albums` | `GET` | Albums |
| `/api/artists` | `GET` | Artists |
| `/api/search` | `GET` | Search tracks/albums/artists |
| `/api/stream/:id` | `GET` | Audio stream |
| `/api/lyrics/:id` | `GET` | Lyrics by track |
| `/api/playlists` | `GET/POST` | List/create playlists |
| `/health` | `GET` | Health check |

---

## Development Notes

- Run `npm run build` (root) to validate the frontend production build.
- Run `npm run build` inside `server/` to type-check and build backend output.
- Use `npm run scan` in `server/` after adding new music files.

---

## Contributing

Contributions are welcome.

1. Fork the repository
2. Create your branch (`git checkout -b feat/my-feature`)
3. Commit your changes (`git commit -m 'feat: add feature'`)
4. Push your branch
5. Open a Pull Request

Please keep PRs focused and include clear reproduction/verification steps.

---

## License

Licensed under the **MIT License**. See [LICENSE](./LICENSE).
