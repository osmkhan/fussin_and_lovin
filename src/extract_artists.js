const fs = require('fs');

// Read the songs.json file
const songs = JSON.parse(fs.readFileSync('./src/data/songs.json', 'utf8'));

// Extract unique artists
const uniqueArtists = [...new Set(songs.map(song => song.artist))].sort();

// Create CSV content
const csvContent = 'artist\n' + uniqueArtists.map(artist => `"${artist}"`).join('\n');

// Write to file
fs.writeFileSync('./src/data/unique_artists.csv', csvContent, 'utf8');

console.log(`Found ${uniqueArtists.length} unique artists`);
console.log('CSV file created at src/data/unique_artists.csv'); 