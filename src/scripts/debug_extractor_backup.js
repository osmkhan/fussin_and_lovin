import axios from 'axios';
import * as cheerio from 'cheerio';

const WIKI_API = 'https://en.wikipedia.org/w/api.php';

async function searchWiki(query, albumName) {
  // Add "(album)" to the search query to be more specific
  const albumQuery = `${albumName} (album) ${query.split(albumName)[1]}`;
  console.log(`\nSearching Wikipedia for: ${albumQuery}`);
  
  const res = await axios.get(WIKI_API, {
    params: {
      action: 'query',
      list: 'search',
      srsearch: albumQuery,
      format: 'json',
      utf8: 1
    }
  });
  
  // Filter results to only include those with album name in title
  const filteredResults = res.data.query.search.filter(result => 
    result.title.toLowerCase().includes(albumName.toLowerCase())
  );
  
  if (filteredResults.length > 0) {
    console.log(`Found matching album: ${filteredResults[0].title} (pageid: ${filteredResults[0].pageid})`);
    return [filteredResults[0]]; // Only return the first match
  } else {
    console.log('No matching albums found');
    return [];
  }
}

async function getWikiSections(pageid) {
  const res = await axios.get(WIKI_API, {
    params: {
      action: 'parse',
      pageid,
      prop: 'sections',
      format: 'json'
    }
  });
  
  const sections = res.data.parse.sections;
  const personnelSection = sections.find(s => 
    s.line.toLowerCase().includes('personnel') || 
    s.anchor.toLowerCase().includes('personnel')
  );
  
  return personnelSection;
}

async function getWikiSectionContent(pageid, section) {
  const res = await axios.get(WIKI_API, {
    params: {
      action: 'parse',
      pageid,
      section: section.index,
      prop: 'text',
      format: 'json'
    }
  });
  
  return cheerio.load(res.data.parse.text['*']);
}

function formatPersonnelSection($) {
  const sections = {};
  let currentSection = 'General';
  
  // Get all list items and paragraphs
  $('ul li, p').each((_, el) => {
    const text = $(el).text().trim();
    if (!text || text.includes('[edit]') || text.includes('v t e')) return;
    
    // Check if this is a section header
    if (text.endsWith(':')) {
      currentSection = text.slice(0, -1);
      sections[currentSection] = [];
    } else {
      if (!sections[currentSection]) {
        sections[currentSection] = [];
      }
      sections[currentSection].push(text);
    }
  });
  
  return sections;
}

async function extractPersonnel(albumName, artist) {
  console.log(`\nLooking up: ${albumName} by ${artist}\n`);
  
  const results = await searchWiki(`${albumName} ${artist}`, albumName);
  
  for (const result of results) {
    console.log(`\nChecking article: ${result.title}`);
    
    const personnelSection = await getWikiSections(result.pageid);
    if (!personnelSection) {
      console.log('No Personnel section found, skipping...');
      continue;
    }
    
    console.log(`Found Personnel section: ${personnelSection.line}`);
    const $ = await getWikiSectionContent(result.pageid, personnelSection);
    
    const sections = formatPersonnelSection($);
    return {
      albumTitle: result.title,
      personnel: sections
    };
  }
  
  return null;
}

// Test with some example albums
async function main() {
  const albums = [
    { name: "Linda Ronstadt", artist: "Linda Ronstadt" },
    { name: "Grievous Angel", artist: "Gram Parsons" }
  ];

  for (const album of albums) {
    const result = await extractPersonnel(album.name, album.artist);
    if (result) {
      console.log('\nAlbum:', result.albumTitle);
      console.log('Personnel:');
      for (const [section, items] of Object.entries(result.personnel)) {
        console.log(`\n${section}:`);
        items.forEach(item => console.log(`  - ${item}`));
      }
    }
    console.log('\n' + '-'.repeat(80) + '\n');
  }
}

main(); 