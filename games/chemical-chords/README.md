# Chemical Chords

Mix real chemicals, watch them react, and hear the music hidden in their light.

Every element gives off light at exact wavelengths (its emission spectrum). The game turns each spectral line into a
tone by dividing the light's frequency by 2^40, which drops it exactly 40 octaves into hearing range and keeps every
interval between the lines intact. Hydrogen's red line (656.28 nm) becomes 415.3 Hz, a G♯4 within a cent.

- **Natural**: each line played as a pure sine at its exact frequency (often between piano keys; close lines beat).
- **Tuned**: lines snapped to the nearest key, the best-fitting key/mode chosen, outliers nudged, four chords picked,
  and a melody played from red to violet. The Dissect screen shows each step.

## What's in it

- 20 elements with lines from the NIST Atomic Spectra Database (`data.js`), 37 chemicals on three shelves
  (Kitchen, School lab at 3 discoveries, Advanced lab at 10), 41 reactions in 10 Codex sections
  (acids and bases, indicators, gas makers, precipitates, metal swaps, complexes, breaking down, fire, flame tests,
  chemiluminescence), plus 8 "nothing happens, and why" notes.
- Luminous reactions (flame tests, sodium in water, burning magnesium, thermite, luminol...) sound like the light they
  give off. Others sound like the atoms in their products, plus a voice for the colour a coloured product absorbs.
- Learn: six short lessons (atoms and light, light into sound, natural vs tuned, colour, equations, safety).
  Hazard notes on every dangerous chemical.

## Links to other apps

- **Jam Jar / Chordfall**: the tuned version is a standard tune code (`tunecode.js`, copied unchanged from those apps).
  In the app builds it opens `jamjar://tune/<code>` / `chordfall://tune/<code>`; on the games site it opens
  `../jam-jar/#tune=<code>`; otherwise it copies the code.
- **Any music app**: Save MIDI (melody, chords, bass on three tracks) or Save natural WAV (the exact tones).
- **KQProfile**: 10 shared coins per new discovery; best score = discoveries (`chemical-chords`).

## Languages

English, Spanish, Simplified Chinese and Russian through `shared/kq-i18n` (picker in the top bar). `i18n.js` holds every
string: the chemistry in `data.js` order, then the screens. English stays in the code; sentences built around values
or tags go through `T`/`F` in `game.js`, plain text is translated as it reaches the page.

## Files

`index.html`, `style.css`, `data.js` (chemistry), `music.js` (light to sound, arrangement, Web Audio, MIDI/WAV),
`fx.js` (canvas visuals), `game.js` (UI), `tunecode.js`, `i18n.js` (translations). `build.sh` makes a self-contained `dist/`.
`node test.js` checks the data and that every reaction makes a valid tune code.
Loads `../../shared/web-audio-unlock.js` first (iPhone silent-switch and audio unlock fixes, same code as the games site).
