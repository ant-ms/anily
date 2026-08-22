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

