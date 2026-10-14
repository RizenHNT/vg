# VG Counter

A mobile-friendly Cardfight!! Vanguard tabletop counter, with Chinese, Japanese and English interfaces. It tracks six unit slots, power modifiers, critical, rest/stand state, energy, shield, soul, damage and remaining triggers. Data stays in your browser; this is a manual counter, not a rules engine.

## Use

- Open Settings to **Install app**, share the link, or read the platform's installation steps. iPhone/iPad users can use Safari → Share → Add to Home Screen; Android/desktop users can use the browser's install menu.
- Open online once and wait for **Ready offline** in Settings. The six-slot counter then works offline, including reopening and saving a game. Browsers and installed home-screen apps may keep separate records; continue a game from the same entry point.
- An available update appears above the field. **Update & keep my save** applies it when you choose; an ongoing game is never reloaded automatically. The production save key is retained.

- Tap a unit, then tap **Power** or the smaller green **Shield** number to choose what the existing base/modifier controls edit. The selected number glows; the two values save independently. OT applies to power. Its sheet scrolls independently and closes using its top button, backdrop or Escape.
- Tap the grade badge for grade/power/shield shortcuts. G0/G1/G2 start at 5k shield as an editable shortcut; G2 enables Intercept automatically. Set values to match the actual card. Explicit shields from existing saves are retained.
- An Intercept unit displays shield along the side of its circle. Tap it for common base shields and custom input. Other grades show the badge after Intercept is enabled; the existing back-row override is retained. Intercept contributes base shield plus shield modifier, clamped to zero.
- **Turn Start** stands units and clears temporary power/shield modifiers, critical, attack history and the guard pool. It does not Ride or charge energy.
- **Ride next** explicitly advances the Vanguard to the next configured grade/power preset. Use the energy controls at the actual Energy Generator timing; skip the first charge when required by its card text.
- **OT** toggles an additional 100,000,000 on the selected unit and preserves other modifiers. Apply card-specific additional effects manually.
- The compact field is followed by a match panel with damage/soul shortcuts, a manual timer and recent actions. **Turn Start** advances its turn counter. Timer state and actions stay on this browser.
- **End & reset** opens a confirmation dialog. Nothing clears until you check the confirmation and submit. **Restore last game** restores the complete previous game after a reload or while offline, including Intercept reservations, attack history and elapsed time. It asks before replacing a new game. Language, skin, grade presets and counter names survive a reset.
- Grade shortcuts include Griphogila G10/13k and Griphogila Vartex G11/18k with Twin Drive; additional ability effects remain manual modifiers. Custom grades up to 99 accept an optional printed power. Both ordinary Ride and Stride remain separate from these explicit shortcuts.
- Settings include three circuit palettes and a battle-effects switch. Calls, rides, attacks and triggers have short effects. System reduced motion is respected. OT uses colored luminous digits while keeping the original ring color and the dimmed appearance of rested units.
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

Browser checks run with Playwright: `node tests/mobile-layout.cjs`, `node tests/match-browser.cjs` and `node tests/pwa-browser.cjs`. They cover layout, special grades, reset safety, complete offline undo, timer, effects, skins, locale rendering, installability, sharing and applying an update without losing the save. For a local Edge check, set `VG_BROWSER_CHANNEL=msedge`. The GitHub workflow installs its own Chromium test runtime.

## Rule references

- [Griphogila official card](https://en.cf-vanguard.com/cardlist/?cardno=BCS2023%2FVGS04) — printed grade 10, power 13000 and Twin Drive.
- [Griphogila Vartex official card](https://cf-vanguard.com/cardlist/?cardno=D-BT13%2F016&expansion=254&view=text) — printed grade 11, power 18000 and Twin Drive.

- [Official comprehensive rules](https://cf-vanguard.com/howto/rule/) — hit determination §10.7.1.2; equality hits.
- [Official Over Trigger text](https://cf-vanguard.com/cardlist/?cardno=D-PR%2F001) — +100,000,000 for the turn, with card-specific additional effects handled manually.
- [Official energy timing Q&A Q10116](https://cf-vanguard.com/cardlist/?cardno=DZ-SS16%2F025) — Energy Generator resolves at the start of the Ride phase, before riding.
