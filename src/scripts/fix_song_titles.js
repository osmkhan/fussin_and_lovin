const fs = require('fs');

// Read both files
const entries = JSON.parse(fs.readFileSync('src/data/entries.json', 'utf8'));
const songs = JSON.parse(fs.readFileSync('src/data/songs_cleaned.json', 'utf8'));

// Create a map of songs by number for quick lookup
const songMap = new Map();
songs.forEach(song => {
  songMap.set(song.number, song);
});

// Update song titles in entries to match songs
const updatedEntries = entries.map(entry => {
  const song = songMap.get(entry.number);
  if (!song) {
    console.log(`WARNING: No matching song found for entry #${entry.number}`);
    return entry;
  }

  if (entry.song !== song.song) {
    console.log(`Updating entry #${entry.number}:`);
    console.log(`  Old title: "${entry.song}"`);
    console.log(`  New title: "${song.song}"`);
  }

  return {
    ...entry,
    song: song.song
  };
});

// Backup the original file
const backupPath = 'src/data/entries.json.backup';
fs.writeFileSync(backupPath, JSON.stringify(entries, null, 2));
console.log(`\nCreated backup at ${backupPath}`);

// Write the updated file
fs.writeFileSync('src/data/entries.json', JSON.stringify(updatedEntries, null, 2));
console.log('\nUpdated entries.json with corrected song titles'); 