const fs = require('fs');

// Read the data files
const songs = JSON.parse(fs.readFileSync('./src/data/songs_cleaned.json', 'utf8'));
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

// Function to analyze word counts
function analyzeWordCounts() {
  const wordCounts = [];
  let totalWords = 0;
  
  entries.forEach(entry => {
    const count = countWords(entry.textBody);
    wordCounts.push({
      song: entry.song,
      artist: entry.artist,
      wordCount: count
    });
    totalWords += count;
  });

  // Sort by word count
  wordCounts.sort((a, b) => b.wordCount - a.wordCount);

  // Calculate statistics
  const avgWords = totalWords / wordCounts.length;
  const medianWords = wordCounts[Math.floor(wordCounts.length / 2)].wordCount;
  
  // Calculate standard deviation
  const squaredDiffs = wordCounts.map(wc => Math.pow(wc.wordCount - avgWords, 2));
  const stdDev = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / wordCounts.length);

  // Calculate distribution
  const distribution = {
    '0-100': 0,
    '101-200': 0,
    '201-300': 0,
    '301-400': 0,
    '401-500': 0,
    '500+': 0
  };

  wordCounts.forEach(wc => {
    if (wc.wordCount <= 100) distribution['0-100']++;
    else if (wc.wordCount <= 200) distribution['101-200']++;
    else if (wc.wordCount <= 300) distribution['201-300']++;
    else if (wc.wordCount <= 400) distribution['301-400']++;
    else if (wc.wordCount <= 500) distribution['401-500']++;
    else distribution['500+']++;
  });

  // Convert to percentages
  Object.keys(distribution).forEach(key => {
    distribution[key] = (distribution[key] / wordCounts.length * 100).toFixed(1);
  });

  return {
    totalEntries: wordCounts.length,
    totalWords,
    averageWords: avgWords.toFixed(2),
    medianWords: medianWords.toFixed(2),
    standardDeviation: stdDev.toFixed(2),
    longestEntry: wordCounts[0],
    shortestEntry: wordCounts[wordCounts.length - 1],
    distribution
  };
}

// Function to analyze tragic deaths
function analyzeTragicDeaths() {
  const tragicCount = songs.filter(song => song.is_tragic).length;
  const percentage = (tragicCount / songs.length * 100).toFixed(1);
  
  return {
    totalArtists: songs.length,
    tragicCount,
    percentage
  };
}

// Function to analyze artist mentions
function analyzeArtistMentions() {
  const mentions = new Map();
  
  entries.forEach(entry => {
    const text = entry.textBody.toLowerCase();
    if (text.includes('lorraine')) {
      mentions.set('Lorraine', (mentions.get('Lorraine') || 0) + 1);
    }
    if (text.includes('loretta')) {
      mentions.set('Loretta', (mentions.get('Loretta') || 0) + 1);
    }
  });

  return Object.fromEntries(mentions);
}

// Run all analyses
const wordCountAnalysis = analyzeWordCounts();
const tragicAnalysis = analyzeTragicDeaths();
const mentionAnalysis = analyzeArtistMentions();

// Generate summary report
const report = `
Collection Analysis Report
=======================

Word Count Analysis
-----------------
Total Entries: ${wordCountAnalysis.totalEntries}
Total Words: ${wordCountAnalysis.totalWords}
Average Words per Entry: ${wordCountAnalysis.averageWords}
Median Words per Entry: ${wordCountAnalysis.medianWords}
Standard Deviation: ${wordCountAnalysis.standardDeviation}

Longest Entry: ${wordCountAnalysis.longestEntry.wordCount} words
- ${wordCountAnalysis.longestEntry.song} by ${wordCountAnalysis.longestEntry.artist}

Shortest Entry: ${wordCountAnalysis.shortestEntry.wordCount} words
- ${wordCountAnalysis.shortestEntry.song} by ${wordCountAnalysis.shortestEntry.artist}

Word Count Distribution:
- 0-100 words: ${wordCountAnalysis.distribution['0-100']}%
- 101-200 words: ${wordCountAnalysis.distribution['101-200']}%
- 201-300 words: ${wordCountAnalysis.distribution['201-300']}%
- 301-400 words: ${wordCountAnalysis.distribution['301-400']}%
- 401-500 words: ${wordCountAnalysis.distribution['401-500']}%
- 500+ words: ${wordCountAnalysis.distribution['500+']}%

Tragic Death Analysis
-------------------
Total Artists: ${tragicAnalysis.totalArtists}
Tragic Deaths: ${tragicAnalysis.tragicCount}
Percentage: ${tragicAnalysis.percentage}%

Artist Mentions
-------------
${Object.entries(mentionAnalysis).map(([name, count]) => `${name}: ${count} mentions`).join('\n')}
`;

// Write report to file
fs.writeFileSync('./src/data/collection_analysis.txt', report, 'utf8');

// Export word counts to CSV
let csvContent = 'number,song,artist,word_count\n';
songs.forEach(song => {
  const entry = entries.find(e => e.song === song.song && e.artist === song.artist);
  const wordCount = entry ? countWords(entry.textBody) : 0;
  csvContent += `${song.number},"${song.song}","${song.artist}",${wordCount}\n`;
});
fs.writeFileSync('./src/data/word_counts.csv', csvContent, 'utf8');

console.log('Analysis complete! Check src/data/collection_analysis.txt for the full report.'); 