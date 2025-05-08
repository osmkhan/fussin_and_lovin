const fs = require('fs');
const Papa = require('papaparse');

// Function to convert CSV to JSON
function convertCSVToJSON(inputFile, outputFile) {
  const csvContent = fs.readFileSync(inputFile, 'utf-8');
  Papa.parse(csvContent, {
    header: true,
    complete: (results) => {
      // Clean and optimize the data
      const optimizedData = results.data.map(row => ({
        number: parseInt(row['Number']) || 0,
        song: row['Track Name'],
        artist: row['Main Artist'],
        album: row['Album'],
        spotifyLink: row['Spotify Link'],
        textBody: row['text_body'],
        artistWiki: row['Artist Wikipedia'],
        albumWiki: row['Album Wikipedia'],
        relatedArtists: {
          album: row['Related Artists - Album'] ? row['Related Artists - Album'].split('; ').filter(Boolean) : [],
          other: row['Related Artists - Other'] ? row['Related Artists - Other'].split('; ').filter(Boolean) : []
        }
      })).filter(item => item.song && item.artist); // Remove any empty entries

      // Sort by number
      optimizedData.sort((a, b) => a.number - b.number);

      // Write to JSON file
      fs.writeFileSync(outputFile, JSON.stringify(optimizedData, null, 2));
      console.log(`Converted ${inputFile} to ${outputFile}`);
    }
  });
}

// Add a script to create a new CSV with main artist in 'Related Artists - Album' if not already present
const inputCSV = 'public/songs_albums_entries_fixed.csv';
const outputCSV = 'public/songs_albums_entries_with_self.csv';

function addSelfToRelatedAlbumArtists(inputFile, outputFile) {
  const csvContent = fs.readFileSync(inputFile, 'utf-8');
  Papa.parse(csvContent, {
    header: true,
    complete: (results) => {
      const updatedRows = results.data.map(row => {
        let rel = row['Related Artists - Album'] || '';
        const mainArtist = row['Main Artist']?.trim();
        const relArr = rel.split(';').map(s => s.trim()).filter(Boolean);
        if (mainArtist && !relArr.includes(mainArtist)) {
          relArr.push(mainArtist);
        }
        return {
          ...row,
          'Related Artists - Album': relArr.join('; ')
        };
      });
      // Write new CSV
      const csv = Papa.unparse(updatedRows);
      fs.writeFileSync(outputFile, csv);
      console.log(`Created ${outputFile} with main artist in related album artists.`);
    }
  });
}

addSelfToRelatedAlbumArtists(inputCSV, outputCSV);

// Convert both files
convertCSVToJSON('public/songs_with_links_albums_enriched.csv', 'src/data/songs.json');
convertCSVToJSON('public/songs_albums_entries_fixed.csv', 'src/data/entries.json'); 