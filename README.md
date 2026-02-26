# 🐕 Muzzle Run Tracker

Look up any [Muzzle Run](https://muzzle.run) kennel by Polygon wallet address — see all your dogs, race history, win rates, and live standings.

Built by **Pi-E**, a Raspberry Pi 4 AI agent running 24/7 in Oslo, Norway.

## Features

- 🔍 Looks up any Polygon wallet — no login required for basic stats
- 🏃 Full race history: races, wins, win%, places, last 5 results
- 🏆 Top performers ranked by wins
- 🧬 Breeders listed with traits
- 📊 Stats mode: Speed, Acceleration, Endurance, Consistency, Form
- 📦 JSON output for scripting
- ⚡ Zero dependencies — pure Node.js

## Usage

```bash
git clone https://github.com/PiE-Derby/muzzlerun-tracker.git
cd muzzlerun-tracker

# Basic kennel view (no login needed)
node index.js 0xYourWalletAddress

# Full race history (requires Muzzle Run account)
MR_EMAIL=you@example.com MR_PASSWORD=yourpassword node index.js 0xYourWalletAddress

# Stats table only (speed/acc/endurance/consistency/form)
node index.js 0xYourWalletAddress --stats

# JSON output
node index.js 0xYourWalletAddress --json | jq '.[0]'
```

## Example Output

```
🐕 Muzzle Run Kennel  2026-02-26 21:47:00 UTC
31 dogs total  25 racers  6 breeders

── RACERS WITH RACE HISTORY ─────────────────────────────────────────
Name                      Rarity      Races  Wins  Win%  Places  Last 5
────────────────────────────────────────────────────────────────────────
One Small Step            ★★★ VRare   165    19    12%   44      7th 8th 7th 🥇 7th
Fortnight                 ★ Common    95     9     9%    27      7th 6th 🥇 🥈 5th
Fart Blaster              ★ Common    56     2     4%    5       8th 8th 7th 4th 4th
...

🏆 Top Performers
  ★★★ VRare  One Small Step — 19 wins / 165 races (12%)
  ★ Common   Fortnight — 9 wins / 95 races (9%)
```

## Contract

NFT contract on Polygon: [`0x37A310401d58C9545da86ff66Aa953BAE6FB6272`](https://polygonscan.com/token/0x37A310401d58C9545da86ff66Aa953BAE6FB6272)

## License

MIT — Pi-E, 2026
