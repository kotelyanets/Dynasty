/*
  Warnings:

  - You are about to drop the column `isLiked` on the `Track` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TrackLike" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrackLike_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlayHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'default',
    "duration" REAL NOT NULL,
    "playedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayHistory_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PlayHistory" ("duration", "id", "playedAt", "trackId", "userId") SELECT "duration", "id", "playedAt", "trackId", "userId" FROM "PlayHistory";
DROP TABLE "PlayHistory";
ALTER TABLE "new_PlayHistory" RENAME TO "PlayHistory";
CREATE INDEX "PlayHistory_trackId_idx" ON "PlayHistory"("trackId");
CREATE INDEX "PlayHistory_userId_playedAt_idx" ON "PlayHistory"("userId", "playedAt");
CREATE INDEX "PlayHistory_playedAt_idx" ON "PlayHistory"("playedAt");
CREATE TABLE "new_Playlist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverPath" TEXT,
    "userId" TEXT NOT NULL DEFAULT 'default',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Playlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Playlist" ("coverPath", "createdAt", "description", "id", "name", "updatedAt") SELECT "coverPath", "createdAt", "description", "id", "name", "updatedAt" FROM "Playlist";
DROP TABLE "Playlist";
ALTER TABLE "new_Playlist" RENAME TO "Playlist";
CREATE UNIQUE INDEX "Playlist_name_key" ON "Playlist"("name");
CREATE TABLE "new_SeekEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "timestamp" REAL NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeekEvent_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeekEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SeekEvent" ("createdAt", "id", "timestamp", "trackId", "userId") SELECT "createdAt", "id", "timestamp", "trackId", "userId" FROM "SeekEvent";
DROP TABLE "SeekEvent";
ALTER TABLE "new_SeekEvent" RENAME TO "SeekEvent";
CREATE INDEX "SeekEvent_trackId_idx" ON "SeekEvent"("trackId");
CREATE TABLE "new_Track" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "albumId" TEXT,
    "filePath" TEXT NOT NULL,
    "duration" REAL,
    "trackNumber" INTEGER,
    "diskNumber" INTEGER,
    "genre" TEXT,
    "bitrate" INTEGER,
    "sampleRate" INTEGER,
    "codec" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "loudnessLufs" REAL,
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "lastPlayed" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Track_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Track_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Track" ("albumId", "artistId", "bitrate", "codec", "createdAt", "diskNumber", "duration", "filePath", "fileSize", "genre", "id", "lastPlayed", "loudnessLufs", "mimeType", "playCount", "sampleRate", "title", "trackNumber", "updatedAt") SELECT "albumId", "artistId", "bitrate", "codec", "createdAt", "diskNumber", "duration", "filePath", "fileSize", "genre", "id", "lastPlayed", "loudnessLufs", "mimeType", "playCount", "sampleRate", "title", "trackNumber", "updatedAt" FROM "Track";
DROP TABLE "Track";
ALTER TABLE "new_Track" RENAME TO "Track";
CREATE UNIQUE INDEX "Track_filePath_key" ON "Track"("filePath");
CREATE INDEX "Track_artistId_idx" ON "Track"("artistId");
CREATE INDEX "Track_albumId_idx" ON "Track"("albumId");
CREATE INDEX "Track_title_idx" ON "Track"("title");
CREATE INDEX "Track_lastPlayed_idx" ON "Track"("lastPlayed");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "TrackLike_userId_idx" ON "TrackLike"("userId");

-- CreateIndex
CREATE INDEX "TrackLike_trackId_idx" ON "TrackLike"("trackId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackLike_userId_trackId_key" ON "TrackLike"("userId", "trackId");
