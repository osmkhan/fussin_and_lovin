const fs = require('fs');
const csv = require('csv-writer').createObjectCsvWriter;
const csvParser = require('csv-parse/sync');

// Read both CSV files
const originalContent = fs.readFileSync('songs.csv', 'utf8');
const backfillContent = fs.readFileSync('songs_backfill.csv', 'utf8');

// Parse CSVs
const originalSongs = csvParser.parse(originalContent, { columns: true });
const backfillSongs = csvParser.parse(backfillContent, { columns: true });

// Merge songs and remove duplicates
const songsMap = new Map();
[...originalSongs, ...backfillSongs].forEach(song => {
    const key = `${song.Number}-${song['Track Name']}`;
    if (!songsMap.has(key)) {
        songsMap.set(key, song);
    }
});

// Convert to array and sort by song number
const allSongs = Array.from(songsMap.values())
    .sort((a, b) => parseInt(a.Number) - parseInt(b.Number));

// Find missing numbers
const presentNumbers = new Set(allSongs.map(song => parseInt(song.Number)));
const missingNumbers = [];
for (let i = 1; i <= 352; i++) {
    if (!presentNumbers.has(i)) {
        missingNumbers.push(i);
    }
}

// Sort missing numbers
missingNumbers.sort((a, b) => a - b);

// Write merged CSV
const csvWriter = csv({
    path: 'songs_complete.csv',
    header: [
        {id: 'Number', title: 'Number'},
        {id: 'Track Name', title: 'Track Name'},
        {id: 'Main Artist', title: 'Main Artist'},
        {id: 'Related Artists', title: 'Related Artists'}
    ]
});

csvWriter.writeRecords(allSongs)
    .then(() => {
        console.log('Merged CSV file has been written successfully');
        console.log('\nMissing song numbers (in sequence):');
        console.log(missingNumbers.join(', '));
        console.log('\nTotal missing songs:', missingNumbers.length);
    }); 