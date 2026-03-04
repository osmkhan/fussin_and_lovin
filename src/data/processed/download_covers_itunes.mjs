// download_covers_itunes.js
// Downloads album covers from the iTunes Search API (free, no API key needed).
// Usage: node --experimental-vm-modules src/data/processed/download_covers_itunes.js
//        (or: node src/data/processed/download_covers_itunes.js if package.json has "type":"module")
//
// Options:
//   --all        Re-download all covers (default: only missing ones)
//   --dry-run    Print what would be downloaded without saving

import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import sharp from 'sharp';

const SONGS_JSON = new URL('../songs_cleaned.json', import.meta.url).pathname;
const OUTPUT_DIR = new URL('../../../../public/covers', import.meta.url).pathname;
const ITUNES_API = 'https://itunes.apple.com/search';

const args = process.argv.slice(2);
const ALL_MODE = args.includes('--all');
const DRY_RUN = args.includes('--dry-run');

await fs.mkdir(OUTPUT_DIR, { recursive: true });

function safeName(songId, album) {
  return `${songId}_${album.replace(/[^a-z0-9]/gi, '_')}.png`;
}

function artworkUrl(url100) {
  // iTunes returns 100x100 artwork; swap for 600x600
  return url100.replace('100x100bb', '600x600bb');
}

async function searchItunes(albumName, artistName) {
  // Try album + artist first, then just album
  const queries = [
    `${albumName} ${artistName}`,
    albumName,
  ];

  for (const term of queries) {
    try {
      const { data } = await axios.get(ITUNES_API, {
        params: { term, entity: 'album', media: 'music', limit: 10 },
        timeout: 10000,
      });

      if (!data.results?.length) continue;

      // Score results by how closely they match album name and artist
      const albumLow = albumName.toLowerCase();
      const artistLow = artistName.toLowerCase().split(/[&,]/)[0].trim(); // primary artist

      const scored = data.results
        .filter(r => r.artworkUrl100)
        .map(r => {
          const rAlbum = (r.collectionName || '').toLowerCase();
          const rArtist = (r.artistName || '').toLowerCase();
          let score = 0;
          if (rAlbum === albumLow) score += 20;
          else if (rAlbum.includes(albumLow) || albumLow.includes(rAlbum)) score += 10;
          if (rArtist.includes(artistLow) || artistLow.includes(rArtist)) score += 15;
          return { score, url: artworkUrl(r.artworkUrl100), album: r.collectionName, artist: r.artistName };
        })
        .sort((a, b) => b.score - a.score);

      if (scored.length && scored[0].score > 0) {
        return scored[0];
      }
    } catch (err) {
      console.log(`  iTunes request failed for "${term}": ${err.message}`);
    }
  }
  return null;
}

async function downloadCover(url, outPath) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 15000,
    validateStatus: s => s === 200,
  });
  if (!response.data || response.data.length < 1000) {
    throw new Error(`Response too small (${response.data?.length ?? 0} bytes)`);
  }
  await sharp(response.data)
    .resize(500, 500, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toFile(outPath);
  const stat = await fs.stat(outPath);
  if (stat.size < 1000) throw new Error(`Output file too small (${stat.size} bytes)`);
  return stat.size;
}

// ── main ──────────────────────────────────────────────────────────────────────
const songs = JSON.parse(await fs.readFile(SONGS_JSON, 'utf8'));

// Build map: normalized album → { number (earliest), album, artist }
const albumMap = {};
for (const s of songs) {
  const norm = s.album?.toLowerCase().trim();
  if (!norm) continue;
  if (!albumMap[norm] || s.number < albumMap[norm].number) {
    albumMap[norm] = { number: s.number, album: s.album, artist: s.artist };
  }
}

const albums = Object.values(albumMap).sort((a, b) => a.number - b.number);
console.log(`Total unique albums: ${albums.length}`);

let downloaded = 0, skipped = 0, failed = 0;

for (const { number, album, artist } of albums) {
  const filename = safeName(number, album);
  const outPath = path.join(OUTPUT_DIR, filename);

  // Skip existing unless --all
  if (!ALL_MODE) {
    try {
      await fs.access(outPath);
      skipped++;
      continue;
    } catch {
      // file doesn't exist → proceed
    }
  }

  if (DRY_RUN) {
    console.log(`[DRY] Would fetch: "${album}" by "${artist}" → ${filename}`);
    continue;
  }

  process.stdout.write(`[${number}] "${album}" (${artist}) … `);

  const result = await searchItunes(album, artist);
  if (!result) {
    console.log('✗ not found on iTunes');
    failed++;
    continue;
  }

  try {
    const size = await downloadCover(result.url, outPath);
    console.log(`✓ ${result.album} / ${result.artist} (${size} bytes)`);
    downloaded++;
  } catch (err) {
    console.log(`✗ download failed: ${err.message}`);
    failed++;
    // clean up partial file
    await fs.unlink(outPath).catch(() => {});
  }

  // Be polite to iTunes API – small delay between requests
  await new Promise(r => setTimeout(r, 300));
}

console.log(`\nDone. Downloaded: ${downloaded}, Skipped (existing): ${skipped}, Failed: ${failed}`);
