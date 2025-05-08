// debug_extractor.js
import fs from 'fs/promises';
import axios from 'axios';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import * as cheerio from 'cheerio';

const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const INPUT_FILE  = 'src/data/processed/songs_with_links_albums.csv';
const OUTPUT_FILE = 'src/data/processed/songs_with_links_albums_enriched.csv';

/* ---------- tiny CSV helpers ---------- */
async function readAllRows(path) {
    const raw = await fs.readFile(path, 'utf8');
    const records = parse(raw, { columns: true, skip_empty_lines: true });
    return records.slice(0, 363);
  }
  async function writeCSV(rows, path) {
    const csv = stringify(rows, { header: true });
    await fs.writeFile(path, csv, 'utf8');
  }
  
  /* ---------- smarter wiki helpers ---------- */
  async function wikiQuery(params) {
    const { data } = await axios.get(WIKI_API, { params: { format: 'json', utf8: 1, ...params } });
    return data;
  }
  async function smartAlbumHit(album, artist) {
    if (!album || album.trim().length < 2) return null;
  
    const wanted = album.toLowerCase();
  
    // grab top 10 results
    const { query } = await wikiQuery({
      action: 'query',
      list:   'search',
      srsearch: `${album} ${artist}`,
      srlimit: 10
    });
  
    // 1️⃣ keep only titles that CONTAIN the album-name text
    const contains = query.search.filter(r =>
      r.title.toLowerCase().includes(wanted)
    );
  
    if (contains.length > 1) {
      // 2️⃣ multiple hits ⇒ prefer one that ends with (album/EP/LP)
      const albumLike = contains.find(r =>
        /\((album|ep|lp)\)$/i.test(r.title)
      );
      return albumLike || contains[0];
    }
  
    // 3️⃣ single match (or none) ⇒ return it or fall back to first overall result
    return (contains[0] || query.search[0]) || null;
  }
  
  
  async function smartArtistHit(artist) {
    const { query } = await wikiQuery({
      action: 'query', list: 'search', srsearch: artist
    });
    const pick = query.search.find(r =>
      r.title.toLowerCase() === artist.toLowerCase()
    ) || query.search.find(r =>
      r.title.toLowerCase().startsWith(`${artist.toLowerCase()} (`) &&
      /(musician|band|singer)/i.test(r.title)
    ) || query.search[0];
    return pick || null;
  }
  async function wikiParse(pageid, prop = 'text', extra = {}) {
    return (await wikiQuery({ action: 'parse', pageid, prop, ...extra })).parse;
  }
  
  /* ---------- Personnel (album) ---------- */
  async function getAlbumPersonnel(pageid) {
    const sections = (await wikiParse(pageid, 'sections')).sections;
    const personnelSec = sections.find(s =>
      /personnel/i.test(s.line) || /personnel/.test(s.anchor)
    );
    if (!personnelSec) return [];
    const html = (await wikiParse(pageid, 'text', { section: personnelSec.index })).text['*'];
    const $ = cheerio.load(html);
    const names = new Set();
    $('ul li').each((_, el) => {
      const txt = $(el).text().trim();
      const m = txt.match(/^([\w .'-]+?)\s[–-]/); // name before dash
      if (m) names.add(m[1].trim());
    });
    return [...names];
  }
  
  /* ---------- Other related artists (artist page) ---------- */
  async function getArtistRelated(pageid) {
    const html = (await wikiParse(pageid, 'text')).text['*'];
    const text = cheerio.load(html).text();
    const names = new Set();
    const rx = /\b([A-Z][a-z]+) ([A-Z][a-z]+)\b/g;
    let m;
    while ((m = rx.exec(text))) names.add(`${m[1]} ${m[2]}`);
    return [...names];
  }
  
  /* ---------- Main ETL ---------- */
  (async () => {
    const rows = await readAllRows(INPUT_FILE);
  
    for (const row of rows) {
      console.log(`Processing ${row['Track Name']} – ${row['Main Artist']}`);
  
      /* --- album wiki + personnel --- */
      const albumHit = await smartAlbumHit(row['Album'], row['Main Artist']);
      const albumPage  = albumHit?.pageid ? `https://en.wikipedia.org/?curid=${albumHit.pageid}` : '';
      const albumNames = albumHit?.pageid ? await getAlbumPersonnel(albumHit.pageid) : [];
      row['Album Wikipedia']         = albumPage;
      row['Related Artists - Album'] = albumNames.join('; ');
  
      /* --- artist wiki + “other” names --- */
      const artistHit = await smartArtistHit(row['Main Artist']);
      const artistPage = artistHit?.pageid ? `https://en.wikipedia.org/?curid=${artistHit.pageid}` : '';
      const otherRaw   = artistHit?.pageid ? await getArtistRelated(artistHit.pageid) : [];
      row['Artist Wikipedia'] = artistPage;
  
      /* --- row-level filter for Related Artists – Other --- */
      const splitMain = row['Main Artist']
        .split(/&| and |\/| feat\.?| featuring /i).map(s => s.trim());
      const allowed = new Set([
        ...splitMain.map(s => s.toLowerCase()),
        ...albumNames.map(a => a.toLowerCase())
      ]);
      const otherFiltered = otherRaw.filter(n => allowed.has(n.toLowerCase()));
      row['Related Artists - Other'] = otherFiltered.join('; ');
    }
  
    await writeCSV(rows, OUTPUT_FILE);
    console.log(`\n✅  Wrote ${OUTPUT_FILE}`);
  })();
  