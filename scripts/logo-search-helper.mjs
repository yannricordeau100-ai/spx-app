// Helper: search Commons + en.wiki for likely logo files, return candidates.
const UA = 'mettrik-logo-audit/1.0 (yann@mettrik.app)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const QUERIES = process.argv.slice(2);

async function searchCommons(q) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srnamespace=6&srlimit=10&srsearch=${encodeURIComponent(q + ' logo')}`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!r.ok) return [];
    const j = await r.json();
    return (j?.query?.search || []).map(s => s.title);
  } catch (e) {
    return [];
  }
}

async function searchEnwiki(q) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srnamespace=6&srlimit=10&srsearch=${encodeURIComponent(q + ' logo')}`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!r.ok) return [];
    const j = await r.json();
    return (j?.query?.search || []).map(s => s.title);
  } catch (e) {
    return [];
  }
}

(async () => {
  const out = {};
  for (const q of QUERIES) {
    await sleep(500);
    const c = await searchCommons(q);
    await sleep(500);
    const e = await searchEnwiki(q);
    out[q] = { commons: c, en: e };
  }
  console.log(JSON.stringify(out, null, 2));
})();
