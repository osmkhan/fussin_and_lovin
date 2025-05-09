const fs = require('fs');

// Read both files
const entries = JSON.parse(fs.readFileSync('src/data/entries.json', 'utf8'));
const songs = JSON.parse(fs.readFileSync('src/data/songs_cleaned.json', 'utf8'));

function countWords(text) {
  if (!text) return 0;
  
  console.log('\nDEBUG - Original text:');
  console.log(text);
  
  // Extract main content
  let mainContent = text;
  
  // Find the main content section
  const thoughtsIndex = mainContent.indexOf('Thoughts:');
  console.log('\nDEBUG - Thoughts index:', thoughtsIndex);
  
  if (thoughtsIndex !== -1) {
    // If we have a Thoughts section, start from there
    mainContent = mainContent.slice(thoughtsIndex);
    console.log('\nDEBUG - After Thoughts slice:');
    console.log(mainContent);
    
    // If we have a Reply section after Thoughts, cut it off
    const replyIndex = mainContent.indexOf('Reply from');
    if (replyIndex !== -1 && replyIndex > thoughtsIndex) {
      mainContent = mainContent.slice(0, replyIndex - thoughtsIndex);
      console.log('\nDEBUG - After Reply slice:');
      console.log(mainContent);
    }
  } else {
    // If no Thoughts section, try to find the main content after the metadata block
    const lines = mainContent.split('\n');
    let startIndex = 0;
    
    // Skip the metadata section (usually first few lines with date, song info)
    for (let i = 0; i < lines.length; i++) {
      // Look for any separator line (either underscores or dashes)
      if (lines[i].match(/^[_-]+$/) || lines[i].includes('_______________________________')) {
        startIndex = i + 1;
        break;
      }
    }
    
    mainContent = lines.slice(startIndex).join('\n');
    
    // If we have a Reply section, remove it
    const replyIndex = mainContent.indexOf('Reply from');
    if (replyIndex !== -1) {
      mainContent = mainContent.slice(0, replyIndex);
      console.log('\nDEBUG - After Reply slice:');
      console.log(mainContent);
    }
  }

  // Clean up the text while preserving valid words
  const cleanedText = mainContent
    // Only remove signatures at the end of lines
    .replace(/–[^–\n]*\n/g, ' ')
    // Only remove parenthetical notes that are complete
    .replace(/\([^()]*\)/g, ' ')
    // Remove separator lines (both underscore and dash formats)
    .replace(/[_-]+\n/gm, ' ')
    // Remove special chars except apostrophes, hyphens, and underscores within words
    .replace(/[^\w\s'_-]/g, ' ')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();

  console.log('\nDEBUG - After cleanup:');
  console.log(cleanedText);

  // Count non-empty words, including hyphenated words and contractions
  const words = cleanedText.split(' ').filter(word => {
    // Remove any remaining punctuation at word boundaries
    word = word.replace(/^[-']+|[-']+$/g, '');
    // Consider a word valid if it has at least one letter
    return word.length > 0 && /[a-zA-Z]/.test(word);
  });

  console.log('\nDEBUG - Words found:', words);

  // If we have less than 10 words and the text ends abruptly, mark it as zero
  if (words.length < 10 && mainContent.endsWith('Ho')) {
    return 0;
  }

  return words.length;
}

// Create a map of entries for quick lookup
const entryMap = new Map();
entries.forEach(entry => {
  // Clean up the artist name by removing the year and quotes
  const artistName = entry.artist.split('Year:')[0].replace(/"/g, '').trim();
  const key = `${entry.song}|${artistName}`;
  entryMap.set(key, entry);
});

// Update word counts while preserving all other data
const updatedSongs = songs.map(song => {
  // Clean up the artist name in the same way
  const artistName = song.artist.split('Year:')[0].replace(/"/g, '').trim();
  const key = `${song.song}|${artistName}`;
  const entry = entryMap.get(key);
  
  if (!entry) {
    console.log(`\nWARNING: No matching entry found for song "${song.song}" by "${artistName}"`);
    return song;
  }
  
  const wordCount = countWords(entry.textBody);
  
  // Create a new object with all existing properties plus updated wordCount
  return {
    ...song,
    wordCount
  };
});

// Verify the update
console.log('\nVerifying word count updates:');
console.log('Total songs:', updatedSongs.length);
console.log('Songs with word counts:', updatedSongs.filter(s => s.wordCount > 0).length);
console.log('Songs with zero word counts:', updatedSongs.filter(s => s.wordCount === 0).length);

// Print entries with zero word counts
const zeroCountEntries = updatedSongs.filter(s => s.wordCount === 0);
if (zeroCountEntries.length > 0) {
  console.log('\nEntries with zero word counts:');
  zeroCountEntries.forEach(entry => {
    console.log(`#${entry.number} - ${entry.song} by ${entry.artist}`);
  });
}

// Print some sample entries to verify
console.log('\nSample entries:');
updatedSongs.slice(0, 3).forEach(song => {
  console.log(`\n#${song.number} - ${song.song} by ${song.artist}: ${song.wordCount} words`);
});

// Backup the original file
const backupPath = 'src/data/songs_cleaned.json.backup';
fs.writeFileSync(backupPath, JSON.stringify(songs, null, 2));
console.log(`\nCreated backup at ${backupPath}`);

// Write the updated file
fs.writeFileSync('src/data/songs_cleaned.json', JSON.stringify(updatedSongs, null, 2));
console.log('\nUpdated songs_cleaned.json with new word counts');

// Test with entry #150
const entry150 = entries.find(e => e.number === 150);
console.log('\nTesting entry #150:');
const wordCount = countWords(entry150.textBody);
console.log('\nFinal word count:', wordCount); 