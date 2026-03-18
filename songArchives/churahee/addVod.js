#!/usr/bin/env node
/**
 * Add or update a VOD from a Soop URL. Run from repo root.
 * Usage: node songArchives/churahee/addVod.js "https://vod.sooplive.co.kr/player/189435111"
 */
const { runPipeline, loadStreamerConfig } = require('../common/soopPipeline');
const { spawnSync } = require('child_process');
const path = require('path');

const archiveRoot = path.resolve(__dirname, '..');
const streamerId = 'churahee';
const url = process.argv[2];

if (!url) {
  console.error('Usage: node songArchives/churahee/addVod.js "https://vod.sooplive.co.kr/player/{videoId}"');
  process.exit(1);
}

async function main() {
  try {
    const result = await runPipeline(url, archiveRoot, streamerId);
    console.log(
      result.replaced ? 'Updated' : 'Added',
      `VOD ${result.videoId}: "${result.title}" (${result.date}), ${result.songCount} song(s).`
    );

    const preprocessPath = path.join(archiveRoot, 'common', 'preprocess.py');
    const py = spawnSync('python', [preprocessPath, streamerId], {
      cwd: archiveRoot,
      stdio: 'inherit',
    });
    if (py.status !== 0) {
      console.error('Preprocess failed. Run from songArchives: python common/preprocess.py churahee');
      process.exit(1);
    }
    console.log('songs.js updated.');
  } catch (err) {
    const { debug } = loadStreamerConfig(archiveRoot, streamerId);
    if (debug) {
      console.error(err);
    } else {
      console.error(err.message);
    }
    process.exit(1);
  }
}

main();
