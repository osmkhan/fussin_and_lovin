const fs = require('fs');
const csv = require('csv-parse/sync');

// Read the CSV file
const csvContent = fs.readFileSync('./src/data/unique_artists_cleaned.csv', 'utf8');
const records = csv.parse(csvContent, {
  columns: true,
  skip_empty_lines: true
});

// Create a map of artist names to their flag values
const artistFlags = new Map();
records.forEach(record => {
  const flagValue = record.Flag.startsWith('1') ? 1 : 0;
  artistFlags.set(record.Artist.toLowerCase(), flagValue);
});

console.log('Artist flags map created with', artistFlags.size, 'entries');

// Read the songs JSON file
let songs = JSON.parse(fs.readFileSync('./src/data/songs_cleaned.json', 'utf8'));
console.log('Read', songs.length, 'songs from JSON');

// Add is_tragic field to each song
let tragicCount = 0;
songs = songs.map(song => {
  // Check if any artist in the CSV is contained in the song's artist name
  let isTragic = 0;
  const songArtist = song.artist.toLowerCase();
  for (const [csvArtist, flagValue] of artistFlags) {
    if (songArtist.includes(csvArtist)) {
      isTragic = flagValue;
      if (flagValue === 1) {
        tragicCount++;
        console.log(`Found tragic artist in song: ${song.artist} (matched: ${csvArtist})`);
      }
      break;
    }
  }
  return { ...song, is_tragic: isTragic };
});

console.log('Found', tragicCount, 'songs with tragic flags');

// Write the updated songs back to the file
fs.writeFileSync('./src/data/songs_cleaned.json', JSON.stringify(songs, null, 2));
console.log('Updated songs_cleaned.json with is_tragic field'); 