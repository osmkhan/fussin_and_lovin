const fs = require('fs');

// Read the CSV file
const content = fs.readFileSync('./src/data/unique_artists_cleaned.csv', 'utf8')
    .replace(/\r/g, ''); // Remove any Windows line endings

// Split into lines and skip header
const lines = content.split('\n').slice(1).filter(line => line.trim());

// Count non-zero flags
let nonZeroCount = 0;
lines.forEach(line => {
    const [artist, flag] = line.split(',');
    if (flag && flag.trim() !== '0' && flag.trim() !== '') {
        console.log(`Flag: "${flag.trim()}" for artist: ${artist}`);
        nonZeroCount++;
    }
});

const totalCount = lines.length;

console.log(`\nTotal artists: ${totalCount}`);
console.log(`Artists with non-zero flags: ${nonZeroCount}`);
console.log(`Percentage: ${((nonZeroCount / totalCount) * 100).toFixed(1)}%`);
