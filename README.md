# NOVA – Free play-money casino

A static, dependency-free web app in a dark violet casino-lobby style with eleven games:
**Crash (rocket), Bonbon Blast 2500 (candy slot with bonus buys & special bets), Candy Burst (6×5 tumbling slot), Blackjack (3D table), Mines, Coin Flip, Tower, Chicken, Plinko, Dice, Upgrader.**

Visitors land on a start page with a live Crash preview. To play they must create an account with
**Google or Discord**. Every account has its own coin balance, inventory and stats and can claim
**1,000 free coins once per hour** (the first claim is ready right after sign-up).
Coins are play money: they have no real-world value and cannot be bought or cashed out.

## Sign-in setup

Put your OAuth client IDs in `js/config.js`:

- **Google** – Google Cloud console → APIs & Services → Credentials → *OAuth client ID* (Web application).
  Add your site origin (e.g. `http://localhost:8000`, `https://your-site.com`) under *Authorized JavaScript origins*.
- **Discord** – <https://discord.com/developers/applications> → your app → OAuth2 → add the exact page URL
  (e.g. `http://localhost:8000/`) as a redirect. Sign-in uses the implicit grant (`identify email` scopes).

While a client ID is empty, that button creates a local *demo* account instead, so the site still works out of the box.

## Run

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

## Notes

- Accounts, balances and the hourly claim timer are stored in the browser (`localStorage`, key `nova.accounts.v1`). There is no server, so a determined user can edit them; for tamper-proof balances and claim limits you'd need a backend that verifies the Google/Discord token and keeps the wallet.
- Crash: `P(crash ≥ x) = 0.96 / x`, so every cash-out target returns 96% (checked by simulation). The multiplier grows as `e^(0.00009·t)` (2× ≈ 7.7 s, 10× ≈ 26 s), max 10,000×. Auto cash-out, auto-play, space-bar control; the canvas scene (stars, curve, rocket, smoke, explosion) lives in `js/games/crash.js` as `Nova.crashScene` and also powers the start-page preview.
- Outcomes are drawn with `crypto.getRandomValues` in the browser. There is no server, so this is a demo, not a tamper-proof setup.
- All sounds are synthesized live with the Web Audio API (no audio files); the speaker button in the top bar mutes them.
- Payouts target ~96% RTP (Coin Flip is a flat 2× on a 50/50). Candy Burst's odds live in `js/games/slot-engine.js`, which also runs in Node, so its RTP can be re-checked by simulating spins with `spin()` / `playBonus()` (≈94% over 1.5M spins; the 115× bonus buy returns ≈95%).
- Bonbon Blast 2500: logic in `js/games/bonbon-engine.js` (also runs in Node). Rainbow bombs 2×–100×, gold bombs 250×–2500×, max win 25,000×. Each option was tuned by simulation:
  standard spin ≈95.8% · Double Chance (1.25×) ≈96.2% · Bomb Rush (5×) ≈95.6% · Gold Rush (50×) ≈97.8% (very high variance) · Lolly Hunt (44×) ≈96.7% ·
  Free Spins buy (100×) ≈95.3% · Super Free Spins (500×) ≈96.2% · Mega Free Spins (2000×) ≈96.3%.
- Blackjack: 6-deck shoe (reshuffled at the cut card), dealer stands on all 17s, blackjack pays 3:2, insurance 2:1, double on any two, split up to four hands; Perfect Pairs and 21+3 side bets. The table is pure CSS 3D (no WebGL).
- Structure: `js/config.js` (OAuth client IDs), `js/core.js` (RNG, wallet, effects, shared UI), `js/auth.js` (Google/Discord sign-in, accounts), `js/sound.js` (sound effects), `js/games/*.js` (one file per game), `js/app.js` (router, start page, lobby, account menu), `css/style.css`.
