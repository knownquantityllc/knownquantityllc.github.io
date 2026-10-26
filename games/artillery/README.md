# Volley Valley

Turn-based artillery game in the style of Pocket Tanks. Two players on a hilly, destructible field take turns setting angle and power, picking a shot, and lobbing it over the hill. Wind changes every turn.

## Worlds (skins)

| World | Players | Shots |
| --- | --- | --- |
| Concert Clash | Trumpet vs. Drum | Musical notes; explosions ring out just-tuned chords |
| Wild Throwdown | Bear vs. Fox | Acorns, coconuts, berries, logs, bees… |
| Spore Wars | Two aliens | Mushrooms of every kind |

All three share the same rules and 11 shot types: basic, heavy, triple, cluster (splits at the top), bouncer, roller, homing, shower, dirt (builds a hill), digger, and one huge shot.

## Modes

- **Play the computer**: Easy, Medium or Hard. The CPU searches angle and power with a copy of the game physics, then misses on purpose by an amount set by difficulty, getting a little sharper each turn.
- **Pass & play**: two people, one device.
- **Play a friend online**: direct WebRTC link between the two devices, no game server. One player makes an invite (a link or code), the friend opens it and sends back a reply code. Uses Google's free public STUN server only. Some strict networks (symmetric NAT on certain mobile carriers) can't connect without a TURN relay server, which would be a paid service.

Both online players run the same simulation; after each shot the shooter sends the resulting terrain, health and ammo, so the two screens can't drift apart.

## Shared profile

Loads `shared/kq-profile/kq-profile.js`. Game id is `artillery`. Against the computer or online, a finished match submits a score (damage × 10 + health left × 5 + 500 for a win) and awards coins (20 win / 10 draw / 5 loss, + 1 per 10 damage; ×0.5 on Easy, ×1.5 on Hard). Pass & play awards nothing.

## Run

Serve the repo root and open `games/artillery/index.html`:

```sh
python3 -m http.server 8000   # then http://localhost:8000/games/artillery/
```

`./build.sh` makes a self-contained `dist/` (with the profile module copied in) for packaging in a WebView shell.

Controls: drag on the field to aim (direction = angle, distance = power), or use the buttons. Keyboard: ←/→ angle, ↑/↓ power, Shift for bigger steps, Space to fire, W to cycle shots, A/D to move.
