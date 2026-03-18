/**
 * One-time migration: replace vod.afreecatv.com / videoimg.afreecatv.com
 * with Soop equivalents in source.json (videoId preserved).
 */
const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, 'source.json');
const data = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

let changed = 0;
for (const entry of data.history) {
  if (entry.url && entry.url.includes('vod.afreecatv.com')) {
    entry.url = entry.url.replace('https://vod.afreecatv.com', 'https://vod.sooplive.co.kr');
    changed++;
  }
  if (entry.thumbnail && entry.thumbnail.includes('videoimg.afreecatv.com')) {
    entry.thumbnail = entry.thumbnail.replace('https://videoimg.afreecatv.com', 'https://videoimg.sooplive.co.kr');
  }
}

fs.writeFileSync(sourcePath, JSON.stringify(data, null, 4), 'utf8');
console.log(`Migrated ${changed} VOD URL(s) in source.json.`);
