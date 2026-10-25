-- Delete duplicate AnimeGrouping entries keeping the earliest grouping (min id) for each displayAnimeId
DELETE FROM "AnimeGrouping"
WHERE id NOT IN (
    SELECT MIN(id)
    FROM "AnimeGrouping"
    GROUP BY "displayAnimeId"
);

-- Delete any orphaned rows in _GroupingItems if any exist
DELETE FROM "_GroupingItems"
WHERE "A" NOT IN (
    SELECT id FROM "AnimeGrouping"
);
