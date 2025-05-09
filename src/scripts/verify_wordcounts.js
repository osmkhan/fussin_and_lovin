const fs = require('fs');

// Read the data
const entries = JSON.parse(fs.readFileSync('src/data/entries.json', 'utf8'));

function countWords(text) {
  if (!text) return 0;
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
    .replace(/–.*?\n/gm, '') // Remove signatures anywhere in text
    .replace(/\(.*?\)/gm, '') // Remove parenthetical notes anywhere in text
    .replace(/_+\n/gm, '') // Remove separator lines anywhere in text
    .replace(/[^\w\s]/g, ' ') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  // Count non-empty words
  return cleanedText.split(' ').filter(word => word.length > 0).length;
}

// Process all entries
const results = entries.map(entry => {
  const wordCount = countWords(entry.textBody);
  return {
    number: entry.number,
    song: entry.song,
    artist: entry.artist,
    wordCount,
    text: entry.textBody.split('Thoughts:')[1]?.trim() || ''
  };
});

// Sort by word count
results.sort((a, b) => b.wordCount - a.wordCount);

// Print results
console.log('\nTop 10 longest entries:');
results.slice(0, 10).forEach(r => {
  console.log(`\n#${r.number} - ${r.song} by ${r.artist}: ${r.wordCount} words`);
  console.log('First 100 chars:', r.text.substring(0, 100) + '...');
});

console.log('\nBottom 10 shortest entries:');
results.slice(-10).forEach(r => {
  console.log(`\n#${r.number} - ${r.song} by ${r.artist}: ${r.wordCount} words`);
  console.log('First 100 chars:', r.text.substring(0, 100) + '...');
});

// Check for zero word counts
const zeroCounts = results.filter(r => r.wordCount === 0);
if (zeroCounts.length > 0) {
  console.log('\nEntries with zero word count:');
  zeroCounts.forEach(r => {
    console.log(`\n#${r.number} - ${r.song} by ${r.artist}`);
    console.log('Text:', r.text);
  });
} 