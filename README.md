# VG Counter

Mobile-first Cardfight!! Vanguard tabletop counter in Chinese, Japanese and English. Tracks six unit slots, power, critical, rest/stand, soul, damage, energy, shield and remaining triggers. This is a manual player aid; card eligibility and additional card effects remain the players' responsibility.

## Mobile layout

- Six visible unit circles, direct +5k / +10k buttons and column attack totals.
- Start turn, Persona Ride and Undo stay at the top. Ride next is directly available for the selected Vanguard.
- Critical (yellow), Draw (red), Front (blue), Heal (green) and Over (rainbow) have direct buttons below the field. Target and remaining count are explicit.
- Select a unit to subtract power, adjust critical or stand/rest. Grade, base power, abilities, swapping and retiring expand inline. No modal or drawer hides the field.
- Damage, soul and energy have direct steppers. Guard mode provides 5k/10k/15k/20k/25k/50k shield buttons and PG.
- Rare settings (preset editing, trigger counts, multi-boost, extra counters, dice and new-game reset) expand at the bottom. Existing custom counters remain directly usable.

## Rules and actions

- **Start turn** stands units and clears temporary power/critical, Persona bonus, attack count and guard values. It does not Ride or charge energy.
- **Persona Ride** records the resolved continuous front-row +10,000 effect. Later front-row units receive it, and units leaving the front row lose it. Toggle cancels the recorded effect; draw the physical card yourself. It does not validate the ride's eligibility.
- **Front trigger** gives power only to units currently in the front row. Later calls do not receive that trigger's power.
- **Critical** normally gives power and critical to the selected unit. Split allocation lets you select separate targets in view of the field and commits both as one undoable action.
- **Heal** automatically removes one damage if your damage is at least the entered opponent damage. With unknown opponent damage, choose whether the condition is met before the trigger resolves. Power applies even without healing.
- **OT** adds 100,000,000 without replacing existing power modifiers. Remove the physical trigger, draw a card and apply card-specific additional effects manually. Regular Draw also requires drawing the physical card yourself.
- **Guard** requires defense strictly above attack; equality hits. PG records a resolved no-hit effect independently of shield. Cancel restores its count; next guard ends the recorded battle.
- **Ride next** explicitly advances the configured grade/power and adds the old Vanguard to soul. EN is charged manually at the actual Energy Generator timing and capped at 10.
- Back-row attack and multi-boost are manual overrides for actual card abilities.
- Initial trigger counts 4 critical / 4 draw / 3 front / 4 heal / 1 OT are a sample distribution, editable for your deck and format. Trigger power can be 10k or 5k.

## Storage and assets

The existing `VG_COMBAT_STATE_V20_LOCAL` save key is retained. Version 3 validates old saves and stores up to 40 immutable undo snapshots. Invalid JSON falls back to a usable initial game; storage failures leave the in-memory game interactive. No user game data is sent to a server.

`public/circles.svg` is an original geometric magic-circle illustration, not official artwork. The interface is an unofficial fan tool and links to the official rules.

## Development

```sh
npm ci
npm run dev
npm test
```

Production CSS is bundled locally without a runtime CDN. The committed `dist/` contains the production build. Tests exercise the built application in jsdom and the pure game model: direct actions, split allocation, Persona / Front timing, healing, OT, guard boundaries, boost/back-row attack, atomic undo, reload, malformed saves and storage failures.

## Rule references

- [Official comprehensive rules](https://cf-vanguard.com/howto/rule/) — Persona Ride §7.15, trigger effects and hit determination (equal power hits).
- [Persona Ride explanation](https://cf-vanguard.com/howto/new_system_vgd/) — front-row continuous effect, including units called later.
- [Official rules FAQ](https://cf-vanguard.com/howto/question/?id=term) — Front trigger applies only to the units present at resolution.
- [Official Over Trigger text](https://cf-vanguard.com/cardlist/?cardno=D-PR%2F001) — +100,000,000 and card-specific additional effects.
