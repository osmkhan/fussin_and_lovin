const fs = require('fs');

// Read the entries.json file
const entries = JSON.parse(fs.readFileSync('./src/data/entries.json', 'utf8'));

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

// Function to print sample entries for verification
function printSampleEntries(entries, count = 3) {
  console.log('\nSample Entries Verification:');
  console.log('==========================');
  
  // Get one from the top, middle, and bottom of the sorted list
  const samples = [
    entries[0],  // longest
    entries[Math.floor(entries.length / 2)],  // middle
    entries[entries.length - 1]  // shortest
  ];

  samples.forEach(entry => {
    console.log(`\nEntry #${entry.number}: ${entry.song} by ${entry.artist}`);
    console.log(`Word count: ${entry.wordCount}`);
    
    // Get the cleaned text that's being counted
    let mainContent = entry.textBody;
    mainContent = mainContent.split('Thoughts:')[1] || mainContent;
    if (mainContent.includes('Reply from')) {
      mainContent = mainContent.split('Reply from')[0];
    }
    
    const cleanedText = mainContent
      .replace(/^–.*?\n/gm, '')
      .replace(/^\(.*?\)/gm, '')
      .replace(/^_+\n/gm, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log('Original first 100 characters:');
    console.log(entry.textBody.substring(0, 100) + '...');
    console.log('\nCleaned text being counted:');
    console.log(cleanedText);
    console.log('------------------------');
  });
}

// Analyze each entry
const wordCounts = entries.map(entry => {
  const wordCount = countWords(entry.textBody);
  return {
    number: entry.number,
    song: entry.song,
    artist: entry.artist,
    wordCount: wordCount,
    textBody: entry.textBody
  };
});

// Sort by word count (descending)
wordCounts.sort((a, b) => b.wordCount - a.wordCount);

// Calculate statistics
const totalWords = wordCounts.reduce((sum, entry) => sum + entry.wordCount, 0);
const averageWords = totalWords / wordCounts.length;
const maxWords = wordCounts[0].wordCount;
const minWords = wordCounts[wordCounts.length - 1].wordCount;

// Print results
console.log('\nWord Count Analysis:');
console.log('===================');
console.log(`Total entries: ${wordCounts.length}`);
console.log(`Total words: ${totalWords}`);
console.log(`Average words per entry: ${averageWords.toFixed(2)}`);
console.log(`Longest entry: ${maxWords} words (${wordCounts[0].song} by ${wordCounts[0].artist})`);
console.log(`Shortest entry: ${minWords} words (${wordCounts[wordCounts.length - 1].song} by ${wordCounts[wordCounts.length - 1].artist})`);

console.log('\nTop 10 Longest Entries:');
console.log('=====================');
wordCounts.slice(0, 10).forEach((entry, index) => {
  console.log(`${index + 1}. ${entry.song} by ${entry.artist} (${entry.wordCount} words)`);
});

console.log('\nBottom 10 Shortest Entries:');
console.log('========================');
wordCounts.slice(-10).reverse().forEach((entry, index) => {
  console.log(`${index + 1}. ${entry.song} by ${entry.artist} (${entry.wordCount} words)`);
});

// Print sample entries for verification
printSampleEntries(wordCounts); 