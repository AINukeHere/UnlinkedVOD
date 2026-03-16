/**
 * Soop API pipeline: fetch VOD info + comments, parse to songInfo, merge into source.json.
 * For use from local addVod.js only. Input URL: vod.sooplive.co.kr/player/{videoId}
 */

const fs = require('fs');
const path = require('path');

const SOOP_VOD_INFO_URL = 'https://api.m.sooplive.co.kr/station/video/a/view';
const SOOP_COMMENT_URL = 'https://stbbs.sooplive.co.kr/api/bbs_memo_action.php';

/**
 * @param {string} url - e.g. "https://vod.sooplive.co.kr/player/189435111"
 * @returns {{ videoId: string } | null}
 */
function parseVodUrl(url) {
  const m = url.match(/vod\.sooplive\.co\.kr\/player\/(\d+)/);
  return m ? { videoId: m[1] } : null;
}

/**
 * @param {string} videoId
 * @returns {Promise<object|null>} - VOD info data or null
 */
async function getSoopVodInfo(videoId) {
  const res = await fetch(SOOP_VOD_INFO_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/x-www-form-urlencoded',
      Referer: `https://vod.sooplive.co.kr/player/${videoId}`,
    },
    body: `nTitleNo=${videoId}&nApiLevel=11&nPlaylistIdx=0`,
  });
  if (res.status !== 200) return null;
  const json = await res.json();
  if (json.result !== 1 || !json.data) return null;
  return json.data;
}

/**
 * @param {string} videoId
 * @param {object} vodInfo - from getSoopVodInfo (station_no, bbs_no, title_no, writer_id)
 * @returns {Promise<Array<{ comment: string }>>} - list_data from all pages
 */
async function getSoopComments(videoId, vodInfo) {
  const { station_no, bbs_no, title_no, writer_id } = vodInfo;
  const list = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const body = new URLSearchParams({
      nStationNo: String(station_no),
      nBbsNo: String(bbs_no),
      nTitleNo: String(title_no),
      bj_id: String(writer_id),
      nPageNo: String(page),
      nOrderNo: '1',
      nBoardType: '105',
      szAction: 'get',
      nVod: '1',
      nLastNo: '0',
    }).toString();

    const res = await fetch(SOOP_COMMENT_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json, text/plain, */*',
        'content-type': 'application/x-www-form-urlencoded',
        Referer: `https://vod.sooplive.co.kr/player/${videoId}`,
      },
      body,
    });
    if (res.status !== 200) break;
    const json = await res.json();
    const channel = json.CHANNEL;
    if (!channel || channel.RESULT !== 1 || !channel.DATA) break;
    const data = channel.DATA;
    if (data.list_data && data.list_data.length) list.push(...data.list_data);
    hasMore = data.has_more === true;
    page++;
  }
  return list;
}

/** Time regex: H:M:S or H:MM:SS or MM:SS 등 (분·초 한 자리 허용) */
const TIME_REGEX = /(\d{1,2}:\d{1,2}(?::\d{1,2})?)/;

/** Decode common HTML entities in text (e.g. API returns "You &amp; I"). */
function decodeHtmlEntities(s) {
  if (!s || typeof s !== 'string') return s;
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/**
 * Load churahee/data/config.json. authorUserId / debug는 config 우선, 없으면 환경변수.
 * @param {string} repoRoot
 * @returns {{ authorUserId: string, debug: boolean }}
 */
function loadChuraheeConfig(repoRoot) {
  const p = path.join(repoRoot, 'churahee', 'data', 'config.json');
  let authorUserId = process.env.CHURAHEE_AUTHOR_USER_ID || '';
  let debug = !!(process.env.CHURAHEE_DEBUG || process.env.DEBUG);
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const config = JSON.parse(raw);
    if (config.authorUserId != null && String(config.authorUserId).trim() !== '') {
      authorUserId = String(config.authorUserId).trim();
    }
    if (config.debug != null) debug = !!config.debug;
  } catch (_) {}
  return { authorUserId, debug };
}

/**
 * Parse one line into { title, time, noMistake?, recommended?, needsReview? } or null.
 * Line may be "제목 3:25:43" or "3:25:43 제목" with optional ☆★●○. "?" present → needsReview.
 */
function parseTimelineLine(line) {
  line = line.replace(/\s+/g, ' ').trim();
  if (!line) return null;

  const needsReview = line.includes('?');
  let recommended = /[☆★]/.test(line);
  let noMistake = /[○●]/.test(line);
  line = line.replace(/[☆★○●□■?]/g, '').trim();

  const m = line.match(TIME_REGEX);
  if (!m) return null;
  const timeStr = m[1];
  const idx = line.indexOf(timeStr);
  let title;
  if (idx === 0) {
    title = line.slice(timeStr.length).replace(/^[\s:]+|[\s:]+$/g, '').trim();
  } else {
    title = line.slice(0, idx).replace(/[\s:]+$/g, '').trim();
  }
  if (!title) return null;
  title = title.replace(/\\:/g, ':');
  title = decodeHtmlEntities(title);

  const info = { title, time: timeStr };
  if (noMistake) info.noMistake = true;
  if (recommended) info.recommended = true;
  if (needsReview) info.needsReview = true;
  return info;
}

const TIMELINE_LINE_PREFIX = '🎤';

/**
 * @param {string} commentHtml - e.g. "🎤 Square 3:25:43 <br />\\n🎤 무릎 3:31:59<br />\\n..."
 * @returns {Array<{ title: string, time: string, noMistake?: boolean, recommended?: boolean, needsReview?: boolean }>}
 */
function parseCommentHtmlToSongInfo(commentHtml) {
  if (!commentHtml || typeof commentHtml !== 'string') return [];
  const lines = commentHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const songInfo = [];
  const seen = new Set();

  for (const line of lines) {
    if (!line.startsWith(TIMELINE_LINE_PREFIX)) continue;
    const lineWithoutPrefix = line.slice(TIMELINE_LINE_PREFIX.length).trim();
    const info = parseTimelineLine(lineWithoutPrefix);
    if (info && !seen.has(info.title + '|' + info.time)) {
      seen.add(info.title + '|' + info.time);
      songInfo.push(info);
    }
  }
  return songInfo;
}

/**
 * Extract YYYY-MM-DD from broad_start or write_tm.
 * @param {object} vodInfo
 * @returns {string}
 */
function getBroadcastDate(vodInfo) {
  const s = vodInfo.broad_start || vodInfo.write_tm || '';
  const match = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) return match[0];
  if (typeof s === 'number') {
    const d = new Date(s * 1000);
    return d.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * Merge one VOD into source.json: replace by videoId or append.
 * @param {object} historyEntry - { title, date, url, thumbnail, songInfo }
 * @param {string} sourcePath - absolute path to source.json
 * @returns {{ replaced: boolean, index: number }}
 */
function mergeVodIntoSource(historyEntry, sourcePath) {
  const videoId = historyEntry.url.match(/\/player\/(\d+)/)?.[1];
  if (!videoId) throw new Error('Invalid history entry: no videoId in url');

  const raw = fs.readFileSync(sourcePath, 'utf8');
  const data = JSON.parse(raw);

  const idx = data.history.findIndex((e) => {
    const id = (e.url || '').match(/\/player\/(\d+)/)?.[1];
    return id === videoId;
  });

  if (idx >= 0) {
    data.history[idx] = historyEntry;
    fs.writeFileSync(sourcePath, JSON.stringify(data, null, 4), 'utf8');
    return { replaced: true, index: idx };
  }
  data.history.push(historyEntry);
  fs.writeFileSync(sourcePath, JSON.stringify(data, null, 4), 'utf8');
  return { replaced: false, index: data.history.length - 1 };
}

/**
 * Full pipeline: URL -> fetch VOD + comments -> parse -> merge -> return entry summary.
 * @param {string} vodUrl - https://vod.sooplive.co.kr/player/{videoId}
 * @param {string} repoRoot - path to repo root (for source.json and preprocess)
 * @returns {Promise<{ videoId: string, title: string, date: string, songCount: number, replaced: boolean }>}
 */
async function runPipeline(vodUrl, repoRoot) {
  const parsed = parseVodUrl(vodUrl);
  if (!parsed) throw new Error('Invalid URL. Use: https://vod.sooplive.co.kr/player/{videoId}');

  const { videoId } = parsed;
  const vodInfo = await getSoopVodInfo(videoId);
  if (!vodInfo) throw new Error(`Failed to fetch VOD info for ${videoId}`);

  const comments = await getSoopComments(videoId, vodInfo);
  const config = loadChuraheeConfig(repoRoot);
  const AUTHOR_USER_ID = config.authorUserId;
  const debug = config.debug;

  if (debug) {
    console.error('[DEBUG] 댓글 총 개수:', comments.length);
    console.error('[DEBUG] authorUserId (config 또는 환경변수):', AUTHOR_USER_ID || '(비어 있음)');
  }

  let songInfo = [];
  for (const c of comments) {
    if (!AUTHOR_USER_ID || (c.user_id || '') !== AUTHOR_USER_ID) continue;
    const parsed = parseCommentHtmlToSongInfo(c.comment);
    if (debug && parsed.length > 0) {
      console.error('[DEBUG] 작성자 댓글 한 건 → 파싱된 곡:', parsed.length, parsed.map((p) => `${p.title}${p.artist ? ` (${p.artist})` : ''} ${p.time}`));
    }
    songInfo = songInfo.concat(parsed);
  }

  if (debug) {
    console.error('[DEBUG] 합친 songInfo 개수:', songInfo.length);
    if (songInfo.length === 0 && comments.length > 0) {
      console.error('[DEBUG] 작성자 댓글이 없거나 🎤 형식이 아님. user_id 확인 또는 댓글 앞에 🎤 있는지 확인.');
    }
  }

  const date = getBroadcastDate(vodInfo);
  const title = vodInfo.full_title || vodInfo.title || '';
  const thumb = vodInfo.thumb || '';
  const url = `https://vod.sooplive.co.kr/player/${videoId}`;

  const historyEntry = {
    title,
    date,
    url,
    thumbnail: thumb,
    songInfo,
  };

  const sourcePath = path.join(repoRoot, 'churahee', 'data', 'source.json');
  const { replaced } = mergeVodIntoSource(historyEntry, sourcePath);

  return {
    videoId,
    title,
    date,
    songCount: songInfo.length,
    replaced,
  };
}

module.exports = {
  parseVodUrl,
  getSoopVodInfo,
  getSoopComments,
  loadChuraheeConfig,
  parseCommentHtmlToSongInfo,
  mergeVodIntoSource,
  runPipeline,
};
