# VG Counter

A mobile-friendly Cardfight!! Vanguard tabletop counter, with Chinese, Japanese and English interfaces. It tracks six unit slots, power modifiers, critical, rest/stand state, energy, shield, soul, damage and remaining triggers. Data stays in your browser; this is a manual counter, not a rules engine.

## Use

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

## Rule references

- [Official comprehensive rules](https://cf-vanguard.com/howto/rule/) — hit determination §10.7.1.2; equality hits.
- [Official Over Trigger text](https://cf-vanguard.com/cardlist/?cardno=D-PR%2F001) — +100,000,000 for the turn, with card-specific additional effects handled manually.
- [Official energy timing Q&A Q10116](https://cf-vanguard.com/cardlist/?cardno=DZ-SS16%2F025) — Energy Generator resolves at the start of the Ride phase, before riding.
