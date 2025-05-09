const fs = require('fs');

// Read the data
const songs = JSON.parse(fs.readFileSync('src/data/songs_cleaned.json', 'utf8'));

// Get all word counts (including zeros)
const wordCounts = songs.map(s => s.wordCount);

// Find entries with zero word counts
const zeroCountEntries = songs.filter(s => s.wordCount === 0);
console.log('\nEntries with zero word counts:');
console.log('---------------------------');
zeroCountEntries.forEach(entry => {
  console.log(`\n#${entry.number} - ${entry.song} by ${entry.artist}`);
});

// Calculate statistics
const totalWords = wordCounts.reduce((sum, count) => sum + count, 0);
const avgWords = totalWords / wordCounts.length;
const sortedCounts = [...wordCounts].sort((a, b) => a - b);
const medianWords = sortedCounts[Math.floor(sortedCounts.length / 2)];
const stdDev = Math.sqrt(
  wordCounts.reduce((sum, count) => sum + Math.pow(count - avgWords, 2), 0) / wordCounts.length
);

// Calculate distribution
const ranges = [
  { min: 0, max: 100, label: '0-100' },
  { min: 101, max: 200, label: '101-200' },
  { min: 201, max: 300, label: '201-300' },
  { min: 301, max: 400, label: '301-400' },
  { min: 401, max: 500, label: '401-500' },
  { min: 501, max: Infinity, label: '500+' }
];

const distribution = ranges.map(range => {
  const count = wordCounts.filter(wc => wc >= range.min && wc <= range.max).length;
  const percentage = (count / wordCounts.length * 100).toFixed(1);
  return { range: range.label, count, percentage };
});

// Find extremes
const longest = songs.reduce((max, song) => song.wordCount > max.wordCount ? song : max, songs[0]);
const shortest = songs.reduce((min, song) => song.wordCount < min.wordCount ? song : min, songs[0]);

// Print statistics
console.log('\nWord Count Analysis:');
console.log('-------------------');
console.log(`Total entries: ${wordCounts.length}`);
console.log(`Total words: ${totalWords}`);
console.log(`Average words per entry: ${avgWords.toFixed(2)}`);
console.log(`Median words per entry: ${medianWords.toFixed(2)}`);
console.log(`Standard deviation: ${stdDev.toFixed(2)}`);
console.log(`\nLongest entry: ${longest.wordCount} words (${longest.song} by ${longest.artist})`);
console.log(`Shortest entry: ${shortest.wordCount} words (${shortest.song} by ${shortest.artist})`);

console.log('\nWord Count Distribution:');
console.log('----------------------');
distribution.forEach(d => {
  console.log(`${d.range}: ${d.count} entries (${d.percentage}%)`);
});

// Output CSV
const csvContent = [
  'number,song,artist,wordCount',
  ...songs.map(s => `${s.number},"${s.song}","${s.artist}",${s.wordCount}`)
].join('\n');

fs.writeFileSync('src/data/word_counts.csv', csvContent);
console.log('\nExported word counts to src/data/word_counts.csv'); 