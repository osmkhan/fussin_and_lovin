// add_genres_to_songs.js
import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

const INPUT_CSV = '/Users/osmankhan/Desktop/data/code_projects/fussin_and_lovin/build/songs_albums_entries_fixed.csv';
const GENRES_JSON = 'album_genres.json';
const OUTPUT_CSV = 'build/songs_with_genres.csv';

async function readRows(file) {
  const raw = await fs.readFile(file, 'utf8');
  return parse(raw, { columns: true, skip_empty_lines: true });
}

async function readGenres(file) {
  const raw = await fs.readFile(file, 'utf8');
  return JSON.parse(raw);
}

(async () => {
  try {
    // Read input files
    const rows = await readRows(INPUT_CSV);
    const genres = await readGenres(GENRES_JSON);
    
    // Add genres to each row
    const updatedRows = rows.map(row => {
      const songNumber = row['Number'];
      const songGenres = genres[songNumber] || [];
      
      return {
        ...row,
        'Genres': songGenres.join(', ')
      };
    });
    
    // Write updated data to new CSV
    const output = stringify(updatedRows, { header: true });
    await fs.writeFile(OUTPUT_CSV, output);
    
    // Print summary
    const songsWithGenres = updatedRows.filter(row => row['Genres']).length;
    console.log(`Added genres to ${songsWithGenres} out of ${rows.length} songs`);
    console.log(`Wrote updated data to ${OUTPUT_CSV}`);
    
  } catch (err) {
    console.error('Error:', err.message);
  }
})(); 