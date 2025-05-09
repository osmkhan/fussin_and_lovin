const fs = require('fs');
const { execSync } = require('child_process');

// First, save current files as backups
console.log('Saving current files as backups...');
fs.copyFileSync('./src/data/songs.json', './src/data/songs.json.current');
fs.copyFileSync('./src/data/entries.json', './src/data/entries.json.current');

// Get the original files from GitHub
console.log('Getting original files from GitHub...');
try {
  execSync('git checkout HEAD -- src/data/songs.json src/data/entries.json');
} catch (error) {
  console.error('Error getting files from GitHub:', error.message);
  process.exit(1);
}

// Read the original files
const originalSongs = JSON.parse(fs.readFileSync('./src/data/songs.json', 'utf8'));
const originalEntries = JSON.parse(fs.readFileSync('./src/data/entries.json', 'utf8'));

// Create a map of correct artist names
const correctArtists = new Map();

// Get correct names from original songs
originalSongs.forEach(song => {
  correctArtists.set(song.number, song.artist);
});

// Read current files
const currentSongs = JSON.parse(fs.readFileSync('./src/data/songs.json.current', 'utf8'));
const currentEntries = JSON.parse(fs.readFileSync('./src/data/entries.json.current', 'utf8'));

// Update current files with correct artist names
currentSongs.forEach(song => {
  if (correctArtists.has(song.number)) {
    song.artist = correctArtists.get(song.number);
  }
});

currentEntries.forEach(entry => {
  if (correctArtists.has(entry.number)) {
    entry.artist = correctArtists.get(entry.number);
  }
});

// Write the updated files
fs.writeFileSync(
  './src/data/songs.json',
  JSON.stringify(currentSongs, null, 2),
  'utf8'
);

fs.writeFileSync(
  './src/data/entries.json',
  JSON.stringify(currentEntries, null, 2),
  'utf8'
);

// Print some examples to verify
console.log('\nSample restored artist names:');
console.log('==========================');
for (let i = 1; i <= 10; i++) {
  const song = currentSongs.find(s => s.number === i);
  const entry = currentEntries.find(e => e.number === i);
  console.log(`Song #${i}:`);
  console.log(`  Songs.json: "${song.artist}"`);
  console.log(`  Entries.json: "${entry.artist}"`);
  console.log('---');
}

// Clean up backup files
fs.unlinkSync('./src/data/songs.json.current');
fs.unlinkSync('./src/data/entries.json.current'); 