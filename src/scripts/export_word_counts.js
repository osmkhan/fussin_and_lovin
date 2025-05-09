const fs = require('fs');

// Read the entries.json file
const entries = JSON.parse(fs.readFileSync('./src/data/entries.json', 'utf8'));
const songs = JSON.parse(fs.readFileSync('./src/data/songs_cleaned.json', 'utf8'));

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

// Create CSV content
let csvContent = 'number,song,artist,word_count\n';

// Add rows in the same order as songs_cleaned.json
songs.forEach(song => {
  const key = `${song.song}|||${song.artist}`;
  const wordCount = wordCounts.get(key) || 0;
  csvContent += `${song.number},"${song.song}","${song.artist}",${wordCount}\n`;
});

// Write to file
fs.writeFileSync('./src/data/word_counts.csv', csvContent, 'utf8');

console.log('Word counts exported to word_counts.csv'); 