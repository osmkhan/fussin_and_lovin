// download_album_genres.js
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { parse } from 'csv-parse/sync';

const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const INPUT_CSV = '/Users/osmankhan/Desktop/data/code_projects/fussin_and_lovin/build/songs_albums_entries_fixed.csv';
const OUTPUT_FILE = 'album_genres.json';

/* ---------- helpers ---------- */
async function readRows(file) {
  const raw = await fs.readFile(file, 'utf8');
  return parse(raw, { columns: true, skip_empty_lines: true });
}

async function getPageId(wikiUrl) {
  if (!wikiUrl) return null;
  const match = wikiUrl.match(/curid=(\d+)/);
  return match ? match[1] : null;
}

function cleanGenre(genre) {
  return genre
    // Remove wiki markup
    .replace(/\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g, '$1')
    // Remove HTML tags
    .replace(/<[^>]+>/g, '')
    // Remove ref tags and their content
    .replace(/\{\{ref[^}]*\}\}/g, '')
    .replace(/\{\{cite[^}]*\}\}/g, '')
    // Remove other wiki templates
    .replace(/\{\{[^}]+\}\}/g, '')
    // Remove asterisks and other special characters
    .replace(/[\*\{\}\[\]\<\>]/g, '')
    // Remove multiple spaces
    .replace(/\s+/g, ' ')
    // Trim whitespace
    .trim();
}

function standardizeGenre(genre) {
  // Convert to lowercase for comparison
  const lowerGenre = genre.toLowerCase();
  
  // Common genre mappings
  const genreMap = {
    'alt-country': 'Alternative country',
    'alt country': 'Alternative country',
    'americana': 'Americana',
    'americana (music)': 'Americana',
    'bluegrass': 'Bluegrass',
    'bluegrass (music)': 'Bluegrass',
    'country': 'Country',
    'country music': 'Country',
    'country rock': 'Country rock',
    'folk': 'Folk',
    'folk music': 'Folk',
    'folk rock': 'Folk rock',
    'rock': 'Rock',
    'rock music': 'Rock',
    'rock and roll': 'Rock',
    'roots rock': 'Roots rock',
    'southern rock': 'Southern rock'
  };

  // Check if we have a mapping for this genre
  for (const [key, value] of Object.entries(genreMap)) {
    if (lowerGenre === key) {
      return value;
    }
  }

  // If no mapping found, capitalize first letter of each word
  return genre.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

async function getGenres(pageid, name, isArtist = false) {
  if (!pageid) return null;
  
  // Get the page content
  const { data } = await axios.get(WIKI_API, {
    params: {
      action: 'query',
      pageids: pageid,
      prop: 'revisions',
      rvprop: 'content',
      format: 'json',
      utf8: 1
    }
  });
  
  const page = data.query.pages[pageid];
  if (!page.revisions?.[0]?.['*']) {
    console.log(`No content found for page ID ${pageid}`);
    return null;
  }

  const pageContent = page.revisions[0]['*'];
  
  // Look for genre information in the infobox
  const infoboxMatch = pageContent.match(isArtist ? 
    /\{\{Infobox musical artist[^}]*\}\}/ : 
    /\{\{Infobox album[^}]*\}\}/);
    
  if (!infoboxMatch) {
    console.log(`No infobox found for ${name}`);
    return null;
  }

  const infobox = infoboxMatch[0];
  
  // Extract genres from the infobox - only look at genre/genres fields
  const genreMatch = infobox.match(/\|\s*(?:genre|genres)\s*=\s*([^|}]+)/i);
  if (!genreMatch) {
    console.log(`No genre found in infobox for ${name}`);
    return null;
  }

  // Clean up the genres string
  let genreText = genreMatch[1];
  
  // Handle Hlist and Flatlist templates
  const listMatch = genreText.match(/\{\{(?:Hlist|Flatlist|flat list)\s*\|(.*?)\}\}/i);
  if (listMatch) {
    genreText = listMatch[1];
  }
  
  const genres = genreText
    // Remove other Wikipedia templates
    .replace(/\{\{[^}]+\}\}/g, '')
    // Remove HTML tags
    .replace(/<[^>]+>/g, '')
    // Remove ref tags
    .replace(/\{\{ref[^}]*\}\}/g, '')
    .replace(/\{\{cite[^}]*\}\}/g, '')
    // Remove wiki markup
    .replace(/\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g, '$1')
    // Split on common delimiters
    .split(/[,;|]/)
    // Clean each genre
    .map(g => cleanGenre(g))
    // Remove empty genres, duplicates, and template names
    .filter((g, i, arr) => {
      return g.length > 0 && 
             arr.indexOf(g) === i &&
             !g.match(/^(hlist|flatlist|flat list|solo_singer|group_or_band|person|band|non_vocal_instrumentalist)$/i);
    })
    // Standardize genre names
    .map(g => standardizeGenre(g));

  return genres.length > 0 ? genres : null;
}

/* ---------- main ---------- */
(async () => {
  const rows = await readRows(INPUT_CSV);
  const processedAlbums = new Set();
  const albumGenres = {};

  for (const r of rows) {
    const album = r['Album'];
    const songId = r['Number'];
    
    // Skip if we already processed this album
    if (processedAlbums.has(album)) {
      continue;
    }
    processedAlbums.add(album);

    let genres = null;

    // First try album Wikipedia page
    if (r['Album Wikipedia']) {
      const albumPageId = await getPageId(r['Album Wikipedia']);
      if (albumPageId) {
        genres = await getGenres(albumPageId, album, false);
        if (genres) {
          console.log(`✓  Found genres for ${album} (Song #${songId}) from album page: ${genres.join(', ')}`);
        }
      }
    }

    // If no genres from album page, try artist page
    if (!genres && r['Artist Wikipedia']) {
      const artistPageId = await getPageId(r['Artist Wikipedia']);
      if (artistPageId) {
        genres = await getGenres(artistPageId, r['Artist'], true);
        if (genres) {
          console.log(`✓  Found genres for ${album} (Song #${songId}) from artist page: ${genres.join(', ')}`);
        }
      }
    }

    if (genres) {
      albumGenres[songId] = genres;
    } else {
      console.log(`✗  No genres found for ${album} (Song #${songId})`);
    }
  }

  // Write the genres to a JSON file
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(albumGenres, null, 2));
  console.log(`\nWrote genres for ${Object.keys(albumGenres).length} albums to ${OUTPUT_FILE}`);
})(); 