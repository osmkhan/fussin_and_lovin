const fs = require('fs').promises;
const path = require('path');
const csv = require('csv-parse/sync');
const axios = require('axios');

class SongWikiDataExtractor {
    constructor() {
        this.baseUrl = 'https://en.wikipedia.org/w/api.php';
        this.results = [];
    }

    async loadSongsFromCSV(filePath) {
        try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            const records = csv.parse(fileContent, {
                columns: true,
                skip_empty_lines: true
            });
            return records;
        } catch (error) {
            console.error('Error loading CSV file:', error.message);
            throw error;
        }
    }

    async searchWikipedia(query) {
        try {
            const response = await axios.get(this.baseUrl, {
                params: {
                    action: 'query',
                    list: 'search',
                    srsearch: query,
                    format: 'json',
                    srlimit: 5
                }
            });
            return response.data.query.search;
        } catch (error) {
            console.error(`Error searching Wikipedia for "${query}":`, error.message);
            return [];
        }
    }

    async getPageContent(pageId) {
        try {
            const response = await axios.get(this.baseUrl, {
                params: {
                    action: 'query',
                    prop: 'extracts',
                    exintro: true,
                    explaintext: true,
                    pageids: pageId,
                    format: 'json'
                }
            });
            return response.data.query.pages[pageId];
        } catch (error) {
            console.error(`Error fetching page content for page ID ${pageId}:`, error.message);
            return null;
        }
    }

    extractPersonnelFromContent(content, mainArtist) {
        const personnel = [];
        
        // Common section headers for personnel information
        const personnelSectionHeaders = [
            'personnel',
            'credits',
            'band members',
            'lineup',
            'musicians',
            'performers',
            'recording personnel',
            'production personnel',
            'additional personnel',
            'session musicians'
        ];
        
        // Create a regex pattern for all possible headers
        const headerPattern = personnelSectionHeaders.join('|');
        const sectionRegex = new RegExp(`(?:${headerPattern})(?:\\s+on\\s+this\\s+(?:album|recording|track|song))?`, 'i');
        
        // Find all sections that might contain personnel information
        const sections = content.split(/\n\n/);
        let personnelSections = [];
        
        for (const section of sections) {
            if (sectionRegex.test(section)) {
                personnelSections.push(section);
            }
        }
        
        // If no specific personnel sections found, look for the entire content
        if (personnelSections.length === 0) {
            personnelSections = [content];
        }
        
        // Process each section to extract names
        for (const section of personnelSections) {
            // Look for bullet points or lines that might contain personnel
            const lines = section.split(/\n/);
            
            for (const line of lines) {
                // Skip lines that are too short or don't look like personnel entries
                if (line.length < 5) continue;
                
                // Look for common patterns in personnel entries
                // 1. "Name - Role" pattern
                const nameRoleMatch = line.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*[-–]\s*([^,]+)/);
                if (nameRoleMatch) {
                    const name = nameRoleMatch[1].trim();
                    if (this.isValidName(name) && !this.isMainArtist(name, mainArtist)) {
                        personnel.push(name);
                    }
                    continue;
                }
                
                // 2. "Role: Name" pattern
                const roleNameMatch = line.match(/([^:]+):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
                if (roleNameMatch) {
                    const name = roleNameMatch[2].trim();
                    if (this.isValidName(name) && !this.isMainArtist(name, mainArtist)) {
                        personnel.push(name);
                    }
                    continue;
                }
                
                // 3. Just a name (more general approach)
                const nameMatches = line.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g);
                if (nameMatches) {
                    for (const name of nameMatches) {
                        if (this.isValidName(name) && !this.isMainArtist(name, mainArtist)) {
                            personnel.push(name);
                        }
                    }
                }
            }
        }
        
        // Remove duplicates
        return [...new Set(personnel)];
    }
    
    isValidName(name) {
        // Skip common words that might be mistaken for names
        const commonWords = ['The', 'This', 'That', 'These', 'Those', 'There', 'Then', 'Than', 
                            'All', 'And', 'Or', 'But', 'For', 'Nor', 'So', 'Yet', 'With', 'Without'];
        
        if (commonWords.includes(name)) return false;
        
        // Names should be at least 5 characters and have at least one space
        if (name.length < 5) return false;
        if (!name.includes(' ')) return false;
        
        // Names should start with a capital letter
        if (!/^[A-Z]/.test(name)) return false;
        
        return true;
    }
    
    isMainArtist(name, mainArtist) {
        // Check if this name is part of the main artist
        const mainArtistParts = mainArtist.split(/[\s&,]+/);
        const nameParts = name.split(/\s+/);
        
        // If any part of the name matches any part of the main artist, it's likely the same person
        for (const namePart of nameParts) {
            if (mainArtistParts.includes(namePart)) {
                return true;
            }
        }
        
        return false;
    }

    normalizeArtistName(name) {
        // Handle band names vs. individual names
        if (name.includes('&') || name.includes('and') || name.includes('The') || 
            name.includes('Band') || name.includes('Brothers') || name.includes('Sisters')) {
            // This is likely a band name, return as is
            return name;
        } else {
            // This is likely an individual, ensure first name last name format
            const parts = name.split(' ');
            if (parts.length >= 2) {
                return parts.join(' ');
            }
            return name;
        }
    }

    async processSong(song) {
        console.log(`Processing: ${song['Track Name']} by ${song['Main Artist']}`);
        
        // Create search query
        const searchQuery = `${song['Track Name']} ${song['Main Artist']} song`;
        
        // Search Wikipedia
        const searchResults = await this.searchWikipedia(searchQuery);
        
        if (searchResults.length === 0) {
            console.log(`No Wikipedia results found for: ${song['Track Name']}`);
            return {
                trackName: song['Track Name'],
                mainArtist: this.normalizeArtistName(song['Main Artist']),
                relatedArtists: [],
                spotifyLink: song['Spotify Link']
            };
        }
        
        // Get the most relevant page content
        const pageContent = await this.getPageContent(searchResults[0].pageid);
        
        if (!pageContent) {
            console.log(`Could not fetch content for: ${song['Track Name']}`);
            return {
                trackName: song['Track Name'],
                mainArtist: this.normalizeArtistName(song['Main Artist']),
                relatedArtists: [],
                spotifyLink: song['Spotify Link']
            };
        }
        
        // Extract personnel from the content
        const personnel = this.extractPersonnelFromContent(pageContent.extract, song['Main Artist']);
        
        // Normalize the main artist name
        const normalizedMainArtist = this.normalizeArtistName(song['Main Artist']);
        
        // Create the result object
        const result = {
            trackName: song['Track Name'],
            mainArtist: normalizedMainArtist,
            relatedArtists: personnel,
            spotifyLink: song['Spotify Link']
        };
        
        return result;
    }

    async processAllSongs(csvFilePath) {
        try {
            const songs = await this.loadSongsFromCSV(csvFilePath);
            console.log(`Loaded ${songs.length} songs from CSV`);
            
            for (const song of songs) {
                const result = await this.processSong(song);
                this.results.push(result);
                
                // Add a small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            return this.results;
        } catch (error) {
            console.error('Error processing songs:', error.message);
            throw error;
        }
    }

    async saveResults(outputPath) {
        try {
            await fs.writeFile(outputPath, JSON.stringify(this.results, null, 2));
            console.log(`Results saved to ${outputPath}`);
        } catch (error) {
            console.error('Error saving results:', error.message);
            throw error;
        }
    }
}

async function main() {
    const extractor = new SongWikiDataExtractor();
    
    try {
        const csvFilePath = path.join(__dirname, '../data/processed/songs_with_links.csv');
        const outputPath = path.join(__dirname, '../data/processed/song_personnel.json');
        
        await extractor.processAllSongs(csvFilePath);
        await extractor.saveResults(outputPath);
        
        console.log('Processing complete!');
    } catch (error) {
        console.error('Error in main:', error);
    }
}

if (require.main === module) {
    main();
}

module.exports = SongWikiDataExtractor; 