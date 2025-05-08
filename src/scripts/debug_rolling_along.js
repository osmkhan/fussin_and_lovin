const fs = require('fs');
const csv = require('csv-parse/sync');
const axios = require('axios');
const path = require('path');

class SongWikiDataExtractor {
    constructor() {
        this.baseUrl = 'https://en.wikipedia.org/w/api.php';
    }

    async searchWikipedia(query, retries = 3) {
        const params = {
            action: 'query',
            list: 'search',
            srsearch: query,
            format: 'json',
            srlimit: 10,
            srwhat: 'text'
        };

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const response = await axios.get(this.baseUrl, { params });
                const results = response.data.query.search;
                return results;
            } catch (error) {
                if (attempt === retries) {
                    console.error('Error searching Wikipedia:', error.message);
                    return [];
                }
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
        }
    }

    async getPageContent(pageId, retries = 3) {
        const params = {
            action: 'parse',
            pageid: pageId,
            format: 'json',
            prop: 'text',
            section: 0
        };

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const response = await axios.get(this.baseUrl, { params });
                const content = response.data.parse.text['*'];
                return content;
            } catch (error) {
                if (attempt === retries) {
                    console.error('Error getting page content:', error.message);
                    return null;
                }
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
        }
    }

    async extractPersonnel(content) {
        if (!content) return [];
        
        let personnel = new Set();
        
        // Debug: Print the raw content
        console.log('\n=== RAW CONTENT ===');
        console.log(content);
        console.log('===================\n');

        // Look for tables with personnel information
        const tablePatterns = [
            // Infobox tables
            /<table[^>]*class="infobox[^>]*>(.*?)<\/table>/gsi,
            // Track listing tables
            /<table[^>]*class="tracklist[^>]*>(.*?)<\/table>/gsi,
            // Personnel/credits tables
            /<table[^>]*class="(?:personnel|credits)[^>]*>(.*?)<\/table>/gsi
        ];

        // Look for specific sections
        const sectionPatterns = [
            // Personnel/Credits sections with headers
            /<h[2-3][^>]*>(?:Personnel|Credits|Musicians|Band members|Production|Recording)<\/h[2-3]>(.*?)(?:<h[2-3]|$)/gsi,
            // Lists in sections
            /<ul[^>]*>(.*?)<\/ul>/gsi
        ];

        // Extract names from tables
        for (const pattern of tablePatterns) {
            console.log(`\n=== Testing table pattern: ${pattern} ===`);
            const matches = content.matchAll(pattern);
            for (const match of Array.from(matches)) {
                if (match[1]) {
                    console.log('Found table:', match[1]);
                    
                    // Look for cells with roles and names
                    const cellMatches = match[1].matchAll(/<td[^>]*>(?:vocals|guitar|bass|drums|producer|engineer|featuring|with)[^<]*?:\s*([^<]+)<\/td>|<td[^>]*>([^<]+)<\/td>/gi);
                    for (const cellMatch of Array.from(cellMatches)) {
                        const name = (cellMatch[1] || cellMatch[2] || '').trim();
                        if (name && this.isValidPersonName(name)) {
                            console.log('Found name in table:', name);
                            personnel.add(name);
                        }
                    }
                }
            }
        }

        // Extract names from sections
        for (const pattern of sectionPatterns) {
            console.log(`\n=== Testing section pattern: ${pattern} ===`);
            const matches = content.matchAll(pattern);
            for (const match of Array.from(matches)) {
                if (match[1]) {
                    console.log('Found section:', match[1]);
                    
                    // Look for names in lists and paragraphs
                    const nameMatches = match[1].matchAll(/<li[^>]*>([^<]+)<\/li>|<p[^>]*>([^<]+)<\/p>|(?:featuring|with|by)\s+([^,;<]+)[,;<]/gi);
                    for (const nameMatch of Array.from(nameMatches)) {
                        const name = (nameMatch[1] || nameMatch[2] || nameMatch[3] || '').trim();
                        if (name && this.isValidPersonName(name)) {
                            console.log('Found name in section:', name);
                            personnel.add(name);
                        }
                    }
                }
            }
        }

        return Array.from(personnel);
    }

    isValidPersonName(name) {
        // Skip if name is too short or too long
        if (name.length < 2 || name.length > 50) return false;

        // Skip if name contains invalid patterns
        const invalidWords = [
            'award', 'grammy', 'billboard', 'chart', 'album', 'song', 'track',
            'record', 'music', 'band', 'group', 'solo', 'musician', 'artist',
            'singer', 'guitarist', 'drummer', 'bassist', 'pianist', 'producer',
            'engineer', 'mixer', 'arranger', 'composer', 'writer', 'performer',
            'vocalist', 'instrumentalist', 'session', 'studio', 'live', 'concert',
            'tour', 'festival', 'show', 'performance', 'release', 'label', 'company',
            'corporation', 'inc', 'llc', 'ltd', 'co', 'corp', 'entertainment',
            'media', 'records', 'recordings', 'productions', 'publishing'
        ];

        // Skip if name starts with common invalid words
        if (invalidWords.some(word => name.toLowerCase().startsWith(word + ' '))) return false;

        // Skip if name contains only lowercase letters (likely not a proper name)
        if (name === name.toLowerCase()) return false;

        // Skip if name contains numbers or special characters
        if (/[0-9@#$%^&*()_+=\[\]{}|\\<>?]/.test(name)) return false;

        return true;
    }
}

async function main() {
    const extractor = new SongWikiDataExtractor();
    
    console.log('Searching for "Happy Woman Blues" album Lucinda Williams...');
    const searchResults = await extractor.searchWikipedia('"Happy Woman Blues" album Lucinda Williams');
    
    console.log('\n=== SEARCH RESULTS ===');
    searchResults.forEach((result, index) => {
        console.log(`\nResult ${index + 1}:`);
        console.log(`Title: ${result.title}`);
        console.log(`Page ID: ${result.pageid}`);
        console.log(`Snippet: ${result.snippet}`);
    });

    // Get content for each page
    for (const result of searchResults) {
        console.log(`\n=== ANALYZING PAGE: ${result.title} ===`);
        const content = await extractor.getPageContent(result.pageid);
        const personnel = await extractor.extractPersonnel(content);
        console.log('\nExtracted personnel:', personnel);
    }
}

main().catch(console.error); 