# TODO

## Edge Cases to Refine

### Anilist Unknown Episode Counts (Stub Fallback)
Currently, if an anime has no TVDB mapping in Fribb (often the case for ONAs or Movies), we fall back to creating stub episodes based on the `episodes` count from Anilist. 
However, for currently airing/releasing shows (e.g., *Sousou no Frieren: ●● no Mahou Part 3*), Anilist often returns `episodes: null` because the total count is not yet known. 

**Current Solution:** 
If TVDB mapping is missing and Anilist's episode count is `null` (or 0), we default to generating exactly **1 stub episode** (`Episode 1`) so that the user has at least one trackable item in the app, rather than the anime disappearing into an untrackable state.

**Future Refinement Ideas:**
- Re-query Anilist periodically specifically for these stubbed anime to see if the episode count has been updated from `null` to a real number, and generate the remaining stubs.
- Alternatively, check Anilist's `streamingEpisodes` length or `nextAiringEpisode` to infer how many episodes have actually been released when `episodes` is unknown.

### TVDB Mapping Delays (Problem that needs a different solution)
When a new or niche anime is tracked (e.g. *Hell Mode Season 2*), it often exists on TVDB, but the bridging dataset we use to link Anilist IDs to TVDB IDs (`fribbels/anime-lists`) does not yet have the mapping.
Because we don't have the `tvdb_id` from Fribb, the app falls back to creating stub episodes using Anilist's total episode count instead of fetching the rich TVDB metadata (titles, thumbnails, air dates). 

**Current Solution:** 
We rely entirely on `fribbels/anime-lists` for mapping. If it's not mapped there, we fallback to dummy stubs until the community updates the file.

**Future Refinement Ideas:**
- Implement a different mapping solution or fallback layer that doesn't solely rely on the Fribb dataset (e.g. searching TVDB manually by title, using alternative databases like TMDB, or allowing users to manually input the TVDB ID in the UI).
