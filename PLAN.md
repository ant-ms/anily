- [x] Search (Basic database updates for titles and relations)
- [x] OICD Authentication
- [x] Anime details (thumbnail and description, and set rating and marked)
- [ ] Episodes (details from TMDB and dates from Jikan)
- [ ] AnimeGrouping (show in sidebar, top switcher to move within franchise, built during add/update)
- [ ] Automatic and manual update triggers for episode releases and anime updates
- [ ] More robust and integrated job system (with dashboard, cron schedules, etc)
- [ ] Downloads through transmission (migrate ani-ant, maybe with Anitomy for parsing torrent names)
- [ ] External clients (settings global and per-device)
- [ ] Release calendar view (maybe with an explore feature to find new ones)
- [ ] Frontend mobile support & PWA/Tauri

---

1. Anilist scraper (including updates at anime release time **and related anime franchise grouping / season processing**)
2. Basic frontend to get started + gRPC or other way to RPC via Websocket
3. (meby?) Absolute episode numbers to season number translation (TheXEM (Cross Entity Map) and similar open-source lists (like the Fribb/ScudLee mappings))
4. Only for added anime: TMDB per-episode metadata gathering for historic and recently released episodes
