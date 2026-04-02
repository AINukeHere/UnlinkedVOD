#!/usr/bin/env node
/**
 * Add or update a VOD from a Soop URL. Archive = match VOD streamer id (API field `writer_id`) to config/folder.
 * Usage (repo root): npm run add -- "https://vod.sooplive.com/player/{videoId}"
 */
const { spawnSync } = require('child_process');
const path = require('path');
const {
  parseVodUrl,
  getSoopVodInfo,
  runPipeline,
  loadStreamerConfig,
  findArchiveFolderByVodStreamerId,
} = require('./common/soopPipeline');

const songArchivesRoot = path.resolve(__dirname);
const url = process.argv[2];

if (!url) {
  console.error('Usage: npm run add -- "https://vod.sooplive.com/player/{videoId}"');
  process.exit(1);
}

function formatResolveError(res, vodStreamerId) {
  if (res.reason === 'no_vod_streamer_id') {
    return [
      'VOD 메타에 스트리머 id(writer_id)가 없어 어떤 아카이브에 넣을지 판별할 수 없습니다.',
      'Soop API 응답을 확인해 주세요.',
    ].join('\n');
  }
  if (res.reason === 'ambiguous') {
    return [
      `스트리머 id "${vodStreamerId}"에 해당하는 아카이브가 둘 이상입니다: ${res.matches.join(', ')}.`,
      '각 songArchives/{id}/data/config.json의 streamer_id·comment_author_id·폴더명이 겹치지 않게 조정해 주세요.',
    ].join('\n');
  }
  const configured = res.configuredIds && res.configuredIds.length ? res.configuredIds.join(', ') : '(없음)';
  return [
    `이 VOD의 스트리머 id(Soop writer_id)는 "${vodStreamerId}" 입니다.`,
    `songArchives 아래 data/config.json이 있는 폴더: ${configured}`,
    '새 스트리머면 폴더를 만들고 config.json에 comment_author_id(타임라인 댓글 작성자)를 넣고,',
    'VOD 스트리머 id와 폴더명/comment_author_id가 다르면 streamer_id를 VOD와 맞춰 주세요.',
  ].join('\n');
}

async function main() {
  const parsed = parseVodUrl(url);
  if (!parsed) {
    console.error(
      'URL 형식이 올바르지 않습니다. https://vod.sooplive.com/player/{숫자} 또는 .co.kr 도메인을 사용해 주세요.'
    );
    process.exit(1);
  }

  let vodInfo;
  try {
    vodInfo = await getSoopVodInfo(parsed.videoId);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
  if (!vodInfo) {
    console.error(`VOD ${parsed.videoId} 정보를 가져오지 못했습니다.`);
    process.exit(1);
  }

  const vodStreamerId = vodInfo.writer_id;
  const resolved = findArchiveFolderByVodStreamerId(songArchivesRoot, vodStreamerId);
  if (!resolved.streamerId) {
    console.error(formatResolveError(resolved, vodStreamerId));
    process.exit(1);
  }

  const streamerId = resolved.streamerId;

  try {
    const result = await runPipeline(url, songArchivesRoot, streamerId, vodInfo);
    console.log(
      result.replaced ? 'Updated' : 'Added',
      `VOD ${result.videoId}: "${result.title}" (${result.date}), ${result.songCount} song(s).`
    );
    console.log(`Archive: ${streamerId}`);

    const preprocessPath = path.join(songArchivesRoot, 'common', 'preprocess.py');
    const py = spawnSync('python', [preprocessPath, streamerId], {
      cwd: songArchivesRoot,
      stdio: 'inherit',
    });
    if (py.status !== 0) {
      console.error(`Preprocess failed. From repo root: python songArchives/common/preprocess.py ${streamerId}`);
      process.exit(1);
    }
    console.log(`${streamerId}/songs.js updated.`);
  } catch (err) {
    const { debug } = loadStreamerConfig(songArchivesRoot, streamerId);
    if (debug) {
      console.error(err);
    } else {
      console.error(err.message || err);
    }
    process.exit(1);
  }
}

main();
