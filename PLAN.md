- [x] Search (Basic database updates for titles and relations)
- [x] OICD Authentication
- [x] Anime details (thumbnail and description, and set rating and marked)
- [x] AnimeGrouping (show in sidebar, top switcher to move within franchise, built during add/update)
- [x] Episodes (details from TMDB and dates from Jikan)
  - [x] Fetching
  - [x] Displaying
  - [x] Allow marking as watched
- [x] Loading screen for when anime details are fetching
- [x] Deployment of UI
- [x] Quick Switch like seach instead of homescreen search
- [ ] Automatic and manual update triggers for episode releases and anime updates
- [x] More robust and integrated job system (with dashboard, cron schedules, etc)
- [x] External clients (settings global and per-device)
- [x] Frontend mobile support & PWA/Tauri
- [ ] Improve or replace gitlab pages page

---

1. Anilist scraper (including updates at anime release time **and related anime franchise grouping / season processing**)
2. Basic frontend to get started + gRPC or other way to RPC via Websocket
3. (meby?) Absolute episode numbers to season number translation (TheXEM (Cross Entity Map) and similar open-source lists (like the Fribb/ScudLee mappings))
4. Only for added anime: TMDB per-episode metadata gathering for historic and recently released episodes
