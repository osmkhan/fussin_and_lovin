import fs from 'fs/promises';
import path from 'path';

const SONGS_JSON = path.resolve('src/data/songs.json');
const GENRES_JSON = path.resolve('album_genres.json');

async function readJSON(file) {
  const raw = await fs.readFile(file, 'utf8');
  return JSON.parse(raw);
}

(async () => {
  try {
    // Read both files
    const songs = await readJSON(SONGS_JSON);
    const genreData = await readJSON(GENRES_JSON);
    
    console.log('First few genre entries:', Object.entries(genreData).slice(0, 5));
    
    // Add genres to songs while preserving all existing data
    const updatedSongs = songs.map(song => {
      const genres = genreData[song.number] || [];
      if (genres.length > 0) {
        console.log(`Found genres for song ${song.number}: ${genres.join(', ')}`);
      }
      return {
        ...song,
        genres
      };
    });
    
    // Write back to songs.json with proper formatting
    const output = JSON.stringify(updatedSongs, null, 2);
    await fs.writeFile(SONGS_JSON, output, 'utf8');
    
    // Verify the write
    const writtenData = await readJSON(SONGS_JSON);
    const songsWithGenres = writtenData.filter(s => s.genres?.length > 0).length;
    console.log(`Verified: Added genres to ${songsWithGenres} out of ${writtenData.length} songs`);
    console.log(`Updated ${SONGS_JSON}`);
    
    // Print first song with genres as example
    const example = writtenData.find(s => s.genres?.length > 0);
    if (example) {
      console.log('\nExample of updated song:');
      console.log(JSON.stringify(example, null, 2));
    }
    
  } catch (err) {
    console.error('Error:', err.message);
    if (err.code === 'ENOENT') {
      console.error('File not found. Please check the file paths.');
    }
  }
})(); 