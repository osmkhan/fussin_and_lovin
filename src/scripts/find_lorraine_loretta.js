const fs = require('fs');

// Read the entries.json file
const entries = JSON.parse(fs.readFileSync('./src/data/entries.json', 'utf8'));

// Function to check for mentions
function hasMentions(text) {
  const lowerText = text.toLowerCase();
  return lowerText.includes('lorraine') || lowerText.includes('loretta') ? 1 : 0;
}

// Create CSV content
let csvContent = 'number,song,artist,has_lorraine_loretta\n';

// Process each entry
entries.forEach(entry => {
  const hasMention = hasMentions(entry.textBody);
  csvContent += `${entry.number},"${entry.song}","${entry.artist}",${hasMention}\n`;
});

// Write to file
fs.writeFileSync('./src/data/lorraine_loretta_mentions.csv', csvContent, 'utf8');

// Print summary
const totalMentions = entries.filter(entry => 
  entry.textBody.toLowerCase().includes('lorraine') || 
  entry.textBody.toLowerCase().includes('loretta')
).length;

console.log(`Found ${totalMentions} entries mentioning Lorraine or Loretta`);
console.log('Results exported to lorraine_loretta_mentions.csv'); 