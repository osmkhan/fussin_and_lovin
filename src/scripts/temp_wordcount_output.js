const fs = require('fs');

// Read the songs data
const songs = JSON.parse(fs.readFileSync('src/data/songs_cleaned.json', 'utf8'));
const entries = JSON.parse(fs.readFileSync('src/data/entries.json', 'utf8'));

// Function to count words in text before any reply markers
function countWordsBeforeReply(text) {
    if (!text) return 0;
    
    // Find the first reply marker
    const replyMarkers = [
        'Reply from',
        'Reply From',
    ];
    
    let cutoffIndex = text.length;
    for (const marker of replyMarkers) {
        const index = text.indexOf(marker);
        if (index !== -1 && index < cutoffIndex) {
            cutoffIndex = index;
        }
    }
    
    // Get text before any reply
    const mainContent = text.slice(0, cutoffIndex).trim();
    
    // Clean up the text more loosely
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

// Create array of entries with word counts
const wordCounts = entries.map(entry => {
    const song = songs.find(s => s.number === entry.number);
    return {
        number: entry.number,
        title: `${song.song} by ${song.artist}`,
        wordCount: countWordsBeforeReply(entry.textBody)
    };
});

// Sort by entry number
wordCounts.sort((a, b) => a.number - b.number);

// Create CSV content
const csvContent = ['Entry #,Title,Word Count'];
wordCounts.forEach(entry => {
    csvContent.push(`${entry.number},"${entry.title}",${entry.wordCount}`);
});

// Write to file
fs.writeFileSync('word_counts.csv', csvContent.join('\n'));

console.log('Word counts have been written to word_counts.csv'); 