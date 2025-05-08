const fs = require('fs');
const csv = require('csv-writer').createObjectCsvWriter;

// Function to extract song information from a block of text
function extractSongInfo(block) {
    const songMatch = block.match(/Song #(\d+):\s*"([^"]+)"/);
    const artistMatch = block.match(/Who Made it:\s*([^\n]+)/);
    
    if (songMatch && artistMatch) {
        return {
            Number: songMatch[1],
            'Track Name': songMatch[2],
            'Main Artist': artistMatch[1].trim(),
            'Related Artists': '[]'
        };
    }
    return null;
}

// Read and parse the file
const fileContent = fs.readFileSync('Fussin_backfill.mbox', 'utf8');
const blocks = fileContent.split('_____________________________');

// Extract songs and remove duplicates
const songsMap = new Map();
blocks.forEach(block => {
    const song = extractSongInfo(block);
    if (song) {
        const key = `${song.Number}-${song['Track Name']}`;
        if (!songsMap.has(key)) {
            songsMap.set(key, song);
        }
    }
});

const songs = Array.from(songsMap.values());

// Write to CSV
const csvWriter = csv({
    path: 'songs_backfill.csv',
    header: [
        {id: 'Number', title: 'Number'},
        {id: 'Track Name', title: 'Track Name'},
        {id: 'Main Artist', title: 'Main Artist'},
        {id: 'Related Artists', title: 'Related Artists'}
    ]
});

csvWriter.writeRecords(songs)
    .then(() => console.log('CSV file has been written successfully')); 