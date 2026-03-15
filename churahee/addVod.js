#!/usr/bin/env node
/**
 * Add or update a VOD from a Soop URL. Run from repo root.
 * Usage: node churahee/addVod.js "https://vod.sooplive.co.kr/player/189435111"
 */
const { runPipeline } = require('./soopPipeline');
const { spawnSync } = require('child_process');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const url = process.argv[2];

if (!url) {
  console.error('Usage: node churahee/addVod.js "https://vod.sooplive.co.kr/player/{videoId}"');
  process.exit(1);
}

async function main() {
  try {
    const result = await runPipeline(url, repoRoot);
    console.log(
      result.replaced ? 'Updated' : 'Added',
      `VOD ${result.videoId}: "${result.title}" (${result.date}), ${result.songCount} song(s).`
    );

    const preprocessPath = path.join(__dirname, 'data', 'preprocess.py');
    const py = spawnSync('python', [preprocessPath], {
      cwd: repoRoot,
      stdio: 'inherit',
    });
    if (py.status !== 0) {
      console.error('Preprocess (songs.js) failed. Run manually: python churahee/data/preprocess.py');
      process.exit(1);
    }
    console.log('songs.js updated.');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

main();
