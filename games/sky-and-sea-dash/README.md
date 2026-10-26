# Sky and Sea Dash

A three-lane endless runner where your creature flies through the sky, dives
through a splash ring into the sea, swims, then leaps back out. Every switch
raises the score multiplier.

- **Swipe left/right** (← →): change lanes
- **Swipe up** (↑ / W / Space): soar over things below you (birds, coral)
- **Swipe down** (↓ / S): dive under things above you (storm clouds, jellyfish)
- Balloons and kelp towers fill the whole lane: change lanes.
- Power-ups: magnet (8 s), bubble shield (one hit), double coins (10 s).
- After a crash you can keep going for 50 coins, then 100.

## Creatures

The creature picker shows every creature in the shared profile (for example
ones bred in the breeding game) plus three random wild ones. Wild creatures
are free to play; befriending one for 100 coins saves it to the shared
profile so other games can use it. Creatures are drawn procedurally from a
seed (`creatures.js`).

## Shared profile

Coins and best scores go through `shared/kq-profile` (game id
`sky-and-sea-dash`). Coins earned here can be spent in any Known Quantity
game. "Move profile" on the menu shows a code to carry the profile to
another app.

## Run it

From the repo root:

```
npx http-server -p 8080 .
```

then open http://localhost:8080/games/sky-and-sea-dash/

## Package it

`./build.sh` copies the game and the shared profile into `dist/` with the
script path rewritten, ready to drop into a Capacitor or other WebView shell.

## Files

- `index.html`, `style.css`: screens and HUD
- `game.js`: game loop, spawning, collisions, rendering
- `creatures.js`: seeded creature generator and drawing
- `audio.js`: Web Audio sounds (equal-temperament notes, just-ratio chords,
  same approach as the Note Rush Sound Lab)
