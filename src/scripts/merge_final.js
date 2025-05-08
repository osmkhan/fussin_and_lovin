const fs = require('fs');
const csv = require('csv-writer').createObjectCsvWriter;
const csvParser = require('csv-parse/sync');

// Read both CSV files
const completeContent = fs.readFileSync('songs_complete.csv', 'utf8');
const finalContent = fs.readFileSync('songs_final.csv', 'utf8');

// Parse CSVs
const completeSongs = csvParser.parse(completeContent, { columns: true });
const finalSongs = csvParser.parse(finalContent, { columns: true });

// Merge songs and remove duplicates
const songsMap = new Map();
[...completeSongs, ...finalSongs].forEach(song => {
    const key = `${song.Number}-${song['Track Name']}`;
    if (!songsMap.has(key)) {
        songsMap.set(key, song);
    }
});

// Convert to array and sort by song number
const allSongs = Array.from(songsMap.values())
    .sort((a, b) => parseInt(a.Number) - parseInt(b.Number));

// Write merged CSV
const csvWriter = csv({
    path: 'songs_complete_updated.csv',
    header: [
        {id: 'Number', title: 'Number'},
        {id: 'Track Name', title: 'Track Name'},
        {id: 'Main Artist', title: 'Main Artist'},
        {id: 'Related Artists', title: 'Related Artists'}
    ]
});

csvWriter.writeRecords(allSongs)
    .then(() => {
        console.log('Updated CSV file has been written successfully');
        console.log(`Total songs in updated file: ${allSongs.length}`);
        console.log(`New songs added: ${allSongs.length - completeSongs.length}`);
    }); 