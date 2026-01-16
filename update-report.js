/**
 * Poudre River Fly Report Scraper
 * 
 * This script fetches the fishing report from St. Peter's Fly Shop,
 * extracts fly recommendations, and fetches product images.
 * 
 * Run with: node update-report.js
 */

const https = require('https');
const fs = require('fs');

// Fly patterns to look for in the report text
// These are common patterns mentioned in Poudre reports
const KNOWN_FLY_PATTERNS = [
  'UV Emerger',
  'Bling Midge',
  "Charlie Craven's Mole Fly",
  'Mole Fly',
  'Shucking Midge',
  'RS2',
  'Foam Wing RS2',
  'Grey Foam Wing RS2',
  'BWO',
  'Blue Wing Olive',
  'Extended Body BWO',
  'Parachute Adams',
  'Griffith\'s Gnat',
  'Zebra Midge',
  'Top Secret Midge',
  'Mercury Midge',
  'Juju Baetis',
  'Pheasant Tail',
  'Copper John',
  'Two Bit Hooker',
  'Poison Tung',
  'San Juan Worm',
  'Pat\'s Rubber Legs',
  'Sparkle Dun',
  'Comparadun',
  'Hi-Vis Midge',
  'Eric\'s Hi-Vis Midge',
  'Medallion Midge',
  'WD-40',
  'Barr Emerger',
  'Stalcup Baetis',
  'Rojo Midge',
  'Black Beauty',
  'Rainbow Warrior',
  'Hopper',
  'Stimulator',
  'Elk Hair Caddis',
  'Woolly Bugger',
  'Slumpbuster',
  'Circus Peanut'
];

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PoudreFliesBot/1.0)'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

function extractTextContent(html) {
  // Remove script and style tags
  html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  // Convert br and p to newlines
  html = html.replace(/<br\s*\/?>/gi, '\n');
  html = html.replace(/<\/p>/gi, '\n');
  // Remove all other HTML tags
  html = html.replace(/<[^>]+>/g, ' ');
  // Decode HTML entities
  html = html.replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  // Clean up whitespace
  html = html.replace(/\s+/g, ' ').trim();
  return html;
}

function extractReportSection(html) {
  // Find the "Latest Update" section
  // Looking for content after "Latest Update:" and before the fly recommendations section
  
  // Extract the main content area
  const mainMatch = html.match(/Latest Update:[\s\S]*?(?=Poudre River Recommended Flies|Poudre River Dry Flies|<footer)/i);
  
  if (!mainMatch) {
    console.log('Could not find Latest Update section');
    return { reportText: '', flowInfo: '', mentionedFlies: [] };
  }
  
  let content = mainMatch[0];
  
  // Extract flow info
  let flowInfo = '';
  const flowMatch = content.match(/Current Streamflow[^<]*/i);
  if (flowMatch) {
    flowInfo = extractTextContent(flowMatch[0]);
  }
  
  // Get the text content
  let reportText = extractTextContent(content);
  
  // Clean up - remove the "Latest Update" header and date
  reportText = reportText.replace(/Latest Update:\s*\d+\/\d+\/\d+/i, '').trim();
  reportText = reportText.replace(/Current Streamflow.*?cfs/gi, '').trim();
  
  // Find mentioned flies
  const mentionedFlies = [];
  const lowerReport = reportText.toLowerCase();
  
  for (const pattern of KNOWN_FLY_PATTERNS) {
    if (lowerReport.includes(pattern.toLowerCase())) {
      mentionedFlies.push(pattern);
    }
  }
  
  // Also look for size patterns like "Sz 20-24 Midge"
  const sizePatterns = reportText.match(/Sz\.?\s*\d+[-–]\d+\s+\w+/gi) || [];
  for (const sp of sizePatterns) {
    if (!mentionedFlies.some(f => sp.toLowerCase().includes(f.toLowerCase()))) {
      mentionedFlies.push(sp.trim());
    }
  }
  
  return { reportText, flowInfo, mentionedFlies };
}

function extractProductsFromCollection(html) {
  const products = [];
  
  // Shopify product grid items typically have product info in data attributes or structured HTML
  // Look for product cards
  const productBlocks = html.match(/<div[^>]*class="[^"]*product-card[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi) || [];
  
  // Also try to find product JSON if available
  const jsonMatch = html.match(/var\s+products\s*=\s*(\[[\s\S]*?\]);/);
  if (jsonMatch) {
    try {
      const productsJson = JSON.parse(jsonMatch[1]);
      for (const p of productsJson) {
        products.push({
          name: p.title,
          image: p.featured_image || p.images?.[0],
          size: extractSize(p.title),
          price: p.price
        });
      }
      return products;
    } catch (e) {
      // Continue with HTML parsing
    }
  }
  
  // Parse product cards from HTML
  // Look for image and title patterns
  const cardMatches = html.matchAll(/<a[^>]*href="\/products\/([^"]+)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)/gi);
  
  for (const match of cardMatches) {
    const slug = match[1];
    let image = match[2];
    const name = match[3].trim();
    
    // Fix image URL if needed
    if (image.startsWith('//')) {
      image = 'https:' + image;
    }
    
    // Get a reasonable size image
    image = image.replace(/\?v=\d+/, '').replace(/&width=\d+/, '') + '?width=400';
    
    products.push({
      name,
      image,
      size: extractSize(name)
    });
  }
  
  return products;
}

function extractSize(name) {
  const sizeMatch = name.match(/#(\d+)/);
  return sizeMatch ? sizeMatch[1] : null;
}

async function fetchCollection(url) {
  try {
    // Shopify collections have a .json endpoint
    const jsonUrl = url.replace(/\/?$/, '.json');
    const response = await fetch(jsonUrl);
    
    if (response.status === 200) {
      const data = JSON.parse(response.data);
      if (data.products) {
        return data.products.map(p => ({
          name: p.title,
          image: p.images?.[0]?.src || p.featured_image,
          size: extractSize(p.title),
          handle: p.handle
        }));
      }
    }
  } catch (e) {
    console.log(`Could not fetch collection JSON: ${e.message}`);
  }
  
  // Fallback to HTML parsing
  try {
    const response = await fetch(url);
    if (response.status === 200) {
      return extractProductsFromCollection(response.data);
    }
  } catch (e) {
    console.log(`Could not fetch collection: ${e.message}`);
  }
  
  return [];
}

async function main() {
  console.log('Fetching Poudre River fishing report...');
  
  const reportUrl = 'https://stpetes.com/pages/poudre-river-fishing-report-fort-collins-fly-fishing';
  
  try {
    // Fetch main report page
    const reportResponse = await fetch(reportUrl);
    if (reportResponse.status !== 200) {
      throw new Error(`Failed to fetch report: ${reportResponse.status}`);
    }
    
    const { reportText, flowInfo, mentionedFlies } = extractReportSection(reportResponse.data);
    console.log(`Found ${mentionedFlies.length} mentioned flies in report`);
    
    // Fetch fly collections
    console.log('Fetching fly collections...');
    
    const [dryFlies, nymphs, streamers] = await Promise.all([
      fetchCollection('https://stpetes.com/collections/poudre-river-report-dry-flies'),
      fetchCollection('https://stpetes.com/collections/poudre-river-report-nymphs'),
      fetchCollection('https://stpetes.com/collections/poudre-river-report-streamers')
    ]);
    
    console.log(`Found: ${dryFlies.length} dry flies, ${nymphs.length} nymphs, ${streamers.length} streamers`);
    
    // Build the data object
    const data = {
      lastUpdated: new Date().toISOString(),
      sourceUrl: reportUrl,
      flowInfo,
      reportText,
      mentionedFlies,
      dryFlies: dryFlies.slice(0, 8), // Limit to 8 per category for clean display
      nymphs: nymphs.slice(0, 8),
      streamers: streamers.slice(0, 8)
    };
    
    // Write to data.json
    fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
    console.log('Successfully wrote data.json');
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
