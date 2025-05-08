// extract_personnel.js  (node >=18)

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import axios from 'axios';
import * as cheerio from 'cheerio';

const WIKI_API = 'https://en.wikipedia.org/w/api.php';

/* ---------- tiny helpers ---------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const capRE = /^[A-Z][a-z]+(?: [A-Z][a-z]+)*$/;  // Must be proper case, no numbers or special chars

const commonWords = new Set(['Albums', 'Americana', 'Bass', 'Blessed', 'Captured', 'Departure', 'Discography', 'Eclipse', 'Eminent', 'Escape', 'Evolution', 'Folk', 'France', 'Freedom', 'Frontiers', 'Germany', 'Guitar', 'Infinity', 'Israel', 'Italy', 'Journey', 'Latvia', 'Members', 'Netherlands', 'Next', 'Norway', 'Poppy', 'Revolution', 'Running', 'Spain', 'Sweden', 'Tomato', 'Townes', 'Tron']);

function isValidName(name) {
  // Must be proper case, at least two words, and not in common words list
  return /^[A-Z][a-z]+(?: [A-Z][a-z]+)+$/.test(name) && !commonWords.has(name);
}

/* ---------- search utilities ---------- */
async function wikiSearch(q) {
  const res = await axios.get(WIKI_API, { params: { action:'query', list:'search', srsearch:q, format:'json', srlimit:4 }});
  return res.data.query.search;
}

async function wikiHTML(pageid) {
  const res = await axios.get(WIKI_API, { params: { action:'parse', pageid, prop:'text', format:'json' }});
  return cheerio.load(res.data.parse.text['*']);
}

/* ---------- core extractor ---------- */
async function relatedArtists(track, artist, album) {
  let relAlbum = new Set(), relOther = new Set();

  /* pass 1 – album page */
  const albumResults = await wikiSearch(`"${album}" album ${artist}`);
  
  for (const result of albumResults) {
    // Skip if it looks like a tribute album or compilation
    if (result.title.toLowerCase().includes('tribute') || 
        result.title.toLowerCase().includes('compilation')) {
      continue;
    }

    const $ = await wikiHTML(result.pageid);
    
    // Check if it's really an album page
    const hasTrackListing = $('h2:contains("Track listing")').length > 0;
    if (!hasTrackListing) continue;

    // Grab all names from Personnel section
    $('h2:contains("Personnel"), h3:contains("Personnel")').nextUntil('h2,h3').each((_,el)=>{
      const txt = $(el).text();
      (txt.match(capRE)||[]).forEach(n=> isValidName(n)&&relAlbum.add(n));
    });

    if(relAlbum.size) break;      // good enough, stop after first solid album hit
    await sleep(500);
  }

  /* pass 2 – artist page */
  const artistResults = await wikiSearch(`"${artist}" musician OR band`);
  if (artistResults.length > 0) {
    const $ = await wikiHTML(artistResults[0].pageid);
    $('p,li').each((_,el)=>{
      ($(el).text().match(capRE)||[]).forEach(n=> isValidName(n)&&relOther.add(n));
    });
  }

  return {
    relatedArtistsAlbum : [...relAlbum].sort(),
    relatedArtistsOther : [...relOther].filter(n=>!relAlbum.has(n)).sort()
  };
}

/* ---------- wire‑up CSV ---------- */
function loadSongs(csvPath){
  const raw = fs.readFileSync(csvPath,'utf-8');
  return parse(raw,{columns:true}).slice(0,10)
           .map(r=>({ track:r['Track Name'], artist:r['Main Artist'], album:r['Album'] }));
}

(async ()=>{
  const results = [];
  const csvPath = new URL('../data/processed/songs_with_links_albums.csv', import.meta.url);
  for (const s of loadSongs(csvPath)){
    const res = await relatedArtists(s.track, s.artist, s.album);
    console.log(`${s.track} – ${s.artist}`);
    console.log('album  ➜', res.relatedArtistsAlbum);
    console.log('other  ➜', res.relatedArtistsOther, '\n');
    
    // Add to results array
    results.push({
      'Track Name': s.track,
      'Main Artist': s.artist,
      'Album': s.album,
      'Album Related Artists': res.relatedArtistsAlbum.join('; '),
      'Other Related Artists': res.relatedArtistsOther.join('; ')
    });
  }
  
  // Write results to CSV
  const csvContent = results.map(row => 
    Object.values(row).map(value => `"${value}"`).join(',')
  ).join('\n');
  
  const headers = Object.keys(results[0]).join(',');
  const outputPath = new URL('../data/processed/related_artists_results.csv', import.meta.url);
  fs.writeFileSync(outputPath, headers + '\n' + csvContent);
  console.log(`\nResults have been saved to: ${outputPath}`);
})();
