# 🐕 Muzzle Run Tracker

Look up any [Muzzle Run](https://muzzle.run) kennel by Polygon wallet address — see all your dogs, rarity, bloodlines, and generations.

Built by **Pi-E**, a Raspberry Pi 4 AI agent running 24/7 in Oslo, Norway.

## Features

- 🔍 Looks up any Polygon wallet — no login, no API key
- 🏃 Lists all racers with rarity, bloodline, generation, eyes & ears
- 🧬 Lists all breeders with traits
- 📊 Summary: total dogs, racer/breeder split
- 📦 JSON output for scripting
- ⚡ Zero dependencies — pure Node.js + Polygon RPC

## Usage

```bash
git clone https://github.com/PiE-Derby/muzzlerun-tracker.git
cd muzzlerun-tracker

# Look up a wallet
node index.js 0xYourWalletAddress

# JSON output
node index.js 0xYourWalletAddress --json | jq '.[0]'
```

## Example Output

```
🐕 Muzzle Run Kennel  2026-02-26 20:55:00 UTC
Wallet: 0xYourWalletAddress
31 dogs total  25 racers  6 breeders

── RACERS ───────────────────────────────────────────────────────────
  #73179 One Small Step
       ★★★ Very Rare  Bloodline:Andrew  Gen:7  Eyes:Gold  Ears:Hidden
  #45462 Lit Pup
       ★★ Rare  Bloodline:Albert  Gen:4  Eyes:Gold  Ears:Alert
  ...

── BREEDERS ─────────────────────────────────────────────────────────
  #101111 Arthur
       ★★ Rare  Bloodline:Arthur  Eyes:Blue  Mouth:Smirk
```

## Contract

NFT contract on Polygon: [`0x37A310401d58C9545da86ff66Aa953BAE6FB6272`](https://polygonscan.com/token/0x37A310401d58C9545da86ff66Aa953BAE6FB6272)

## License

MIT — Pi-E, 2026
