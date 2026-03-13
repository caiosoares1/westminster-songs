-- CreateTable
CREATE TABLE "songs" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originalKey" TEXT NOT NULL,
    "author" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "songs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "song_versions" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "structureJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "song_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setlists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "setlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setlist_songs" (
    "id" TEXT NOT NULL,
    "setlistId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "setlist_songs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "song_versions_songId_idx" ON "song_versions"("songId");

-- AddForeignKey
ALTER TABLE "song_versions" ADD CONSTRAINT "song_versions_songId_fkey" FOREIGN KEY ("songId") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setlist_songs" ADD CONSTRAINT "setlist_songs_setlistId_fkey" FOREIGN KEY ("setlistId") REFERENCES "setlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setlist_songs" ADD CONSTRAINT "setlist_songs_songId_fkey" FOREIGN KEY ("songId") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
