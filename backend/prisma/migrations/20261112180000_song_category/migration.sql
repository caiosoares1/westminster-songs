-- Type of song: hinário ("hymn"), salmo ("psalm") or cântico ("canticle").
ALTER TABLE "songs" ADD COLUMN "category" TEXT;

-- Guess it for the songs already saved, from the title.
UPDATE "songs" SET "category" = 'psalm'
WHERE "title" ~* '^\s*(salmo|sl\.?)\s';

UPDATE "songs" SET "category" = 'hymn'
WHERE "category" IS NULL
  AND ("title" ~* '^\s*(hnc|hino)\M' OR "title" ~ '^\s*\d{1,3}\s');
