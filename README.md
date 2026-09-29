# NOVA – Play-money minigames

A static, dependency-free web app in a dark violet casino-lobby style with nine games:
**Candy Burst (6×5 tumbling slot), Blackjack (3D table), Mines, Coin Flip, Tower, Chicken, Plinko, Dice, Upgrader.**

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
- Payouts target ~96% RTP (Coin Flip is a flat 2× on a 50/50). Candy Burst's odds live in `js/games/slot-engine.js`, which also runs in Node, so its RTP can be re-checked by simulating spins with `spin()` / `playBonus()` (≈95.4% over 600k spins; the 115× bonus buy returns ≈95%).
- Blackjack: 6-deck shoe (reshuffled at the cut card), dealer stands on all 17s, blackjack pays 3:2, insurance 2:1, double on any two, split up to four hands; Perfect Pairs and 21+3 side bets. The table is pure CSS 3D (no WebGL).
- Structure: `js/core.js` (RNG, wallet, effects, shared UI), `js/sound.js` (sound effects), `js/games/*.js` (one file per game), `js/app.js` (router + home), `css/style.css`.
