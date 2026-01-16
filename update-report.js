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

// Known flies with their St. Pete's product slugs
const FLY_PRODUCT_SLUGS = {
  'UV Emerger': 'uv-midge',
  'Bling Midge': 'bling-midge',
  'Zebra Midge': 'zebra-midge',
  'Mole Fly': 'mole-fly',
  "Charlie Craven's Mole Fly": 'mole-fly',
  'Shucking Midge': 'shucking-midge',
  'RS2': 'rs2',
  'Foam Wing RS2': 'foam-wing-rs2',
  'Grey Foam Wing RS2': 'foam-wing-rs2',
  'BWO': 'blue-wing-olive',
  'Blue Wing Olive': 'blue-wing-olive',
  'Extended Body BWO': 'extended-body-bwo',
  'Parachute Adams': 'parachute-adams',
  "Griffith's Gnat": 'griffiths-gnat',
  'Top Secret Midge': 'top-secret-midge',
  'Mercury Midge': 'mercury-midge',
  'Juju Baetis': 'juju-baetis',
  'Pheasant Tail': 'pheasant-tail',
  'Copper John': 'copper-john',
  'Two Bit Hooker': 'two-bit-hooker',
  'Poison Tung': 'poison-tung',
  'San Juan Worm': 'san-juan-worm',
  "Pat's Rubber Legs": 'pats-rubber-legs',
  'Sparkle Dun': 'sparkle-dun',
  'Comparadun': 'comparadun',
  'Hi-Vis Midge': 'hi-vis-midge',
  "Eric's Hi-Vis Midge": 'hi-vis-midge',
  'WD-40': 'wd-40',
  'Barr Emerger': 'barr-emerger',
  'Rojo Midge': 'rojo-midge',
  'Black Beauty': 'black-beauty',
  'Rainbow Warrior': 'rainbow-warrior',
  'Hopper': 'hopper',
  'Stimulator': 'stimulator',
  'Elk Hair Caddis': 'elk-hair-caddis',
  'Woolly Bugger': 'woolly-bugger',
  'Slumpbuster': 'slumpbuster'
};

// Categorize flies
const DRY_FLIES = ['BWO', 'Blue Wing Olive', 'Extended Body BWO', 'Parachute Adams', "Griffith's Gnat", 
                   'Sparkle Dun', 'Comparadun', 'Hi-Vis Midge', "Eric's Hi-Vis Midge", 'Hopper', 
                   'Stimulator', 'Elk Hair Caddis'];
const STREAMERS = ['Woolly Bugger', 'Slumpbuster'];

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) {
          const urlObj = new URL(url);
          redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`;
        }
        return fetch(redirectUrl).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

function extractImageFromProductPage(html) {
  // Look for product images in various formats
  const patterns = [
    /src="(\/\/stpetes\.com\/cdn\/shop\/files\/[^"?]+)/g,
    /src="(https:\/\/stpetes\.com\/cdn\/shop\/files\/[^"?]+)/g,
    /"src":"(\/\/stpetes\.com\/cdn\/shop\/files\/[^"?]+)/g
  ];
  
  for (const pattern of patterns) {
    const matches = [...html.matchAll(pattern)];
    for (const match of matches) {
      let url = match[1];
      url = url.replace(/\\\//g, '/');
      if (url.startsWith('//')) url = 'https:' + url;
      // Skip logos and unrelated images
      if (url.includes('logo') || url.includes('Gift_Card') || url.includes('Petes_logo')) continue;
      return url + '?width=400';
    }
  }
  return null;
}

async function fetchFlyImage(flyName) {
  const slug = FLY_PRODUCT_SLUGS[flyName];
  if (!slug) {
    console.log(`  No product slug for: ${flyName}`);
    return null;
  }
  
  const url = `https://stpetes.com/products/${slug}`;
  try {
    console.log(`  Fetching ${slug}...`);
    const response = await fetch(url);
    if (response.status === 200) {
      const image = extractImageFromProductPage(response.data);
      if (image) {
        console.log(`    Found: ${image.substring(0, 50)}...`);
        return image;
      }
    }
    console.log(`    No image found`);
  } catch (err) {
    console.log(`    Error: ${err.message}`);
  }
  return null;
}

function extractReportFromHtml(html) {
  let reportText = '';
  let flowInfo = '';
  
  // Extract flow info
  const flowMatch = html.match(/Current Streamflow\s*:?\s*([^<]*(?:<[^>]*>[^<]*)*?)(?=Freezing|Cold|Warm|Yay|The river|Flows have|Still plenty)/is);
  if (flowMatch) {
    flowInfo = flowMatch[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  
  // Extract main report text
  const reportMatch = html.match(/Latest Update:\s*\*?\*?\s*(\d+\/\d+\/\d+)\s*\*?\*?\s*([\s\S]*?)(?=Poudre River Recommended Flies|Poudre River Dry Flies|These are our current favorites)/i);
  
  if (reportMatch) {
    reportText = reportMatch[2]
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  return { reportText, flowInfo };
}

function findMentionedFlies(text) {
  const found = [];
  const lowerText = text.toLowerCase();
  
  for (const flyName of Object.keys(FLY_PRODUCT_SLUGS)) {
    if (lowerText.includes(flyName.toLowerCase())) {
      found.push(flyName);
    }
  }
  
  // Size patterns
  const sizePatterns = text.match(/Sz\.?\s*\d+[-–]\d+\s+\w+/gi) || [];
  for (const sp of sizePatterns) {
    if (!found.includes(sp.trim())) found.push(sp.trim());
  }
  
  return found;
}

function categorizeFly(flyName) {
  if (DRY_FLIES.some(d => flyName.toLowerCase().includes(d.toLowerCase()))) return 'dry';
  if (STREAMERS.some(s => flyName.toLowerCase().includes(s.toLowerCase()))) return 'streamer';
  return 'nymph';
}

async function main() {
  console.log('=== Poudre River Fly Report Scraper ===\n');
  
  const reportUrl = 'https://stpetes.com/pages/poudre-river-fishing-report-fort-collins-fly-fishing';
  
  try {
    console.log('Fetching report page...');
    const reportResponse = await fetch(reportUrl);
    if (reportResponse.status !== 200) throw new Error(`Failed: ${reportResponse.status}`);
    
    const { reportText, flowInfo } = extractReportFromHtml(reportResponse.data);
    console.log(`Flow: ${flowInfo.substring(0, 60)}...`);
    console.log(`Report: ${reportText.substring(0, 80)}...\n`);
    
    const mentionedFlies = findMentionedFlies(reportText);
    console.log(`Found ${mentionedFlies.length} flies: ${mentionedFlies.join(', ')}\n`);
    
    // Fetch images
    console.log('Fetching fly images...');
    const flyData = [];
    
    for (const flyName of mentionedFlies) {
      if (flyName.startsWith('Sz')) continue;
      const image = await fetchFlyImage(flyName);
      flyData.push({ name: flyName, image, category: categorizeFly(flyName) });
      await new Promise(r => setTimeout(r, 200));
    }
    
    // Add common winter flies
    const commonFlies = ['Zebra Midge', 'Parachute Adams', 'Juju Baetis', 'Two Bit Hooker', 'RS2'];
    for (const flyName of commonFlies) {
      if (!flyData.some(f => f.name === flyName)) {
        const image = await fetchFlyImage(flyName);
        flyData.push({ name: flyName, image, category: categorizeFly(flyName) });
        await new Promise(r => setTimeout(r, 200));
      }
    }
    
    const dryFlies = flyData.filter(f => f.category === 'dry' && f.image);
    const nymphs = flyData.filter(f => f.category === 'nymph' && f.image);
    const streamers = flyData.filter(f => f.category === 'streamer' && f.image);
    
    console.log(`\nResults: ${dryFlies.length} dry, ${nymphs.length} nymphs, ${streamers.length} streamers`);
    
    const data = {
      lastUpdated: new Date().toISOString(),
      sourceUrl: reportUrl,
      flowInfo,
      reportText,
      mentionedFlies,
      dryFlies: dryFlies.map(f => ({ name: f.name, image: f.image })),
      nymphs: nymphs.map(f => ({ name: f.name, image: f.image })),
      streamers: streamers.map(f => ({ name: f.name, image: f.image }))
    };
    
    fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
    console.log('\n✓ Wrote data.json');
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
