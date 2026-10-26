# Mimic Manor

Hide-and-seek in a side-view, five-floor house that rearranges itself every
night. You're Mimi, a shape-shifting blob. Stay out of sight until sunrise.

- **Tap a floor** to sneak there. Mimi finds the stairs (and the laundry
  chute) on its own.
- **Tap furniture** (wardrobe, piano, grandfather clock, fridge, bathtub,
  barrel, ...) to hide inside. Each use leaves goo smudges, and Granny checks
  smudgy spots first, so hiding in the same place gets riskier.
- **Tap Mimi** or the **Mimic** button (Space/M on a keyboard) to turn into a
  vase, lamp or plant. Changing while someone is watching doesn't work.
- **Goo** is Mimi's stamina: hiding burns it slowly, disguises burn it fast,
  and Mimi pops out when it runs out. It refills in the open and from cookies.
- Creaky boards and tattletale portraits (from night 2) make noise; the
  laundry chute (attic to cellar) is fast and loud and wipes your scent.

## Seekers

| Night | Seekers |
| --- | --- |
| 1 | Granny Gertie |
| 2 | Biscuit the hound |
| 3 | Hoover 3000 |
| 4 | Gertie + Biscuit |
| 5 | Gertie + Hoover |
| 6 | Biscuit + Hoover |
| 7+ | all three, a bit faster each night |

- **Granny Gertie** sees along her lantern beam, walks to a piece of furniture
  and opens it (her thought bubble shows which one), and goes to investigate
  noises. She's fooled by disguises unless she saw you change.
- **Biscuit** follows your scent trail (the green wisps), is faster than you on
  floors but slow on stairs, and smells through disguises. If your trail ends
  at a hiding spot he scratches at it until he finds you, so leave before he
  gets there.
- **Hoover 3000** picks a floor (red arrows), then sweeps it end to end,
  slurping anything in the open: cookies, Mimi, and disguised Mimi. Furniture
  and stairs are safe.
- On even nights and from night 5 the lights go out now and then, and Gertie
  can only see as far as her lantern.

Score: cookies 10 (golden 50), close calls 25, sunrise 100 x night. After a
catch you can wriggle free for 50 coins, then 100.

## Shared profile

Coins and best scores go through `shared/kq-profile` (game id `mimic-manor`).
"Move profile" on the menu shows a code to carry the profile to another app.

## Run it

From the repo root:

```
npx http-server -p 8080 .
```

then open http://localhost:8080/games/mimic-manor/. It's laid out for a phone
held upright; landscape works but the house is small.

## Package it

`./build.sh` copies the game and the shared profile into `dist/` with the
script path rewritten, ready to drop into a Capacitor or other WebView shell.

## Test it

`npm test` runs a headless Playwright smoke test on a 390x844 touch screen:
real taps to walk, hide and disguise, a reachability check on 200 random
houses, simulated nights for every seeker line-up, the sunrise and caught
flows, and screenshots in `tests/screens/`.

## Files

- `index.html`, `style.css`: menu, night cards, HUD
- `game.js`: house generation, path finding, seeker AI, game loop, rendering
- `art.js`: furniture, props, Mimi and seekers drawn with canvas paths
- `audio.js`: Web Audio sounds (unlocked on first touch for iPhone Safari)
