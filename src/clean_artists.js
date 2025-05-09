const fs = require('fs');

// Read the songs.json file
const songs = JSON.parse(fs.readFileSync('./src/data/songs.json', 'utf8'));

// Function to clean artist names
function cleanArtistName(artist) {
  return artist
    .replace(/\*+/g, '') // Remove asterisks
    .replace(/\s*Year:\s*\d{4}/g, '') // Remove "Year: YYYY"
    .replace(/\s*\(Year:\s*\d{4}\)/g, '') // Remove "(Year: YYYY)"
    .trim();
}

// Create cleaned version of songs
const songsCleaned = songs.map(song => ({
  ...song,
  artist: cleanArtistName(song.artist)
}));

// Get unique cleaned artists
const uniqueArtists = [...new Set(songsCleaned.map(song => song.artist))].sort();

// Analyze word counts
const totalSongs = songsCleaned.length;
const songsWithWords = songsCleaned.filter(song => song.wordCount > 0).length;
const percentageWithWords = (songsWithWords / totalSongs * 100).toFixed(2);

// Create CSV content with word count analysis
const csvContent = 'artist,total_songs,songs_with_words,percentage_with_words\n' + 
  uniqueArtists.map(artist => {
    const artistSongs = songsCleaned.filter(song => song.artist === artist);
    const total = artistSongs.length;
    const withWords = artistSongs.filter(song => song.wordCount > 0).length;
    const percentage = (withWords / total * 100).toFixed(2);
    return `"${artist}",${total},${withWords},${percentage}`;
  }).join('\n');

// Write to files
fs.writeFileSync('./src/data/unique_artists_cleaned.csv', csvContent, 'utf8');
fs.writeFileSync('./src/data/songs_cleaned.json', JSON.stringify(songsCleaned, null, 2), 'utf8');

// Print statistics
console.log('\nWord Count Analysis:');
console.log('===================');
console.log(`Total songs: ${totalSongs}`);
console.log(`Songs with word counts: ${songsWithWords}`);
console.log(`Percentage with word counts: ${percentageWithWords}%`);

// Print some examples of cleaned names
console.log('\nSample cleaned artist names:');
console.log('==========================');
for (let i = 0; i < 10; i++) {
  const original = songs[i].artist;
  const cleaned = songsCleaned[i].artist;
  if (original !== cleaned) {
    console.log(`Original: "${original}"`);
    console.log(`Cleaned:  "${cleaned}"`);
    console.log('---');
  }
}

console.log(`\nFound ${uniqueArtists.length} unique artists after cleaning`);
console.log('Files created:');
console.log('- src/data/unique_artists_cleaned.csv');
console.log('- src/data/songs_cleaned.json'); 