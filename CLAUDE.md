# CLAUDE.md

This repo is **กฎลับ (Secret Rule)** — a Thai party deduction game: the TV (laptop via HDMI) is the table + automatic Rule Keeper, each phone is a player's hand.

- **Read `SPEC.md` first.** It is the source of truth. Work milestone by milestone (MVP 1 → 2 → 3) and tick the checkboxes in `SPEC.md` as you finish items.
- Stack is fixed: vanilla JS ES modules, no framework, no bundler, no build step, no npm dependencies. Supabase JS from CDN. Hosted on GitHub Pages from `main` root — use relative paths only.
- Game logic stays pure in `games/secret-rule/engine.js`; test with `node --test`.
- Test multiplayer locally with `python3 -m http.server` and `?net=local` (BroadcastChannel, many tabs) before touching Supabase.
- The secret rule must never leave the host page until the game ends.
- UI text is Thai; code, identifiers and commit messages are English.
- Do not use names, logos or art from the commercial game this is inspired by.
- If a spec point is ambiguous or seems wrong, ask before changing the design.
