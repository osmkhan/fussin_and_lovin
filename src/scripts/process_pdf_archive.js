const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const csv = require('csv-writer').createObjectCsvWriter;

const PDF_PATH = path.join(__dirname, '../../public/Fussin\' and Lovin\' Archive-2.pdf');
const OUTPUT_PATH = path.join(__dirname, '../../src/data/raw/pdf_archive.txt');
const CSV_OUTPUT_PATH = path.join(__dirname, '../../src/data/raw/pdf_parsed_entries.csv');

function extractSongInfo(text) {
    // Extract song number and title
    const songMatch = text.match(/Song #(\d+):\s*"([^"]+)"/);
    if (!songMatch) {
        return null;
    }
    return {
        entry_number: songMatch[1],
        song_title: songMatch[2],
        text_body: text.trim()
    };
}

function cleanText(text) {
    // Remove extra whitespace and normalize line endings
    return text.replace(/\n\s*\n/g, '\n\n').trim();
}

async function processPDF() {
    try {
        console.log('Reading PDF file...');
        const dataBuffer = fs.readFileSync(PDF_PATH);
        
        console.log('Parsing PDF content...');
        const data = await pdfParse(dataBuffer);
        
        // Extract text content
        const text = data.text;
        
        // Write raw text to file for inspection
        fs.writeFileSync(OUTPUT_PATH, text);
        console.log(`Raw text written to ${OUTPUT_PATH}`);
        
        // Split by the main delimiter
        const rawEntries = text.split('////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////');
        console.log(`Found ${rawEntries.length} potential entries`);
        
        // Process entries
        const entries = [];
        for (const entry of rawEntries) {
            if (!entry.trim()) continue;
            
            const songInfo = extractSongInfo(entry);
            if (songInfo) {
                entries.push({
                    entry_number: songInfo.entry_number,
                    song_title: songInfo.song_title,
                    text_body: cleanText(entry)
                });
            }
        }
        
        // Write to CSV
        const writer = csv({
            path: CSV_OUTPUT_PATH,
            header: [
                {id: 'entry_number', title: 'entry_number'},
                {id: 'song_title', title: 'song_title'},
                {id: 'text_body', title: 'text_body'}
            ]
        });
        
        await writer.writeRecords(entries);
        console.log(`Successfully processed ${entries.length} entries to ${CSV_OUTPUT_PATH}`);
        console.log(`Total pages: ${data.numpages}`);
        console.log(`Total text length: ${text.length} characters`);
        
    } catch (error) {
        console.error('Error processing PDF:', error);
    }
}

// Run the script
processPDF(); 