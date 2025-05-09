const fs = require('fs');

// Read the entries.json file
const entries = JSON.parse(fs.readFileSync('./src/data/entries.json', 'utf8'));
const songs = JSON.parse(fs.readFileSync('./src/data/songs.json', 'utf8'));

// Function to count words in a string
function countWords(text) {
  // First, extract just the main content between the metadata and any replies
  let mainContent = text;
  
  // Remove everything before "Thoughts:"
  mainContent = mainContent.split('Thoughts:')[1] || mainContent;
  
  // Remove everything after "Reply from" if it exists
  if (mainContent.includes('Reply from')) {
    mainContent = mainContent.split('Reply from')[0];
  }
  
  // Clean up the text
  const cleanedText = mainContent
    .replace(/^–.*?\n/gm, '') // Remove signatures
    .replace(/^\(.*?\)/gm, '') // Remove parenthetical notes
    .replace(/^_+\n/gm, '') // Remove separator lines
    .replace(/[^\w\s]/g, ' ') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  // Count non-empty words
  return cleanedText.split(' ').filter(word => word.length > 0).length;
}

// Create a map of word counts
const wordCounts = new Map();
entries.forEach(entry => {
  const key = `${entry.song}|||${entry.artist}`; // Use a unique key to handle same song names
  wordCounts.set(key, countWords(entry.textBody));
});

// Add word counts to songs
const updatedSongs = songs.map(song => {
  const key = `${song.song}|||${song.artist}`;
  const wordCount = wordCounts.get(key);
  return {
    ...song,
    wordCount: wordCount || 0 // Use 0 if no word count found
  };
});

// Write the updated songs back to file
fs.writeFileSync(
  './src/data/songs.json',
  JSON.stringify(updatedSongs, null, 2),
  'utf8'
);

console.log('Word counts have been added to songs.json');

// Print some verification stats
const totalWordCounts = updatedSongs.reduce((sum, song) => sum + song.wordCount, 0);
const averageWordCount = totalWordCounts / updatedSongs.length;

console.log(`\nVerification Stats:`);
console.log(`Total songs: ${updatedSongs.length}`);
console.log(`Total words: ${totalWordCounts}`);
console.log(`Average words per entry: ${averageWordCount.toFixed(2)}`);

// Print a few examples
console.log('\nSample Entries:');
updatedSongs.slice(0, 3).forEach(song => {
  console.log(`${song.song} by ${song.artist}: ${song.wordCount} words`);
}); 