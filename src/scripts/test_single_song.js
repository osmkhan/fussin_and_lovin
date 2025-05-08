const fs = require('fs');
const csv = require('csv-parse/sync');
const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');

// Helper function to clean and validate personnel names
function cleanAndValidatePersonnel(name) {
    if (!name) return null;

    // Remove common non-personnel words
    const nonPersonnelWords = [
        'album', 'after', 'alternate', 'version', 'america', 'being', 'cd', 'cassette',
        'friends', 'interview', 'liner notes', 'pdf', 'records', 'studio', 'various artists',
        'volume', 'evergreen', 'this', 'that', 'these', 'those', 'other', 'others',
        'track', 'song', 'music', 'sound', 'audio', 'mix', 'recording', 'release',
        'production', 'label', 'company', 'corporation', 'inc', 'ltd', 'llc',
        'featuring', 'feat', 'ft', 'presents', 'introduction', 'intro', 'outro',
        'bonus', 'additional', 'extra', 'special', 'guest', 'appearance'
    ];
    
    const nonPersonnelPattern = new RegExp(`\\b(${nonPersonnelWords.join('|')})\\b`, 'i');
    if (nonPersonnelPattern.test(name)) {
        return null;
    }

    // Clean up the name
    let cleanName = name
        .trim()
        .replace(/^(?:a young|the|and)\s+/i, '')
        .replace(/\s*\([^)]*\)/g, '')  // Remove parentheses and contents
        .replace(/\s+to\s+.*$/, '')    // Remove "to" and everything after
        .replace(/^(?:his|her|their)\s+/, '')
        .replace(/\s+(?:on|at|in|for)\s+.*$/, '')
        .replace(/\s*[-–]\s*.*$/, '')  // Remove everything after a dash
        .replace(/["""'']/g, '')       // Remove quotes
        .replace(/\s+/g, ' ')          // Normalize whitespace
        .trim();

    // Extract role if present
    const rolePatterns = [
        /^(.*?)\s+(?:plays|on|performing|featuring)\s+(.*?)$/i,
        /^(.*?)\s*[-–]\s*(.*?)$/i,
        /^(.*?)\s*:\s*(.*?)$/i,
        /^(.*?)\s+\((.*?)\)$/i,
        /^(.*?)\s+(?:with|and)\s+(.*?)$/i
    ];

    const validRoles = [
        'vocals', 'guitar', 'drums', 'bass', 'piano', 'organ', 'producer',
        'violin', 'cello', 'trumpet', 'saxophone', 'percussion', 'keyboard',
        'banjo', 'mandolin', 'harmonica', 'fiddle', 'dobro', 'pedal steel',
        'accordion', 'backing', 'lead', 'rhythm', 'acoustic', 'electric',
        'slide', 'steel', 'background', 'harmony', 'vocal', 'mixing',
        'mastering', 'recording', 'engineering', 'arrangement', 'strings',
        'horns', 'woodwinds', 'brass', 'synthesizer', 'programming',
        'conductor', 'orchestration', 'composition', 'songwriting'
    ];

    const rolePattern = new RegExp(validRoles.join('|'), 'i');

    for (const pattern of rolePatterns) {
        const match = cleanName.match(pattern);
        if (match) {
            const [, extractedName, role] = match;
            // Validate the role
            if (rolePattern.test(role)) {
                cleanName = extractedName.trim();
                break;
            }
        }
    }

    // Basic name validation
    if (cleanName.length < 2 || cleanName.length > 50) return null;
    if (cleanName.match(/[0-9@#$%^&*+=<>{}\\|]/)) return null;
    if (!cleanName.match(/[A-Z]/)) return null;  // Must contain at least one capital letter

    // Check for proper name format (e.g., "John Smith" or "J. Smith")
    const nameParts = cleanName.split(/\s+/);
    if (nameParts.length < 2) return null;  // Must have at least two parts
    
    // Each part should start with a capital letter and be followed by lowercase letters,
    // or be an initial (capital letter followed by optional period)
    const isValidNamePart = part => {
        return /^[A-Z][a-z']+$/.test(part) ||  // Normal name part (e.g., "John")
               /^[A-Z]\.?$/.test(part) ||      // Initial (e.g., "J" or "J.")
               /^(?:van|de|del|la|el|von|der|den|di|da|dos|das|af|mc|mac|o'|d')$/i.test(part);  // Common name prefixes
    };

    if (!nameParts.every(isValidNamePart)) return null;

    // Handle compound names (e.g., "Jean-Luc" or "Mary Jane")
    const compoundNamePattern = /^[A-Z][a-z]+[-\s][A-Z][a-z]+$/;
    if (nameParts.some(part => compoundNamePattern.test(part))) {
        return cleanName;
    }

    return cleanName;
}

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
                
                // Sort results to prioritize exact album matches and exclude tribute albums
                return results.sort((a, b) => {
                    const aTitle = a.title.toLowerCase();
                    const bTitle = b.title.toLowerCase();
                    const aTribute = aTitle.includes('tribute');
                    const bTribute = bTitle.includes('tribute');
                    
                    if (aTribute && !bTribute) return 1;
                    if (!aTribute && bTribute) return -1;
                    
                    // Prioritize exact album name matches
                    const albumNameLower = query.toLowerCase().replace(/"/g, '');
                    const aExactMatch = aTitle === albumNameLower;
                    const bExactMatch = bTitle === albumNameLower;
                    
                    if (aExactMatch && !bExactMatch) return -1;
                    if (!aExactMatch && bExactMatch) return 1;
                    
                    return 0;
                });
            } catch (error) {
                if (attempt === retries) {
                    console.error('Error searching Wikipedia:', error.message);
                    return [];
                }
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
        }
    }

    async getPageContent(pageId, retries = 3) {
        const params = {
            action: 'parse',
            pageid: pageId,
            format: 'json',
            prop: 'text'
        };

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const response = await axios.get(this.baseUrl, { params });
                const htmlContent = response.data.parse.text['*'];
                const $ = cheerio.load(htmlContent);
                
                // Print the raw content for debugging
                console.log('\n=== RAW HTML CONTENT FROM WIKIPEDIA ===');
                console.log(htmlContent.substring(0, 500) + '...');
                console.log('===================================\n');
                
                return { $, html: htmlContent };
            } catch (error) {
                if (attempt === retries) {
                    console.error('Error getting page content:', error.message);
                    return null;
                }
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
        }
    }

    extractBandMembers(content) {
        if (!content) return [];
        
        let members = new Set();
        
        // Common section headers for band members
        const sectionPatterns = [
            // Current members
            /(?:Current|Present)\s*(?:members|lineup|line-up|personnel)\s*[:\n](.*?)(?=\n\n|$)/si,
            /(?:Current|Present)\s*(?:band|group)\s*[:\n](.*?)(?=\n\n|$)/si,
            // General members
            /(?:Band|Group|Official)\s*(?:members|lineup|line-up|personnel)\s*[:\n](.*?)(?=\n\n|$)/si,
            /Members\s*[:\n](.*?)(?=\n\n|$)/si,
            /Personnel\s*[:\n](.*?)(?=\n\n|$)/si,
            /Line-?up\s*[:\n](.*?)(?=\n\n|$)/si,
            // Past members
            /(?:Past|Former|Previous)\s*(?:members|lineup|line-up|personnel)\s*[:\n](.*?)(?=\n\n|$)/si,
            // Member history
            /Member\s*history\s*[:\n](.*?)(?=\n\n|$)/si,
            /Band\s*history\s*[:\n](.*?)(?=\n\n|$)/si
        ];

        for (const pattern of sectionPatterns) {
            const match = content.match(pattern);
            if (match) {
                this.extractMembersFromSection(match[1], members);
            }
        }

        // Look for member names in text
        const memberPatterns = [
            // Name with instrument
            /([A-Z][a-zA-Z\s.]+?)(?:\s*[-–]\s*(?:vocals|guitar|bass|drums|keyboards|piano))/gm,
            // Name in parentheses with dates
            /\(([A-Z][a-zA-Z\s.]+?)(?:\s*,\s*\d{4}|\s*[-–]\s*\d{4}|\))/g,
            // Name followed by joined/left
            /([A-Z][a-zA-Z\s.]+?)\s+(?:joined|left|replaced|departed)/g
        ];

        memberPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const name = this.cleanPersonName(match[1]);
                if (name && this.isValidPersonName(name)) {
                    members.add(name);
                }
            }
        });

        return Array.from(members)
            .filter(m => this.isValidPersonName(m))
            .sort();
    }

    extractMembersFromSection(content, members) {
        const patterns = [
            // Name followed by role (with hyphen or dash)
            /^([^–-]+?)(?:[–-].*?)?$/gm,
            // Name at start of line
            /^([^–-]+?)(?=\s*[–-]|$)/gm,
            // Name in list with bullet points
            /[-–•*]\s*([^-–•*:,\n]+?)(?=\s*[-–•*]|$)/g,
            // Name in list with numbers
            /^\d+\.\s*([^–-]+?)(?=\s*[–-]|$)/gm,
            // Name in parentheses
            /\(([^)]+)\)/g,
            // Name with role after colon
            /^([^:]+?)(?::.*?)?$/gm,
            // Name with role after dash
            /^([^-]+?)(?:-.*?)?$/gm,
            // Name with role in parentheses
            /^([^(]+?)(?:\(.*?\))?$/gm
        ];

        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const person = this.cleanPersonName(match[1]);
                if (person) {
                    person.split(/\s*[,&]\s*/).forEach(p => {
                        const cleaned = this.cleanPersonName(p);
                        if (cleaned) members.add(cleaned);
                    });
                }
            }
        });
    }

    async extractPersonnel(content, trackName, mainArtist) {
        if (!content) return [];
        
        const $ = cheerio.load(content);
        let personnel = new Set();

        // Process text content
        function processText(text) {
            if (!text) return;
            const names = text.split(/[,;]|\sand\s|\swith\s|\sfeaturing\s|\sft\.\s/i)
                .map(name => name.trim())
                .filter(name => name.length > 0)
                .map(name => cleanAndValidatePersonnel(name))
                .filter(name => name !== null);
            
            names.forEach(name => personnel.add(name));
        }

        // Check infobox tables
        $('.infobox, .wikitable, .tracklist').each((_, table) => {
            $(table).find('tr').each((_, row) => {
                const label = $(row).find('th').text().toLowerCase();
                const content = $(row).find('td').text();

                // Check for personnel-related labels
                if (label.match(/personnel|member|artist|musician|performer|credit|band|lineup|contributor|collaborator|producer|engineer|mixer|recording|production/i)) {
                    processText(content);
                }

                // Check for role-specific labels
                const roleLabels = [
                    'vocals', 'guitar', 'drums', 'bass', 'piano', 'organ', 'producer',
                    'violin', 'cello', 'trumpet', 'saxophone', 'percussion', 'keyboard',
                    'banjo', 'mandolin', 'harmonica', 'fiddle', 'dobro', 'pedal steel',
                    'accordion', 'backing', 'lead', 'rhythm', 'acoustic', 'electric',
                    'slide', 'steel', 'background', 'harmony', 'vocal', 'mixing',
                    'mastering', 'recording', 'engineering', 'arrangement'
                ];

                const rolePattern = new RegExp(roleLabels.join('|'), 'i');
                if (rolePattern.test(label)) {
                    processText(content);
                }
            });
        });

        // Check section headings and their content
        const sectionHeaders = [
            'Personnel', 'Credits', 'Musicians', 'Band members', 'Line-up',
            'Recording', 'Production', 'Additional personnel', 'Session musicians',
            'Featured artists', 'Contributors', 'Performers', 'Band', 'Members',
            'Track personnel', 'Album personnel', 'Studio personnel', 'Live personnel',
            'Backing band', 'Touring band', 'Session credits', 'Production credits'
        ];

        const headerPattern = new RegExp(sectionHeaders.join('|'), 'i');
        $('h2, h3, h4').each((_, heading) => {
            const headingText = $(heading).text().toLowerCase();
            if (headerPattern.test(headingText)) {
                // Process the content until the next heading
                let content = '';
                let currentElement = $(heading).next();
                
                while (currentElement.length && !currentElement.is('h2, h3, h4')) {
                    if (currentElement.is('p, li')) {
                        content += currentElement.text() + '\n';
                    } else if (currentElement.is('table')) {
                        currentElement.find('tr').each((_, row) => {
                            content += $(row).text() + '\n';
                        });
                    } else if (currentElement.is('div')) {
                        // Handle divs that might contain personnel info
                        const divText = currentElement.text();
                        if (divText.match(/featuring|feat\.|ft\.|with|by|plays|performs|produced|engineered|mixed|recorded/i)) {
                            content += divText + '\n';
                        }
                    }
                    currentElement = currentElement.next();
                }
                
                processText(content);
            }
        });

        // Check lists and paragraphs near relevant keywords
        $('p, li, div').each((_, element) => {
            const text = $(element).text();
            if (text.match(/featuring|guest|accompanied by|performed by|recorded by|produced by|engineered by|mixed by|arranged by|with|plays|performs/i)) {
                processText(text);
            }
        });

        // Check track listings for featured artists and credits
        $('table').each((_, table) => {
            const tableText = $(table).text().toLowerCase();
            if (tableText.includes('track') || tableText.includes('song') || 
                tableText.includes('credit') || tableText.includes('personnel')) {
                $(table).find('tr').each((_, row) => {
                    const cells = $(row).find('td');
                    cells.each((_, cell) => {
                        const cellText = $(cell).text();
                        if (cellText.match(/featuring|feat\.|ft\.|with|by|plays|performs|produced|engineered|mixed|recorded/i)) {
                            processText(cellText);
                        }
                    });
                });
            }
        });

        // Check for specific role patterns in any element
        const rolePatterns = [
            'vocals', 'guitar', 'drums', 'bass', 'piano', 'organ', 'producer',
            'violin', 'cello', 'trumpet', 'saxophone', 'percussion', 'keyboard',
            'banjo', 'mandolin', 'harmonica', 'fiddle', 'dobro', 'pedal steel',
            'accordion', 'backing', 'lead', 'rhythm', 'acoustic', 'electric',
            'slide', 'steel', 'background', 'harmony', 'vocal', 'mixing',
            'mastering', 'recording', 'engineering', 'arrangement'
        ];

        rolePatterns.forEach(role => {
            $(`*:contains("${role}")`).each((_, el) => {
                const text = $(el).text();
                if (text.match(new RegExp(`[A-Z][a-zA-Z\\s]+\\s*[-–]\\s*${role}`, 'i'))) {
                    processText(text);
                }
            });
        });

        return Array.from(personnel)
            .filter(name => this.isValidPersonName(name) && !this.isBandName(name))
            .filter(name => {
                const nameLower = name.toLowerCase();
                const mainArtistParts = mainArtist.toLowerCase().split(/[&,\s]+/);
                return !mainArtistParts.some(part => 
                    part.length > 3 && nameLower.includes(part)
                );
            })
            .sort();
    }

    extractNamesFromText(text, personnel) {
        if (!text) return;

        // Split on common delimiters
        const parts = text.split(/[,;]|\sand\s|\swith\s|\sfeaturing\s|\sft\.\s|\spresents\s/i);
        
        parts.forEach(part => {
            // Look for name patterns
            const namePatterns = [
                // Name with role
                /([A-Z][a-zA-Z\s.'-]+?)(?:\s*[-–]\s*(?:vocals|guitar|bass|drums|keyboards|piano|producer|engineer|mixer|arrangement))/i,
                // Standalone name
                /([A-Z][a-zA-Z\s.'-]+?)(?=\s*$|\s*\()/,
                // Name in parentheses
                /\(([A-Z][a-zA-Z\s.'-]+?)\)/
            ];

            namePatterns.forEach(pattern => {
                const match = part.match(pattern);
                if (match) {
                    const name = this.cleanPersonName(match[1]);
                    if (name && this.isValidPersonName(name)) {
                        personnel.add(name);
                    }
                }
            });
        });
    }

    cleanPersonName(name) {
        if (!name) return null;
        
        let cleaned = name
            .trim()
            .replace(/^(?:a young|the|and)\s+/i, '')
            .replace(/\s*\([^)]*\)/g, '')  // Remove parentheses and contents
            .replace(/\s+to\s+.*$/, '')    // Remove "to" and everything after
            .replace(/^(?:his|her|their)\s+/, '')
            .replace(/\s+(?:on|at|in|for)\s+.*$/, '')
            .replace(/^[^a-zA-Z]+/, '')    // Remove leading non-letters
            .replace(/[^a-zA-Z\s-]+$/, '') // Remove trailing non-letters (allow hyphens)
            .trim();

        return this.formatPersonName(cleaned);
    }

    formatPersonName(name) {
        if (!name) return null;

        // Split on spaces and hyphens, preserving hyphens
        const parts = name.split(/\s+|-/).filter(Boolean);
        const formattedParts = parts.map((part, index) => {
            // Convert to lowercase first
            part = part.toLowerCase();
            
            // Handle hyphenated names
            if (part.includes('-')) {
                return part.split('-')
                    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
                    .join('-');
            }

            // Capitalize first letter
            return part.charAt(0).toUpperCase() + part.slice(1);
        });

        // Rejoin with spaces
        return formattedParts.join(' ');
    }

    isBandName(name) {
        if (!name) return false;
        
        const bandIndicators = [
            /^the\s/i,  // Starts with "The"
            /\sband$/i,  // Ends with "Band"
            /\sgroup$/i,  // Ends with "Group"
            /\sensemble$/i,  // Ends with "Ensemble"
            /\sorchestra$/i,  // Ends with "Orchestra"
            /\squartet$/i,  // Ends with "Quartet"
            /\strio$/i,  // Ends with "Trio"
            /\sduo$/i,  // Ends with "Duo"
            /\sproject$/i,  // Ends with "Project"
            /\scollective$/i,  // Ends with "Collective"
            /\screw$/i,  // Ends with "Crew"
            /\sgang$/i,  // Ends with "Gang"
            /\scompany$/i,  // Ends with "Company"
            /\sboys$/i,  // Ends with "Boys"
            /\sgirls$/i,  // Ends with "Girls"
            /\smen$/i,  // Ends with "Men"
            /\swomen$/i  // Ends with "Women"
        ];

        // Check if it's a collaboration (contains & or "and")
        if (name.includes('&') || name.toLowerCase().includes(' and ')) {
            return false;
        }

        // Check for band indicators
        return bandIndicators.some(pattern => pattern.test(name));
    }

    isValidPersonName(name) {
        // Skip if name is too short or too long
        if (name.length < 2 || name.length > 50) return false;

        // Skip if name contains invalid patterns
        const invalidWords = [
            'award', 'grammy', 'billboard', 'chart', 'album', 'song', 'track',
            'record', 'music', 'solo', 'musician', 'artist', 'singer', 'guitarist',
            'drummer', 'bassist', 'pianist', 'producer', 'engineer', 'mixer',
            'arranger', 'composer', 'writer', 'performer', 'vocalist', 'instrumentalist',
            'session', 'studio', 'live', 'concert', 'tour', 'festival', 'show',
            'performance', 'release', 'label', 'company', 'corporation', 'inc',
            'llc', 'ltd', 'co', 'corp', 'entertainment', 'media', 'records',
            'publishing', 'production', 'management', 'agency', 'god', 'humanities',
            'no', 'yes', 'best', 'top', 'hit', 'new', 'old', 'first', 'last',
            'next', 'previous', 'current', 'former', 'future', 'present', 'past'
        ];

        const invalidStartWords = [
            'the', 'and', 'or', 'a', 'an', 'in', 'on', 'at', 'to', 'for',
            'with', 'by', 'from', 'of', 'as', 'is', 'was', 'were', 'be',
            'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
            'will', 'would', 'shall', 'should', 'may', 'might', 'must',
            'can', 'could'
        ];

        // Allow certain compound names and band names
        const validCompoundNames = [
            'Drive-By Truckers',
            'Flying Burrito Brothers',
            'Cowboy Junkies',
            'Lost Dog Street Band'
        ];

        // Check if it's a valid compound name
        if (validCompoundNames.includes(name)) {
            return true;
        }

        // Check if name contains any invalid words
        if (invalidWords.some(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'i');
            return regex.test(name);
        })) {
            return false;
        }

        // Check if name starts with any invalid words
        if (invalidStartWords.some(word => {
            const regex = new RegExp(`^${word}\\s`, 'i');
            return regex.test(name);
        })) {
            return false;
        }

        // Skip if name contains numbers or special characters (except hyphen and apostrophe)
        if (/[0-9]/.test(name) || /[^a-zA-Z\s'-]/.test(name)) {
            return false;
        }

        // Must start with a capital letter
        if (!/^[A-Z]/.test(name)) {
            return false;
        }

        // Allow names with hyphens (e.g., Jean-Luc)
        if (name.includes('-')) {
            const parts = name.split('-');
            return parts.every(part => /^[A-Z][a-z]+$/.test(part.trim()));
        }

        // Must be a proper name format (First Last, First M. Last, etc.)
        const nameParts = name.split(/\s+/);
        return nameParts.every(part => /^[A-Z][a-z]+$/.test(part) || /^[A-Z]\.?$/.test(part));
    }

    async searchAndExtract(song) {
        // Try different search queries
        const searchQueries = [
            `"${song.albumName}" album ${song.mainArtist}`,  // Search for the album first
            `"${song.albumName}" ${song.mainArtist} album`,  // Alternative album search
            `${song.mainArtist} ${song.albumName}`,          // Broader search
        ];

        let allPersonnel = new Set();
        let foundPages = new Set();

        for (const searchQuery of searchQueries) {
            console.log(`Trying search query: ${searchQuery}`);
            const searchResults = await this.searchWikipedia(searchQuery);
            console.log(`Found ${searchResults.length} search results`);

            for (let i = 0; i < searchResults.length; i++) {
                const result = searchResults[i];
                const pageUrl = `https://en.wikipedia.org/?curid=${result.pageid}`;
                console.log(`Result ${i + 1}: ${result.title} (ID: ${result.pageid})`);
                console.log(`URL: ${pageUrl}`);
                console.log(`Snippet: ${result.snippet}\n`);

                const pageContent = await this.getPageContent(result.pageid);
                if (pageContent && pageContent.$) {
                    console.log(`Analyzing content from: ${result.title}`);
                    
                    const personnel = await this.extractPersonnel(pageContent.$);
                    if (personnel.length > 0) {
                        console.log(`Found ${personnel.length} personnel in this page:`, personnel);
                        personnel.forEach(p => allPersonnel.add(p));
                    }
                    foundPages.add(pageUrl);
                }

                // Stop after checking 3 results for each query
                if (i >= 2) break;
            }

            // If we found personnel, no need to try more queries
            if (allPersonnel.size > 0) break;
        }

        return {
            trackName: song.trackName,
            mainArtist: song.mainArtist,
            relatedArtists: Array.from(allPersonnel),
            spotifyLink: song.spotifyLink,
            wikipediaPages: Array.from(foundPages)
        };
    }
}

async function loadSongsFromCSV() {
    const fileContent = fs.readFileSync(path.join(__dirname, '../data/processed/songs_with_links_albums.csv'), 'utf-8');
    const records = csv.parse(fileContent, {
        columns: true,
        skip_empty_lines: true
    });

    // Process first 10 songs
    return records.slice(0, 10).map(record => ({
        trackName: record['Track Name'],
        mainArtist: record['Main Artist'],
        albumName: record['Album'],
        spotifyLink: record['Spotify Link']
    }));
}

async function main() {
    try {
        // Load songs from CSV
        const songs = await loadSongsFromCSV();
        console.log(`\nLoaded ${songs.length} songs from CSV\n`);

        // Process each song
        for (let i = 0; i < songs.length; i++) {
            const song = songs[i];
            console.log('\n========================================');
            console.log(`Processing Song ${i + 1}:`);
            console.log(`${song.trackName} by ${song.mainArtist} from album ${song.albumName}`);
            console.log('========================================\n');

            const extractor = new SongWikiDataExtractor();
            const result = await extractor.searchAndExtract(song);

            // Filter out any artists that are just arrays or objects
            if (result.relatedArtists) {
                result.relatedArtists = result.relatedArtists
                    .filter(artist => typeof artist === 'string')
                    .filter(artist => {
                        const cleanedArtist = cleanAndValidatePersonnel(artist);
                        return cleanedArtist !== null;
                    });
            }

            console.log('\nResult for this song:');
            console.log(JSON.stringify(result, null, 2));
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

main().catch(console.error); 