const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class WikipediaQuery {
    constructor() {
        this.baseUrl = 'https://en.wikipedia.org/w/api.php';
    }

    async search(query, limit = 10) {
        try {
            const response = await axios.get(this.baseUrl, {
                params: {
                    action: 'query',
                    list: 'search',
                    srsearch: query,
                    format: 'json',
                    srlimit: limit
                }
            });
            return response.data.query.search;
        } catch (error) {
            console.error('Error searching Wikipedia:', error.message);
            throw error;
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
            console.error('Error fetching page content:', error.message);
            throw error;
        }
    }

    async saveResults(results, filename) {
        const outputPath = path.join(__dirname, '../data/processed', filename);
        await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
        console.log(`Results saved to ${outputPath}`);
    }
}

// Example usage
async function main() {
    const wiki = new WikipediaQuery();
    
    try {
        // Example: Search for songs
        const searchResults = await wiki.search('famous love songs 1990s');
        console.log('Search Results:', searchResults);

        // Get detailed content for the first result
        if (searchResults.length > 0) {
            const pageContent = await wiki.getPageContent(searchResults[0].pageid);
            console.log('Page Content:', pageContent);

            // Save results
            await wiki.saveResults({
                search: searchResults,
                content: pageContent
            }, 'wiki_results.json');
        }
    } catch (error) {
        console.error('Error in main:', error);
    }
}

if (require.main === module) {
    main();
}

module.exports = WikipediaQuery; 