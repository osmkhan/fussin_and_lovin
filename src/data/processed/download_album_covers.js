// download_album_covers.js
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { parse } from 'csv-parse/sync';
import sharp from 'sharp';

const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const INPUT_CSV = '/Users/osmankhan/Desktop/data/code_projects/fussin_and_lovin/build/songs_albums_entries_fixed.csv';
const OUTPUT_DIR = 'covers';                       // all PNGs land here
await fs.mkdir(OUTPUT_DIR, { recursive: true });

/* ---------- helpers ---------- */
async function readRows(file) {
  const raw = await fs.readFile(file, 'utf8');
  return parse(raw, { columns: true, skip_empty_lines: true });
}

function safeName(songId, album) {
  const safeAlbum = album.replace(/[^\w\-]+/g, '_').slice(0, 60);
  return `${songId}_${safeAlbum}.png`;
}

async function getPageId(wikiUrl) {
  if (!wikiUrl) return null;
  const match = wikiUrl.match(/curid=(\d+)/);
  return match ? match[1] : null;
}

async function getCoverUrl(pageid, albumName) {
  if (!pageid) return null;
  
  // First get all images and their metadata
  const { data } = await axios.get(WIKI_API, {
    params: {
      action: 'query',
      pageids: pageid,
      prop: 'images|revisions',
      imlimit: 50,
      rvprop: 'content',
      format: 'json',
      utf8: 1
    }
  });
  
  const page = data.query.pages[pageid];
  if (!page.images) {
    console.log(`No images found for page ID ${pageid}`);
    return null;
  }

  // Get the page content to help identify the main album cover
  const pageContent = page.revisions?.[0]?.['*'] || '';
  
  // Score each image based on various factors
  const scoredImages = await Promise.all(page.images.map(async (img) => {
    const title = img.title.toLowerCase();
    let score = 0;
    
    // Check image title
    if (title.includes('album cover')) score += 15;
    if (title.includes('album artwork')) score += 15;
    if (title.includes('cover art')) score += 15;
    if (title.includes('album sleeve')) score += 15;
    if (title.includes('front cover')) score += 12;
    if (title.includes('cd cover')) score += 12;
    if (title.includes('lp cover')) score += 12;
    if (title.includes('vinyl')) score += 8;
    
    // Penalize likely non-covers
    if (title.includes('portrait')) score -= 20;
    if (title.includes('photo')) score -= 15;
    if (title.includes('live')) score -= 10;
    if (title.includes('concert')) score -= 10;
    if (title.includes('logo')) score -= 10;
    if (title.includes('icon')) score -= 15;
    if (title.includes('svg')) score -= 10;
    if (title.includes('button')) score -= 15;
    if (title.includes('ui')) score -= 15;
    
    // Check if image appears near relevant text in page content
    const albumNameWords = albumName.toLowerCase().split(/\s+/);
    const nearbyText = pageContent.substring(
      Math.max(0, pageContent.toLowerCase().indexOf(title) - 100),
      pageContent.toLowerCase().indexOf(title) + 100
    );
    
    if (nearbyText.toLowerCase().includes('cover')) score += 8;
    if (nearbyText.toLowerCase().includes('artwork')) score += 8;
    if (albumNameWords.some(word => nearbyText.toLowerCase().includes(word))) score += 5;
    
    // Get image info to check dimensions
    const { data: imageData } = await axios.get(WIKI_API, {
      params: {
        action: 'query',
        titles: img.title,
        prop: 'imageinfo',
        iiprop: 'url|size|mime|dimensions',
        format: 'json',
        utf8: 1
      }
    });
    
    const imageInfo = Object.values(imageData.query.pages)[0]?.imageinfo?.[0];
    if (imageInfo) {
      // Prefer square-ish images (typical for album covers)
      if (imageInfo.width && imageInfo.height) {
        const ratio = imageInfo.width / imageInfo.height;
        if (ratio >= 0.9 && ratio <= 1.1) score += 10;
        if (ratio >= 0.8 && ratio <= 1.2) score += 5;
        if (ratio >= 0.7 && ratio <= 1.3) score += 2;
        
        // Prefer larger images
        const minDimension = Math.min(imageInfo.width, imageInfo.height);
        if (minDimension >= 1000) score += 10;
        else if (minDimension >= 500) score += 5;
        else if (minDimension >= 300) score += 2;
      }
      
      // Prefer larger images, but not too large
      if (imageInfo.size) {
        if (imageInfo.size > 100000 && imageInfo.size < 2000000) score += 5;
      }
      
      // Penalize SVG and other non-photo formats
      if (imageInfo.mime) {
        if (imageInfo.mime === 'image/svg+xml') score -= 20;
        if (imageInfo.mime === 'image/png' && imageInfo.size < 50000) score -= 10;
      }
      
      return {
        title: img.title,
        score,
        url: imageInfo.url,
        mime: imageInfo.mime,
        width: imageInfo.width,
        height: imageInfo.height,
        size: imageInfo.size
      };
    }
    
    return null;
  }));
  
  // Filter out null results and sort by score
  const validImages = scoredImages
    .filter(img => img !== null && img.mime?.startsWith('image/'))
    .sort((a, b) => b.score - a.score);
  
  if (validImages.length > 0) {
    console.log(`Found ${validImages.length} images for "${albumName}"`);
    console.log(`Best match: "${validImages[0].title}" (score: ${validImages[0].score}, size: ${validImages[0].size}, dimensions: ${validImages[0].width}x${validImages[0].height})`);
    return validImages[0].url;
  }
  
  return null;
}

/* ---------- main ---------- */
(async () => {
  const rows = await readRows(INPUT_CSV);
  const processedAlbums = new Set(); // Track albums we've already processed
  const albumToSongIds = {}; // Map albums to all their song IDs
  const smallFiles = new Set(); // Track files that need reprocessing

  // First pass: group songs by album and identify small files
  for (const r of rows) {
    if (!albumToSongIds[r['Album']]) {
      albumToSongIds[r['Album']] = [];
    }
    albumToSongIds[r['Album']].push(r['Number']);
    
    // Check if this album's cover file is small or needs reprocessing
    const outPath = path.join(OUTPUT_DIR, safeName(r['Number'], r['Album']));
    try {
      const stats = await fs.stat(outPath);
      if (stats.size < 5000) {
        smallFiles.add(r['Album']);
      } else {
        // Check image dimensions
        const metadata = await sharp(outPath).metadata();
        if (!metadata.width || !metadata.height) {
          smallFiles.add(r['Album']);
        } else {
          const ratio = metadata.width / metadata.height;
          if (ratio < 0.7 || ratio > 1.3) {
            smallFiles.add(r['Album']);
          }
        }
      }
    } catch (err) {
      // File doesn't exist, consider it small
      smallFiles.add(r['Album']);
    }
  }

  // Second pass: only process small files
  for (const r of rows) {
    const album = r['Album'];
    
    // Skip if we already processed this album or if it's not small
    if (processedAlbums.has(album) || !smallFiles.has(album)) {
      continue;
    }
    processedAlbums.add(album);

    if (!r['Album Wikipedia']) {
      console.log(`✗  No Wikipedia link for ${album} (Songs: ${albumToSongIds[album].join(', ')})`);
      continue;
    }

    try {
      const pageId = await getPageId(r['Album Wikipedia']);
      if (!pageId) {
        console.log(`✗  Invalid Wikipedia URL format for ${album} (${r['Album Wikipedia']})`);
        continue;
      }

      const coverURL = await getCoverUrl(pageId, album);
      if (!coverURL) {
        console.log(`✗  No cover found for ${album}`);
        continue;
      }

      console.log(`Downloading image from ${coverURL}`);
      const response = await axios.get(coverURL, { 
        responseType: 'arraybuffer',
        validateStatus: status => status === 200,
        timeout: 10000
      });
      
      if (!response.data || response.data.length < 1000) {
        console.log(`✗  Image too small or empty for ${album} (${response.data?.length || 0} bytes)`);
        continue;
      }

      // Use first song ID as primary ID for the album
      const outPath = path.join(OUTPUT_DIR, safeName(albumToSongIds[album][0], album));
      
      try {
        await sharp(response.data)
          .resize(500, 500, { fit: 'inside', withoutEnlargement: true })
          .png()
          .toFile(outPath);
        
        // Verify the file was created and has content
        const stats = await fs.stat(outPath);
        if (stats.size < 1000) {
          console.log(`✗  Output file too small for ${album} (${stats.size} bytes)`);
          await fs.unlink(outPath);
          continue;
        }
        
        // Verify image dimensions
        const metadata = await sharp(outPath).metadata();
        if (!metadata.width || !metadata.height) {
          console.log(`✗  Invalid image dimensions for ${album}`);
          await fs.unlink(outPath);
          continue;
        }
        
        const ratio = metadata.width / metadata.height;
        if (ratio < 0.7 || ratio > 1.3) {
          console.log(`✗  Image ratio too extreme for ${album} (${ratio})`);
          await fs.unlink(outPath);
          continue;
        }
        
        console.log(`✓  Saved ${outPath} (${stats.size} bytes, ${metadata.width}x${metadata.height}) (Songs: ${albumToSongIds[album].join(', ')})`);
      } catch (err) {
        console.log(`✗  Failed to process image for ${album}: ${err.message}`);
        try {
          await fs.unlink(outPath);
        } catch (e) {
          // Ignore error if file doesn't exist
        }
      }
    } catch (err) {
      console.log(`✗  Failed to process ${album}: ${err.message}`);
    }
  }

  // Write a mapping file so we know which songs share album covers
  const mappingData = Object.entries(albumToSongIds)
    .map(([album, songIds]) => `${songIds.join(',')}\t${album}`)
    .join('\n');
  await fs.writeFile(path.join(OUTPUT_DIR, 'song_id_to_album_mapping.txt'), mappingData);
})();
