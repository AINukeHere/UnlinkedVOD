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

const DEFAULT_PARSE_CONFIG = {
  linePrefix: '🎤',
  parts: {
    songTitle: '(.+?)',
    songArtist: '\\s*\\(([^)]*)\\)',
    time: '(\\d{1,2}:\\d{1,2}(?::\\d{1,2})?)',
  },
  regexSequence: '{songTitle}{songArtist?}\\s*{time}',
};

/**
 * Build regex and group order from a single sequence string.
 * Placeholder {name} = required part; {name?} = optional part (wrapped in (?:...)?, one capture when present).
 * @param {string} sequenceStr - e.g. "{songTitle}{songArtist?}\\s*{time}"
 * @param {Record<string, string>} parts - e.g. { songTitle: "(.+?)", ... }
 * @returns {{ regex: RegExp, groupNames: string[] }}
 */
function buildRegexFromSequence(sequenceStr, parts) {
  const groupNames = [];
  const regexStr = sequenceStr.replace(/\{(\w+)(\?)?\}/g, (_, name, optional) => {
    groupNames.push(name);
    const part = parts[name] != null ? parts[name] : '';
    if (optional) return part ? '(?:' + part + ')?' : '';
    return part;
  });
  return { regex: new RegExp(regexStr), groupNames };
}

/**
 * Load streamer/data/parseConfig.json. Missing → defaults (츄라희 스타일).
 * Config: linePrefix, parts (songTitle, songArtist, time regex strings), regexSequence (string or string[]).
 * @param {string} repoRoot
 * @param {string} streamerId - e.g. 'churahee', 'chebi'
 * @returns {{ linePrefix: string, parts: Record<string, string>, regexSequence: string }}
 */
function loadParseConfig(repoRoot, streamerId) {
  const p = path.join(repoRoot, streamerId, 'data', 'parseConfig.json');
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const c = JSON.parse(raw);
    const linePrefix = typeof c.linePrefix === 'string' ? c.linePrefix : DEFAULT_PARSE_CONFIG.linePrefix;
    const parts =
      c.parts && typeof c.parts === 'object'
        ? { ...DEFAULT_PARSE_CONFIG.parts, ...c.parts }
        : DEFAULT_PARSE_CONFIG.parts;
    const regexSequence =
      typeof c.regexSequence === 'string'
        ? c.regexSequence
        : DEFAULT_PARSE_CONFIG.regexSequence;
    return { linePrefix, parts, regexSequence };
  } catch (_) {
    return { ...DEFAULT_PARSE_CONFIG };
  }
}

/**
 * Load streamer/data/config.json. authorUserId / debug.
 * @param {string} repoRoot
 * @param {string} streamerId - e.g. 'churahee', 'chebi'
 * @returns {{ authorUserId: string, debug: boolean }}
 */
function loadStreamerConfig(repoRoot, streamerId) {
  const p = path.join(repoRoot, streamerId, 'data', 'config.json');
  let authorUserId = process.env.CHURAHEE_AUTHOR_USER_ID || process.env[`${streamerId.toUpperCase()}_AUTHOR_USER_ID`] || '';
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

/** @deprecated Use loadStreamerConfig(repoRoot, 'churahee') */
function loadChuraheeConfig(repoRoot) {
  return loadStreamerConfig(repoRoot, 'churahee');
}

/**
 * Load artist reference (canonical artist + aliases).
 * File: {streamerId}/data/artistReference.json. Missing or invalid → null.
 */
function loadArtistReference(repoRoot, streamerId) {
  const p = path.join(repoRoot, streamerId, 'data', 'artistReference.json');
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : null;
  } catch (_) {
    return null;
  }
}

/**
 * Load song reference (canonical title+artist, titleAliases for title only).
 * File: {streamerId}/data/songReference.json. Missing or invalid → null.
 */
function loadSongReference(repoRoot, streamerId) {
  const p = path.join(repoRoot, streamerId, 'data', 'songReference.json');
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : null;
  } catch (_) {
    return null;
  }
}

/**
 * Resolve artist string to canonical artist using artistReference.
 * @param {Array<{ artist: string, aliases?: string[] }>|null} artistRef
 * @param {string} rawArtist
 * @returns {string} canonical artist or rawArtist unchanged
 */
function resolveArtist(artistRef, rawArtist) {
  const s = (rawArtist || '').trim();
  if (!s || !artistRef || !artistRef.length) return s;
  for (const entry of artistRef) {
    const canonical = (entry.artist || '').trim();
    const aliases = entry.aliases && Array.isArray(entry.aliases) ? entry.aliases : [];
    if (s === canonical || aliases.some((a) => String(a).trim() === s)) return canonical;
  }
  return s;
}

/**
 * Resolve title string to canonical title for a given canonical artist using songReference.
 * @param {Array<{ title: string, artist: string, titleAliases?: string[] }>|null} songRef
 * @param {string} rawTitle
 * @param {string} canonicalArtist
 * @returns {{ title: string, artist: string }|null} canonical title+artist or null if no match
 */
function resolveTitle(songRef, rawTitle, canonicalArtist) {
  const s = (rawTitle || '').trim();
  if (!songRef || !songRef.length) return null;
  for (const entry of songRef) {
    const canonicalTitle = (entry.title || '').trim();
    const entryArtist = (entry.artist || '').trim();
    const titleAliases = Array.isArray(entry.titleAliases)
      ? entry.titleAliases
      : Array.isArray(entry.aliases)
        ? entry.aliases
        : [];
    const titleMatch =
      s === canonicalTitle || titleAliases.some((a) => String(a).trim() === s);
    const artistMatch =
      canonicalArtist === '' || entryArtist === canonicalArtist;
    if (titleMatch && artistMatch) return { title: canonicalTitle, artist: entryArtist };
  }
  return null;
}

/**
 * Resolve parsed (title, artist?) to canonical title+artist using songReference and artistReference.
 * Resolves artist first, then title (by title/titleAliases for that artist). No match → keep as-is.
 * @param {string} repoRoot
 * @param {{ title: string, artist?: string, [k: string]: unknown }} item
 * @param {string} streamerId - e.g. 'churahee', 'chebi'
 * @returns {{ title: string, artist: string, [k: string]: unknown }}
 */
function resolveToCanonical(repoRoot, item, streamerId) {
  const artistRef = loadArtistReference(repoRoot, streamerId);
  const songRef = loadSongReference(repoRoot, streamerId);

  const rawTitle = (item.title || '').trim();
  const rawArtist = (item.artist || '').trim();
  const resolvedArtist = resolveArtist(artistRef, rawArtist);
  const resolvedSong = resolveTitle(songRef, rawTitle, resolvedArtist);

  if (resolvedSong) {
    return { ...item, title: resolvedSong.title, artist: resolvedSong.artist };
  }
  return { ...item, title: rawTitle, artist: resolvedArtist };
}

/**
 * Parse one line into { title, time, artist?, noMistake?, recommended?, needsReview? } or null.
 * Uses parseConfig.parts + regexSequence: build regex from sequence, match line; then detect symbols (●○☆★?) on the line.
 * @param {string} line - line without linePrefix (already stripped)
 * @param {{ parts: Record<string, string>, regexSequence: string }} parseConfig
 * @param {boolean} [debug] - when true, log parsing steps to stderr
 * @returns {object|null}
 */
function parseTimelineLine(line, parseConfig, debug) {
  line = line.replace(/\s+/g, ' ').trim();
  if (debug) console.error('[DEBUG] parseTimelineLine 입력:', JSON.stringify(line));
  if (!line) return null;

  const needsReview = line.includes('?');
  const recommended = /[☆★]/.test(line);
  const noMistake = /[○●]/.test(line);
  if (debug) console.error('[DEBUG]   심볼 → noMistake:', noMistake, 'recommended:', recommended, 'needsReview:', needsReview);

  const cleanLine = line.replace(/[☆★○●□■?]/g, '').trim();
  if (debug) console.error('[DEBUG]   심볼 제거 후:', JSON.stringify(cleanLine));
  if (!cleanLine) return null;

  const parts = parseConfig.parts || DEFAULT_PARSE_CONFIG.parts;
  const seq = parseConfig.regexSequence || DEFAULT_PARSE_CONFIG.regexSequence;
  const { regex, groupNames } = buildRegexFromSequence(seq, parts);
  if (debug) console.error('[DEBUG]   regexSequence:', seq, '→ 정규식:', regex.source);

  const m = cleanLine.match(regex);
  if (!m) {
    if (debug) console.error('[DEBUG]   매칭 실패');
    return null;
  }

  const result = {};
  groupNames.forEach((name, i) => {
    result[name] = (m[i + 1] || '').trim();
  });
  if (debug) console.error('[DEBUG]   캡처:', result);

  const title = decodeHtmlEntities((result.songTitle || '').replace(/\\:/g, ':'));
  const artist = (result.songArtist || '').trim();
  const timeStr = (result.time || '').trim();
  if (!title || !timeStr) {
    if (debug) console.error('[DEBUG]   제목/시간 없음 → 스킵');
    return null;
  }

  const info = { title, time: timeStr };
  if (artist) info.artist = artist;
  if (noMistake) info.noMistake = true;
  if (recommended) info.recommended = true;
  if (needsReview) info.needsReview = true;
  if (debug) console.error('[DEBUG]   결과:', info);
  return info;
}

/**
 * Parse comment HTML into songInfo using streamer-specific parseConfig.
 * A line is recognized if it contains linePrefix (anywhere); then all occurrences of linePrefix are removed and the rest is parsed via regexSequence + parts.
 * @param {string} commentHtml - e.g. "🎤 Square 3:25:43 <br />\\n..."
 * @param {{ linePrefix: string, parts: Record<string, string>, regexSequence: string }} parseConfig
 * @param {boolean} [debug] - when true, log parsing steps to stderr
 * @returns {Array<{ title: string, time: string, artist?: string, ... }>}
 */
function parseCommentHtmlToSongInfo(commentHtml, parseConfig, debug) {
  if (!commentHtml || typeof commentHtml !== 'string') return [];
  const prefix = (parseConfig && parseConfig.linePrefix) || DEFAULT_PARSE_CONFIG.linePrefix;
  const lines = commentHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (debug) console.error('[DEBUG] parseCommentHtmlToSongInfo: linePrefix=', JSON.stringify(prefix), '줄 수=', lines.length);

  const songInfo = [];
  const seen = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes(prefix)) {
      if (debug && line.length < 80) console.error('[DEBUG]   줄', i + 1, '→ linePrefix 없음, 스킵:', JSON.stringify(line.slice(0, 60)));
      continue;
    }
    const lineWithoutPrefix = line.split(prefix).join('').trim();
    if (debug) console.error('[DEBUG]   줄', i + 1, '→ linePrefix 제거 후:', JSON.stringify(lineWithoutPrefix.slice(0, 80)));
    const info = parseTimelineLine(lineWithoutPrefix, parseConfig || DEFAULT_PARSE_CONFIG, debug);
    const dedupeKey = (info && ((info.title || '') + '|' + (info.artist || '') + '|' + (info.time || ''))) || '';
    if (info && !seen.has(dedupeKey)) {
      seen.add(dedupeKey);
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
 * Full pipeline: URL -> fetch VOD + comments -> parse (streamer-specific) -> resolve -> merge.
 * @param {string} vodUrl - https://vod.sooplive.co.kr/player/{videoId}
 * @param {string} repoRoot - path to repo root
 * @param {string} [streamerId='churahee'] - e.g. 'churahee', 'chebi' (data + parseConfig under that folder)
 * @returns {Promise<{ videoId: string, title: string, date: string, songCount: number, replaced: boolean }>}
 */
async function runPipeline(vodUrl, repoRoot, streamerId = 'churahee') {
  const parsed = parseVodUrl(vodUrl);
  if (!parsed) throw new Error('Invalid URL. Use: https://vod.sooplive.co.kr/player/{videoId}');

  const { videoId } = parsed;
  const vodInfo = await getSoopVodInfo(videoId);
  if (!vodInfo) throw new Error(`Failed to fetch VOD info for ${videoId}`);

  const comments = await getSoopComments(videoId, vodInfo);
  const config = loadStreamerConfig(repoRoot, streamerId);
  const parseConfig = loadParseConfig(repoRoot, streamerId);
  const AUTHOR_USER_ID = config.authorUserId;
  const debug = config.debug;

  if (debug) {
    console.error('[DEBUG] streamer:', streamerId);
    console.error('[DEBUG] 댓글 총 개수:', comments.length);
    console.error('[DEBUG] authorUserId:', AUTHOR_USER_ID || '(비어 있음)');
  }

  let songInfo = [];
  for (const c of comments) {
    if (!AUTHOR_USER_ID || (c.user_id || '') !== AUTHOR_USER_ID) continue;
    if (debug) console.error('[DEBUG] --- 작성자 댓글 1건 파싱 시작 ---');
    const parsedList = parseCommentHtmlToSongInfo(c.comment, parseConfig, debug);
    if (debug) console.error('[DEBUG] --- 파싱 완료 → 곡 수:', parsedList.length);
    if (debug && parsedList.length > 0) {
      console.error('[DEBUG] 파싱된 곡:', parsedList.map((p) => `${p.title}${p.artist ? ` (${p.artist})` : ''} ${p.time}`));
    }
    songInfo = songInfo.concat(parsedList);
  }

  songInfo = songInfo.map((item) => resolveToCanonical(repoRoot, item, streamerId));

  if (debug) {
    console.error('[DEBUG] 합친 songInfo 개수:', songInfo.length);
    if (songInfo.length === 0 && comments.length > 0) {
      console.error('[DEBUG] 작성자 댓글이 없거나 linePrefix 형식이 아님. config/parseConfig 확인.');
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

  const sourcePath = path.join(repoRoot, streamerId, 'data', 'source.json');
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
  loadStreamerConfig,
  loadParseConfig,
  loadArtistReference,
  loadSongReference,
  resolveArtist,
  resolveTitle,
  resolveToCanonical,
  parseTimelineLine,
  parseCommentHtmlToSongInfo,
  mergeVodIntoSource,
  runPipeline,
};
