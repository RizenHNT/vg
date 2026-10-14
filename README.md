# VG Counter

A mobile-friendly Cardfight!! Vanguard tabletop counter, with Chinese, Japanese and English interfaces. It tracks six unit slots, power modifiers, critical, rest/stand state, energy, shield, soul, damage and remaining triggers. Data stays in your browser; this is a manual counter, not a rules engine.

## Use

- Open Settings to **Install app**, share the link, or read the platform's installation steps. iPhone/iPad users can use Safari → Share → Add to Home Screen; Android/desktop users can use the browser's install menu.
- Open online once and wait for **Ready offline** in Settings. The six-slot counter then works offline, including reopening and saving a game. Browsers and installed home-screen apps may keep separate records; continue a game from the same entry point.
- An available update appears above the field. **Update & keep my save** applies it when you choose; an ongoing game is never reloaded automatically. The production save key is retained.

- Tap a unit to edit power, modifiers and critical. Its sheet scrolls independently and closes using its top button, backdrop or Escape.
- Tap the grade badge to set the actual card grade. Grade and power are independent.
- **Turn Start** stands units and clears temporary power/critical, attack history and shield. It does not Ride or charge energy.
- **Ride next** explicitly advances the Vanguard to the next configured grade/power preset. Use the energy controls at the actual Energy Generator timing; skip the first charge when required by its card text.
- **OT** toggles an additional 100,000,000 on the selected unit and preserves other modifiers. Apply card-specific additional effects manually.
- Enter the opponent attack power to calculate guarding. Equal power hits; shield must make defense strictly higher. PG records a no-hit effect independently of shield; cancel restores the counter, while resetting defense ends the recorded battle.
- Back-row attack and multi-support are manual overrides for card effects. They do not validate whether your card has that ability.
- Remaining trigger counters are editable; the initial 4 critical / 4 draw / 3 front / 4 heal / 1 OT is only a sample distribution.

## Development

```sh
npm ci
npm run dev
npm test
```

Production CSS is generated locally using Tailwind, without the runtime Tailwind CDN. The committed `dist/` contains the production build. Regression tests exercise the built application in jsdom, including damaged old saves and guard equality.

The build creates `sw.js` from `pwa/sw-template.js`, with a content-derived cache version and a complete app shell. It caches only the calculator's entry page and local assets. Updates wait for the user's action; the preceding shell is retained for already-open tabs. No game data is sent to a server. Install icons are original vector artwork in `public/icons/app.svg`.

Browser checks run with Playwright: `node tests/mobile-layout.cjs` and `node tests/pwa-browser.cjs`. The latter checks browser installability, old-save restoration, offline reload/new launch/edit, sharing fallback, and applying an update without losing the save. For a local Edge check, set `VG_BROWSER_CHANNEL=msedge`. The GitHub workflow installs its own Chromium test runtime.

## Rule references

- [Official comprehensive rules](https://cf-vanguard.com/howto/rule/) — hit determination §10.7.1.2; equality hits.
- [Official Over Trigger text](https://cf-vanguard.com/cardlist/?cardno=D-PR%2F001) — +100,000,000 for the turn, with card-specific additional effects handled manually.
- [Official energy timing Q&A Q10116](https://cf-vanguard.com/cardlist/?cardno=DZ-SS16%2F025) — Energy Generator resolves at the start of the Ride phase, before riding.
