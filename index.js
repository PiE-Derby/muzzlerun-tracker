#!/usr/bin/env node
/**
 * 🐕 Muzzle Run Tracker
 * Look up kennel ownership, stats & race history by Polygon wallet address
 * Built by Pi-E — Raspberry Pi AI agent
 *
 * Usage:
 *   node index.js <wallet_address>            # full stats + race history
 *   node index.js <wallet_address> --json     # JSON output
 *   node index.js <wallet_address> --stats    # stats table only (no race history)
 */

const https = require('https');

// ── Config ────────────────────────────────────────────────────────
const NFT_CONTRACT  = '0x37A310401d58C9545da86ff66Aa953BAE6FB6272';
const POLYGON_RPCS  = [
  'https://polygon.llamarpc.com',
  'https://1rpc.io/matic',
  'https://gateway.tenderly.co/public/polygon',
];
const FIREBASE_API_KEY = 'AIzaSyDD5cvEcBdLt85H43K1FhbaQdQWjZChDZs';
const FIREBASE_EMAIL   = process.env.MR_EMAIL    || '';
const FIREBASE_PASS    = process.env.MR_PASSWORD  || '';
const STATS_FN = 'https://us-central1-metahounds-59f97.cloudfunctions.net/getLatestHoundStats';
const AUTH_URL  = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;

const WALLET    = process.argv[2];
const JSON_MODE = process.argv.includes('--json');
const STATS_ONLY = process.argv.includes('--stats');

if (!WALLET || !WALLET.startsWith('0x')) {
  console.error('Usage: node index.js <wallet_address> [--json] [--stats]');
  console.error('  e.g: node index.js 0xABC...123');
  console.error('\nFor race history, set env vars: MR_EMAIL and MR_PASSWORD');
  process.exit(1);
}

// ── ANSI colours ──────────────────────────────────────────────────
const c = {
  reset:'\x1b[0m', bold:'\x1b[1m', dim:'\x1b[2m',
  gold:'\x1b[33m', magenta:'\x1b[35m', green:'\x1b[32m',
  cyan:'\x1b[36m', red:'\x1b[31m', blue:'\x1b[34m',
};

// ── HTTP helpers ──────────────────────────────────────────────────
function post(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers }
    }, res => { let d = ''; res.on('data', chunk => d += chunk); res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } }); });
    req.on('error', reject); req.write(data); req.end();
  });
}

function getJson(url, headers = {}) {
  return new Promise(resolve => {
    const u = new URL(url);
    https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': 'muzzlerun-tracker/1.0', ...headers } },
      res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(null); } }); }
    ).on('error', () => resolve(null));
  });
}

async function ethCall(to, data) {
  for (const rpc of POLYGON_RPCS) {
    try {
      const res = await post(rpc, { jsonrpc:'2.0', id:1, method:'eth_call', params:[{to,data},'latest'] });
      if (res.result && res.result !== '0x') return res.result;
    } catch(e) {}
  }
  return null;
}

const padAddr = a => a.replace('0x','').padStart(64,'0');
const padUint  = n => BigInt(n).toString(16).padStart(64,'0');

function decodeStr(hex) {
  try {
    const raw = hex.replace('0x','');
    const off = parseInt(raw.slice(0,64),16)*2;
    const len = parseInt(raw.slice(off,off+64),16)*2;
    return Buffer.from(raw.slice(off+64,off+64+len),'hex').toString('utf8');
  } catch(e) { return null; }
}

function attr(attrs, name) {
  return attrs?.find(x => x.trait_type === name)?.value ?? null;
}

function winRate(wins, races) {
  if (!races) return '─';
  return `${Math.round(wins/races*100)}%`;
}

function formatLast5(last5) {
  if (!last5) return '─────';
  const medals = { '1':'🥇','2':'🥈','3':'🥉' };
  return last5.split('').map(n => medals[n] || `${n}th`).join(' ');
}

function rarityBadge(r) {
  const map = { 'Very Rare':`${c.magenta}★★★ VRare${c.reset}`, 'Rare':`${c.gold}★★ Rare${c.reset}`, 'Common':`${c.dim}★ Common${c.reset}` };
  return map[r] || r || '?';
}

// ── Firebase auth ─────────────────────────────────────────────────
async function getFirebaseToken() {
  if (!FIREBASE_EMAIL || !FIREBASE_PASS) return null;
  try {
    const res = await post(AUTH_URL, { email: FIREBASE_EMAIL, password: FIREBASE_PASS, returnSecureToken: true });
    return res.idToken || null;
  } catch(e) { return null; }
}

async function getRaceStats(gameId, token) {
  if (!token) return null;
  try {
    const res = await post(STATS_FN, { data: { id: String(gameId), type: 'racer' } }, { Authorization: `Bearer ${token}` });
    return res?.result?.hound || null;
  } catch(e) { return null; }
}

// ── Main ──────────────────────────────────────────────────────────
(async () => {
  const balRaw = await ethCall(NFT_CONTRACT, '0x70a08231' + padAddr(WALLET));
  if (!balRaw) { console.error('Could not reach Polygon RPC'); process.exit(1); }
  const balance = parseInt(balRaw, 16);

  if (balance === 0) { console.log(`No Muzzle Run dogs found for ${WALLET}`); process.exit(0); }

  // Fetch all token IDs + URIs
  const dogs = [];
  for (let i = 0; i < balance; i++) {
    const res = await ethCall(NFT_CONTRACT, '0x2f745c59' + padAddr(WALLET) + padUint(i));
    if (!res) continue;
    const tokenId = parseInt(res, 16);
    const uriRes  = await ethCall(NFT_CONTRACT, '0xc87b56dd' + padUint(tokenId));
    const uri     = uriRes ? decodeStr(uriRes) : null;
    const type    = uri?.includes('breeder') ? 'breeder' : 'racer';
    const gameId  = uri?.match(/id=(\d+)/)?.[1] ?? tokenId;
    dogs.push({ tokenId, gameId: String(gameId), uri, type });
  }

  const racers   = dogs.filter(d => d.type === 'racer');
  const breeders = dogs.filter(d => d.type === 'breeder');

  // Fetch metadata
  const withMeta = await Promise.all(dogs.map(async d => {
    const meta = d.uri ? await getJson(d.uri) : null;
    return { ...d, meta };
  }));

  if (JSON_MODE && STATS_ONLY) { console.log(JSON.stringify(withMeta, null, 2)); return; }

  // Optionally fetch race stats
  let token = null;
  if (!STATS_ONLY) {
    token = await getFirebaseToken();
    if (!token && !JSON_MODE) {
      console.log(`${c.dim}ℹ Race history unavailable — set MR_EMAIL and MR_PASSWORD env vars${c.reset}`);
    }
  }

  const withStats = await Promise.all(withMeta.map(async d => {
    const stats = (d.type === 'racer' && token) ? await getRaceStats(d.gameId, token) : null;
    return { ...d, stats };
  }));

  if (JSON_MODE) { console.log(JSON.stringify(withStats, null, 2)); return; }

  // ── Display ───────────────────────────────────────────────────
  const now = new Date().toISOString().replace('T',' ').slice(0,19) + ' UTC';
  console.log(`\n${c.bold}🐕 Muzzle Run Kennel${c.reset}  ${c.dim}${now}${c.reset}`);
  console.log(`${c.dim}Wallet: ${WALLET}${c.reset}`);
  console.log(`${c.bold}${dogs.length} dogs total${c.reset}  ${c.green}${racers.length} racers${c.reset}  ${c.cyan}${breeders.length} breeders${c.reset}\n`);

  const rarityOrder = {'Very Rare':0,'Rare':1,'Common':2};
  const racersSorted = withStats
    .filter(d => d.type === 'racer')
    .sort((a,b) => {
      const ra = rarityOrder[attr(a.meta?.attributes,'Rarity')] ?? 9;
      const rb = rarityOrder[attr(b.meta?.attributes,'Rarity')] ?? 9;
      if (ra !== rb) return ra - rb;
      return (b.stats?.wins||0) - (a.stats?.wins||0);
    });

  if (token) {
    // Full table with race history
    console.log('── RACERS WITH RACE HISTORY ' + '─'.repeat(57));
    console.log(`${'Name'.padEnd(26)}${'Rarity'.padEnd(12)}${'Races'.padEnd(7)}${'Wins'.padEnd(6)}${'Win%'.padEnd(6)}${'Places'.padEnd(8)}Last 5`);
    console.log('─'.repeat(88));

    let totalRaces = 0, totalWins = 0, totalPlaces = 0;
    for (const d of racersSorted) {
      const attrs  = d.meta?.attributes || [];
      const rarity = attr(attrs,'Rarity') || '?';
      const name   = (d.meta?.name || `#${d.tokenId}`).slice(0,25);
      const { races=0, wins=0, places=0, last5='' } = d.stats || {};
      totalRaces += races; totalWins += wins; totalPlaces += places;
      const col = rarity==='Very Rare' ? c.magenta : rarity==='Rare' ? c.gold : c.dim;
      const wCol = wins > 0 ? c.green : '';
      console.log(
        `${name.padEnd(26)}${col}${rarity.padEnd(12)}${c.reset}` +
        `${String(races).padEnd(7)}${wCol}${String(wins).padEnd(6)}${c.reset}` +
        `${winRate(wins,races).padEnd(6)}${String(places).padEnd(8)}${formatLast5(last5)}`
      );
    }
    console.log('─'.repeat(88));
    console.log(`${'TOTAL'.padEnd(38)}${totalRaces.toString().padEnd(7)}${totalWins.toString().padEnd(6)}${winRate(totalWins,totalRaces).padEnd(6)}${totalPlaces}`);

    // Best performers
    const withRaces = racersSorted.filter(d => (d.stats?.races||0) > 0);
    if (withRaces.length) {
      console.log(`\n${c.bold}🏆 Top Performers${c.reset}`);
      const top = [...withRaces].sort((a,b) => (b.stats.wins||0)-(a.stats.wins||0)).slice(0,5);
      for (const d of top) {
        const name = d.meta?.name || `#${d.tokenId}`;
        const rarity = attr(d.meta?.attributes,'Rarity')||'Common';
        console.log(`  ${rarityBadge(rarity)}  ${c.bold}${name}${c.reset} — ${d.stats.wins} wins / ${d.stats.races} races (${winRate(d.stats.wins,d.stats.races)})`);
      }
      const unraced = racersSorted.filter(d => !(d.stats?.races));
      if (unraced.length) console.log(`\n  ${c.dim}${unraced.length} dogs have never raced${c.reset}`);
    }
  } else {
    // Stats only (no race history)
    console.log('── RACERS (stats only — set MR_EMAIL + MR_PASSWORD for race history) ' + '─'.repeat(10));
    console.log(`${'Name'.padEnd(26)}${'Rarity'.padEnd(12)}${'Gen'.padEnd(5)}${'Spd'.padEnd(5)}${'Acc'.padEnd(5)}${'End'.padEnd(5)}${'Con'.padEnd(5)}Form`);
    console.log('─'.repeat(72));
    for (const d of racersSorted) {
      const attrs = d.meta?.attributes || [];
      const rarity= attr(attrs,'Rarity') || '?';
      const name  = (d.meta?.name || `#${d.tokenId}`).slice(0,25);
      const col   = rarity==='Very Rare' ? c.magenta : rarity==='Rare' ? c.gold : c.dim;
      console.log(
        `${name.padEnd(26)}${col}${rarity.padEnd(12)}${c.reset}` +
        `${String(attr(attrs,'Generation')||'?').padEnd(5)}${String(attr(attrs,'Speed')||'?').padEnd(5)}` +
        `${String(attr(attrs,'Acceleration')||'?').padEnd(5)}${String(attr(attrs,'Endurance')||'?').padEnd(5)}` +
        `${String(attr(attrs,'Consistency')||'?').padEnd(5)}${attr(attrs,'Form')??'?'}`
      );
    }
  }

  // Breeders
  const breedersSorted = withStats.filter(d => d.type === 'breeder');
  console.log(`\n── BREEDERS ` + '─'.repeat(57));
  for (const d of breedersSorted) {
    const attrs = d.meta?.attributes || [];
    const name  = (d.meta?.name || `#${d.tokenId}`).slice(0,25);
    const rarity= attr(attrs,'Rarity') || '?';
    const blood = attr(attrs,'Bloodline') || '?';
    const eyes  = attr(attrs,'Eyes') || '?';
    const mouth = attr(attrs,'Mouth') || '?';
    console.log(`  ${rarityBadge(rarity)}  ${c.bold}#${d.tokenId} ${name}${c.reset}  Bloodline:${blood}  Eyes:${eyes}  Mouth:${mouth}`);
  }
  console.log();
})().catch(e => { console.error(`Error: ${e.message}`); process.exit(1); });
