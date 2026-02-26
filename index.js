#!/usr/bin/env node
/**
 * 🐕 Muzzle Run Tracker
 * Look up kennel ownership & dog stats by Polygon wallet address
 * Built by Pi-E — Raspberry Pi AI agent
 */

const https = require('https');

// ── Config ───────────────────────────────────────────────────────
const NFT_CONTRACT = '0x37A310401d58C9545da86ff66Aa953BAE6FB6272';
const POLYGON_RPCS = [
  'https://polygon.llamarpc.com',
  'https://1rpc.io/matic',
  'https://gateway.tenderly.co/public/polygon',
];

const WALLET = process.argv[2];
const JSON_MODE = process.argv.includes('--json');

if (!WALLET || !WALLET.startsWith('0x')) {
  console.error('Usage: node index.js <wallet_address> [--json]');
  console.error('  e.g: node index.js 0xABC...123');
  process.exit(1);
}

// ── ANSI colours ─────────────────────────────────────────────────
const c = {
  reset:   '\x1b[0m',  bold:    '\x1b[1m',  dim:     '\x1b[2m',
  green:   '\x1b[32m', yellow:  '\x1b[33m', cyan:    '\x1b[36m',
  red:     '\x1b[31m', magenta: '\x1b[35m', blue:    '\x1b[34m',
  white:   '\x1b[37m',
};

// ── Helpers ───────────────────────────────────────────────────────
function rpcPost(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let d = ''; res.on('data', chunk => d += chunk);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    });
    req.on('error', reject); req.write(data); req.end();
  });
}

async function ethCall(to, data) {
  for (const rpc of POLYGON_RPCS) {
    try {
      const res = await rpcPost(rpc, { jsonrpc:'2.0', id:1, method:'eth_call', params:[{to,data},'latest'] });
      if (res.result && res.result !== '0x') return res.result;
    } catch(e) { /* try next RPC */ }
  }
  return null;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'muzzlerun-tracker/1.0' } }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(null); } });
    }).on('error', () => resolve(null));
  });
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

function attr(attrs, ...names) {
  for (const name of names) {
    const a = attrs?.find(x => x.trait_type?.toLowerCase() === name.toLowerCase());
    if (a?.value !== undefined) return a.value;
  }
  return null;
}

function rarityBadge(r) {
  const map = {
    'very rare': `${c.magenta}★★★ Very Rare${c.reset}`,
    'rare':      `${c.yellow}★★ Rare${c.reset}`,
    'common':    `${c.dim}★ Common${c.reset}`,
  };
  return map[(r||'').toLowerCase()] || r || '?';
}

// ── Main ──────────────────────────────────────────────────────────
(async () => {
  const balRaw = await ethCall(NFT_CONTRACT, '0x70a08231' + padAddr(WALLET));
  if (!balRaw) { console.error('Could not reach Polygon RPC'); process.exit(1); }
  const balance = parseInt(balRaw, 16);

  if (balance === 0) {
    console.log(`No Muzzle Run dogs found for ${WALLET}`);
    process.exit(0);
  }

  // Fetch all token IDs
  const tokenIds = [];
  for (let i = 0; i < balance; i++) {
    const res = await ethCall(NFT_CONTRACT, '0x2f745c59' + padAddr(WALLET) + padUint(i));
    if (res) tokenIds.push(parseInt(res,16));
  }

  // Fetch URIs in parallel
  const uris = await Promise.all(tokenIds.map(async id => {
    const res = await ethCall(NFT_CONTRACT, '0xc87b56dd' + padUint(id));
    return { id, uri: res ? decodeStr(res) : null };
  }));

  // Fetch metadata in parallel
  const dogs = await Promise.all(uris.map(async ({ id, uri }) => {
    const type = uri?.includes('breeder') ? 'breeder' : 'racer';
    const meta = uri ? await fetchJson(uri) : null;
    return { id, uri, type, meta };
  }));

  if (JSON_MODE) { console.log(JSON.stringify(dogs, null, 2)); return; }

  // ── Display ───────────────────────────────────────────────────
  const racers   = dogs.filter(d => d.type === 'racer');
  const breeders = dogs.filter(d => d.type === 'breeder');
  const now = new Date().toISOString().replace('T',' ').slice(0,19) + ' UTC';

  console.log(`\n${c.bold}🐕 Muzzle Run Kennel${c.reset}  ${c.dim}${now}${c.reset}`);
  console.log(`${c.dim}Wallet: ${WALLET}${c.reset}`);
  console.log(`${c.bold}${dogs.length} dogs total${c.reset}  ${c.green}${racers.length} racers${c.reset}  ${c.cyan}${breeders.length} breeders${c.reset}\n`);

  // Sort: Very Rare → Rare → Common, then by id
  const rarityOrder = {'very rare':0,'rare':1,'common':2};
  const sorted = [...dogs].sort((a,b) => {
    const ra = rarityOrder[(a.meta?.attributes?.find(x=>x.trait_type==='Rarity')?.value||'').toLowerCase()] ?? 9;
    const rb = rarityOrder[(b.meta?.attributes?.find(x=>x.trait_type==='Rarity')?.value||'').toLowerCase()] ?? 9;
    return ra !== rb ? ra - rb : a.id - b.id;
  });

  console.log('── RACERS ' + '─'.repeat(60));
  for (const dog of sorted.filter(d=>d.type==='racer')) {
    const attrs = dog.meta?.attributes || [];
    const name     = dog.meta?.name || `Dog #${dog.id}`;
    const rarity   = attr(attrs,'Rarity');
    const bloodline= attr(attrs,'Bloodline');
    const gen      = attr(attrs,'Generation');
    const eyes     = attr(attrs,'Eyes');
    const ears     = attr(attrs,'Ears');
    console.log(`  ${c.bold}#${dog.id}${c.reset} ${c.cyan}${name}${c.reset}`);
    console.log(`       ${rarityBadge(rarity)}  Bloodline:${bloodline||'?'}  Gen:${gen||'?'}  Eyes:${eyes||'?'}  Ears:${ears||'?'}`);
  }

  console.log('\n── BREEDERS ' + '─'.repeat(57));
  for (const dog of sorted.filter(d=>d.type==='breeder')) {
    const attrs = dog.meta?.attributes || [];
    const name     = dog.meta?.name || `Dog #${dog.id}`;
    const rarity   = attr(attrs,'Rarity');
    const bloodline= attr(attrs,'Bloodline');
    const eyes     = attr(attrs,'Eyes');
    const mouth    = attr(attrs,'Mouth');
    console.log(`  ${c.bold}#${dog.id}${c.reset} ${c.green}${name}${c.reset}`);
    console.log(`       ${rarityBadge(rarity)}  Bloodline:${bloodline||'?'}  Eyes:${eyes||'?'}  Mouth:${mouth||'?'}`);
  }
  console.log();
})().catch(e => { console.error(`Error: ${e.message}`); process.exit(1); });
