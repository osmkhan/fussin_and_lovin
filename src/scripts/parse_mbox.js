/*  parse_mbox.js  – clean ⇢ extract ⇢ CSV  */

import fs from 'fs';
import { simpleParser } from 'mailparser';
import qp from 'quoted-printable';
import iconv from 'iconv-lite';
import { createObjectCsvWriter } from 'csv-writer';

/* ---------- logging ------------------------------------------------------ */

const log = fs.createWriteStream('parse_debug.txt');
const dbg = m => (console.log(m), log.write(m + '\n'));

/* ---------- helpers ------------------------------------------------------ */

const smart = t => t
  .replace(/[""]/g, '"')
  .replace(/['']/g, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/=3D/g, '=')  // Fix quoted-printable encoding
  .replace(/=\r?\n/g, '') // Remove soft line breaks
  .replace(/<[^>]+>/g, ''); // Remove HTML tags

const escapeCsv = s => `"${s.replace(/"/g, '""')}"`;

/* Extract song entries between underscore lines */
function* extractSongBlocks(text) {
  const blocks = text.split(/_{3,}/);
  for (const block of blocks) {
    const trimmed = block.trim();
    if (trimmed.startsWith('Song #')) {
      yield trimmed;
    }
  }
}

/* Parse a song block into its components */
function parseSongBlock(text) {
  if (!text) return null;
  
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  
  // Find the song line - look for more patterns
  const songLine = lines.find(l => 
    l.match(/Song\s*#\s*\d+/i) || 
    l.match(/Fussin'?\s*and\s*Lovin'?\s*#\s*\d+/i) ||
    l.match(/^#\s*\d+/i)
  );
  
  if (!songLine) {
    dbg("No song line found in block");
    return null;
  }
  
  // Extract song number and title - handle more formats
  let number, title;
  
  // Try different patterns to extract number and title
  const patterns = [
    /(?:Song|Fussin'?\s*and\s*Lovin'?)\s*#\s*(\d+)(?::\s*(?:"([^"]+)"|([^"\n]+)))?/i,
    /^#\s*(\d+)(?::\s*(?:"([^"]+)"|([^"\n]+)))?/i,
    /^(\d+)(?::\s*(?:"([^"]+)"|([^"\n]+)))?/i
  ];
  
  for (const pattern of patterns) {
    const match = songLine.match(pattern);
    if (match) {
      number = match[1];
      title = (match[2] || match[3] || '').trim();
      break;
    }
  }
  
  if (!number) {
    dbg("Could not extract song number from: " + songLine);
    return null;
  }
  
  // If title wasn't in the first line, look for it in subsequent lines
  if (!title) {
    // Look for quoted title
    const titleLine = lines.find(l => l.match(/^"[^"]+"/));
    if (titleLine) {
      title = titleLine.replace(/^"|"$/g, '').trim();
    } else {
      // Look for title after the song number line
      const titleIndex = lines.indexOf(songLine) + 1;
      if (titleIndex < lines.length) {
        title = lines[titleIndex].trim();
      }
    }
  }
  
  // Extract artist - look for more patterns
  let artist = null;
  
  // Try different patterns for artist
  const artistPatterns = [
    { pattern: /Who Made it:\s*(.+)/i, line: lines.find(l => l.match(/Who Made it:/i)) },
    { pattern: /by:\s*(.+)/i, line: lines.find(l => l.match(/by:/i)) },
    { pattern: /Artist:\s*(.+)/i, line: lines.find(l => l.match(/Artist:/i)) }
  ];
  
  for (const { pattern, line } of artistPatterns) {
    if (line) {
      const match = line.match(pattern);
      if (match) {
        artist = match[1].trim();
        break;
      }
    }
  }
  
  // If still no artist, look for "by" in any line
  if (!artist) {
    for (const line of lines) {
      const byMatch = line.match(/by\s+(.+)/i);
      if (byMatch) {
        artist = byMatch[1].trim();
        break;
      }
    }
  }
  
  if (!artist) {
    dbg("Could not extract artist from block");
    return null;
  }
  
  if (!title) {
    dbg("Could not extract title from block");
    return null;
  }
  
  dbg(`Found song: #${number} - "${title}" by "${artist}"`);
  return {
    number,
    track: title,
    mainArtist: artist,
    relatedArtists: '[]'
  };
}

/* ---------- extraction --------------------------------------------------- */

async function parseMboxMessage(raw) {
  const parsed = await simpleParser(raw);
  
  // Skip if this is a reply
  if (parsed.inReplyTo) {
    dbg("Skipping reply email");
    return null;
  }
  
  const subject = parsed.subject || '';
  const body = parsed.text || parsed.textAsHtml || '';
  
  // Check if this is a song entry email - more flexible pattern
  const subjectMatch = subject.match(/(?:Song|Fussin'?\s*and\s*Lovin'?|FAL)\s*#\s*(\d+)/i);
  if (!subjectMatch) {
    dbg(`Skipping email with subject: ${subject} - not a song entry`);
    return null;
  }
  
  const songNumber = subjectMatch[1];
  dbg(`\nProcessing email with subject: ${subject}`);
  
  // Clean and parse the body
  const cleanBody = smart(body);
  const song = parseSongBlock(cleanBody);
  
  // Verify song number matches subject
  if (song && song.number === songNumber) {
    return song;
  } else if (song) {
    dbg(`Song number mismatch: subject=${songNumber}, body=${song.number}`);
  } else {
    dbg("Could not parse song from body");
  }
  
  return null;
}

/* ---------- main --------------------------------------------------------- */

const inFile = process.argv[2];
if (!inFile) {
  console.error('Usage: node parse_mbox.js <file.mbox>');
  process.exit(1);
}

(async () => {
  dbg(`Reading ${inFile}`);
  let raw = fs.readFileSync(inFile, 'utf8');

  /* ensure first "From " is caught */
  if (!raw.startsWith('\nFrom ')) raw = '\n' + raw;

  const blocks = raw.split(/\nFrom /).filter(Boolean);
  dbg(`Found ${blocks.length} message blocks`);

  const rows = [];
  const seen = new Set();

  for (const blk of blocks) {
    try {
      const song = await parseMboxMessage(blk);
      if (song) {
        const key = `${song.number}-${song.track}`;
        if (!seen.has(key)) {
          seen.add(key);
          rows.push(song);
        }
      }
    } catch (err) {
      dbg(`Error processing block: ${err.message}`);
    }
  }

  // Sort by song number
  rows.sort((a, b) => parseInt(a.number) - parseInt(b.number));

  dbg(`Extracted ${rows.length} unique songs`);
  dbg(`Total blocks processed: ${blocks.length}`);

  const csvWriter = createObjectCsvWriter({
    path: 'songs.csv',
    header: [
      { id: 'number',         title: 'Number'         },
      { id: 'track',          title: 'Track Name'     },
      { id: 'mainArtist',     title: 'Main Artist'    },
      { id: 'relatedArtists', title: 'Related Artists'}
    ]
  });

  await csvWriter.writeRecords(rows);
  dbg('Wrote songs.csv');
  log.end();
})();
