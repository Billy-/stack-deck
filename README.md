# Stack Deck

A phone-first, unofficial category-card companion for **STACKIT by Lucky Egg**. Put your phone in the middle of the table, leave the category visible during play, and tap the card when you want the next category. You still use the physical letters, stacking base, and your chosen game rules.

## Included

- **255 categories:** five family packs of 45 cards each, plus 30 optional After dark cards.
- Large, high-contrast category text and a discreet Back control outside the main tap target.
- A shuffled deck with no repeats before completion. Back followed by Next returns to the same card.
- Saved deck, position, and preferences on the current device, when browser storage is available.
- **Table view:** a second copy facing the opposite side of the table.
- Pack selection and an **Include tricky categories** filter.
- **After dark** is off by default and only enters the deck after explicit selection. It contains cheeky adult party prompts, not an official expansion.
- An empty-deck guard, a clear end-of-deck screen, and a deliberate fresh-shuffle action.
- Optional screen wake lock and full screen when the browser supports them.
- Offline caching and a home-screen manifest for the hosted app. Wait for **Ready offline** before relying on it without a connection.
- Keyboard support: right arrow advances, left arrow goes back; ordinary button keyboard controls also work.
- No accounts, analytics, cookies, remote fonts, framework, database, or runtime API calls.

| Pack | Cards | Example |
| --- | ---: | --- |
| Everyday life | 45 | Things in your bedroom |
| Food & drink | 45 | Foods you dip into a sauce |
| People & culture | 45 | Sports teams |
| The wider world | 45 | UK towns & cities |
| Wild cards | 45 | Things you would do with a million pounds |
| After dark | 30 | Questionable purchases after payday |

Your nine supplied examples are included. The catalogue also includes the observed examples **Fruit & vegetables** and **Phone apps**, alongside the expanded companion prompts. It is not a transcription of Lucky Egg’s official deck.

## Run and publish

**Publish:** see [DEPLOY.md](DEPLOY.md). Upload the source contents to your repository root and publish `main` / `/(root)` in GitHub Pages. There is no build or dependency-install step. The `.nojekyll` file is included.

**Local development:** from this directory, run:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/` on that computer. Opening the modular `index.html` directly from disk will not load its JSON catalogue. Use the separately exported standalone HTML if you want a single file you can open directly in a desktop browser.

**Tests:** Node.js 18 or newer, with no package installation:

```sh
node --test tests/*.test.mjs
```

## Edit the catalogue

Edit `data/cards.json`. Each card has a stable `id`, a short `prompt`, a `pack` identifier, and a difficulty of `easy`, `standard`, or `challenge`. Pack metadata determines whether a pack is adult-only. Do not put adult cards into a family pack.

Keep prompts short enough to read across a table. Difficulty is an editorial label, not a promise that every physical letter has a possible answer. Narrow categories can be skipped or excluded using the tricky-category switch.

Changing packs or difficulty starts a fresh shuffled deck. Changing Table view or screen settings keeps the current place. The app validates a saved deck against the active catalogue, so removing or adding eligible cards resets an incompatible saved deck safely.

## Offline updates

The service worker precaches a complete version of the app and its catalogue. Its cache is scoped to the repository path so it does not delete caches belonging to other GitHub Pages projects on the same domain.

When publishing changed app assets, increment `VERSION` in `sw.js`. The next version becomes active after old app tabs are closed. This intentionally avoids changing the files under an ongoing game.

Screen wake lock and offline installation need a secure, supported browser context. Device battery settings can release the wake lock. See [MDN’s screen wake lock documentation](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) and [service worker documentation](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API).

## Standalone copy

To export one HTML file containing the styles, app logic, icons, and catalogue:

```sh
python3 scripts/export-standalone.py /absolute/output/path/Stack-Deck.html
```

This copy works without a web server in ordinary desktop browsers. Some phone file-preview applications do not execute HTML apps; use the hosted GitHub Pages version on a phone. The standalone copy does not install a service worker or reference a separate manifest; all essential resources are embedded.

## Verification and research

See [RESEARCH.md](RESEARCH.md) for sources and scope. The initial implementation was checked in desktop and phone-sized browser views, and the deck and service-worker tests pass. The service-worker tests simulate browser lifecycle events; real-device offline reopening, home-screen installation, and wake lock still require validation on the final HTTPS deployment.

Stack Deck is independent of Lucky Egg. Game names are used to describe compatibility. No official logo, card artwork, promotional footage, or full official deck is distributed with the app.
