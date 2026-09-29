# NOVA – Play-money minigames

A static, dependency-free web app in a dark violet casino-lobby style with seven minigames:
**Mines, Coin Flip, Tower, Chicken, Plinko, Dice, Upgrader.**

Everything runs on *credit tokens* (play money, 1,000 to start, saved in `localStorage`).
Tokens have no real-world value and cannot be bought or cashed out.

## Run

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

## Notes

- Outcomes are drawn with `crypto.getRandomValues` in the browser. There is no server, so this is a demo, not a tamper-proof setup.
- All sounds are synthesized live with the Web Audio API (no audio files); the speaker button in the top bar mutes them.
- Payouts target ~96% RTP (Coin Flip is a flat 2× on a 50/50).
- Structure: `js/core.js` (RNG, wallet, effects, shared UI), `js/sound.js` (sound effects), `js/games/*.js` (one file per game), `js/app.js` (router + home), `css/style.css`.
