# Sloth Band vs. Platypus

A slingshot physics game in the Angry Birds style. The platypuses stole the
stage; launch the sloth band at their forts and pop every platypus.

## The band

Each sloth has a special move. Tap anywhere while it is in the air to use it.

| Sloth | Instrument | Special move |
| --- | --- | --- |
| Dusty | Drums | BOOM: a drum blast that knocks nearby blocks and platypuses flying |
| Toot | Trumpet | Fanfare: blasts forward at top speed |
| Strum | Guitar | Chord: splits into three sloths |
| Big Lou | Tuba | Heavy; slams straight down |

Impacts play notes in each sloth's voice, so a good shot sounds like the band
playing. All sounds are synthesized live with Web Audio (equal-temperament
pitches, just-ratio chords, enveloped harmonic timbres, same approach as the
Note Rush Sound Lab), so there are no audio files.

## Levels and rewards

12 levels ("the set list"), unlocked in order. Wood, stone and ice blocks have
different strength; a king platypus with a crown takes more hits. Stars come
from score; every sloth left over when you win is worth 10,000.

Coins and the best total score go into the shared Known Quantity profile
(`shared/kq-profile`) under game id `sloth-band`:

- Win: 1 coin per 5,000 points, plus 5 coins for each newly earned star.
- Lose: 1 coin per 10,000 points.
- `submitScore('sloth-band', …)` gets the sum of the best score on every level.

Level progress (stars and best per level) is stored on the device under
`sb.progress.v1`.

## Running it

It is plain HTML, CSS and JavaScript with no build step. Serve the repo root
and open `games/sloth-band/` (the page loads `../../shared/kq-profile/kq-profile.js`):

```sh
npx http-server . -p 8080   # from the repo root, then open http://localhost:8080/games/sloth-band/
```

`./build.sh` makes a self-contained copy in `dist/` (with the profile script
vendored in) for packaging in a WebView app shell. The game is landscape; it
shows a "turn your phone sideways" hint in portrait.

## Tests

```sh
npm install
npm test
```

The smoke test opens the game in headless Chromium, checks that every level's
structure stands on its own without breaking, fires real drag-and-release
shots and each special move, clears level 1 with aimed shots, and checks that
the win pays coins into the shared profile. Screenshots land in `tests/screens/`.

## Files

- `js/game.js`: physics, slingshot input, damage and scoring rules, rendering
- `js/levels.js`: the 12 level layouts
- `js/art.js`: all character and scenery drawing (vector, no image assets)
- `js/audio.js`: synth sound effects
- `js/main.js`: menus, progress saving, shared profile hookup
- `vendor/matter.min.js`: [matter-js](https://brm.io/matter-js/) 0.20.0 physics engine (MIT, license alongside)
