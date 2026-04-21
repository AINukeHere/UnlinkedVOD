/**
 * Soop API pipeline: fetch VOD info + comments, parse to songInfo, merge into source.json.
 * For use from local addVod.js only. Input URL: vod.sooplive(.co.kr|.com)/player/{videoId}
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline/promises');

const SOOP_VOD_INFO_URL = 'https://api.m.sooplive.com/station/video/a/view';
const SOOP_COMMENT_URL = 'https://stbbs.sooplive.com/api/bbs_memo_action.php';

/**
 * @param {string} url - e.g. "https://vod.sooplive.com/player/189435111" or .co.kr, optional ?query #hash
 * @returns {{ videoId: string } | null}
 */
function parseVodUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const base = url.trim().split(/[#]/)[0].split('?')[0].replace(/\/+$/, '');
  const m =
    base.match(/vod\.sooplive\.co\.kr\/player\/(\d+)/i) ||
    base.match(/vod\.sooplive\.com\/player\/(\d+)/i);
  return m ? { videoId: m[1] } : null;
}

function normalizeSoopUserId(id) {
  return String(id == null ? '' : id).trim().toLowerCase();
}

/**
 * List `songArchives/{id}` dirs that have `data/config.json` (excludes `common`).
 * @param {string} songArchivesRoot
 * @returns {string[]}
 */
function listConfiguredStreamerIds(songArchivesRoot) {
  const ids = [];
  let entries;
  try {
    entries = fs.readdirSync(songArchivesRoot, { withFileTypes: true });
  } catch {
    return ids;
  }
  for (const e of entries) {
    if (!e.isDirectory() || e.name === 'common') continue;
    const cfgPath = path.join(songArchivesRoot, e.name, 'data', 'config.json');
    if (fs.existsSync(cfgPath)) ids.push(e.name);
  }
  return ids;
}

/**
 * Soop VOD 메타에는 아직 `writer_id` 필드명으로 오는 스트리머(BJ) 식별자가 들어 있음 → 여기서는 vod_streamer_id 등으로 취급.
 * 아카이브 매칭 후보: config `streamer_id`(선택), 레거시 `soopWriterId`, `comment_author_id`, 레거시 `authorUserId`, 폴더 이름.
 * @param {Record<string, unknown>} cfg
 * @param {string} folderName - songArchives 직하위 폴더명
 * @returns {Set<string>} normalized ids
 */
function collectArchiveStreamerMatchKeys(cfg, folderName) {
  const keys = new Set();
  const add = (v) => {
    const n = normalizeSoopUserId(v);
    if (n) keys.add(n);
  };
  if (cfg.streamer_id != null && String(cfg.streamer_id).trim() !== '') {
    add(cfg.streamer_id);
  }
  if (cfg.soopWriterId != null && String(cfg.soopWriterId).trim() !== '') {
    add(cfg.soopWriterId);
  }
  if (cfg.comment_author_id != null && String(cfg.comment_author_id).trim() !== '') {
    add(cfg.comment_author_id);
  }
  if (cfg.authorUserId != null && String(cfg.authorUserId).trim() !== '') {
    add(cfg.authorUserId);
  }
  add(folderName);
  return keys;
}

/**
 * Soop VOD 응답의 스트리머 id(`writer_id` 필드 값)로 `songArchives/{archiveId}` 결정.
 * @param {string} songArchivesRoot - path to `songArchives`
 * @param {string|number} vodStreamerId - getSoopVodInfo().writer_id (API 필드명 유지)
 * @returns {{ streamerId: string } | { streamerId: null, reason: 'none'|'ambiguous'|'no_vod_streamer_id', matches: string[], configuredIds: string[] }}
 */
function findArchiveFolderByVodStreamerId(songArchivesRoot, vodStreamerId) {
  const w = normalizeSoopUserId(vodStreamerId);
  const configuredIds = listConfiguredStreamerIds(songArchivesRoot);
  if (!w) {
    return {
      streamerId: null,
      reason: 'no_vod_streamer_id',
      matches: [],
      configuredIds,
    };
  }
  const matches = [];
  for (const id of configuredIds) {
    const p = path.join(songArchivesRoot, id, 'data', 'config.json');
    let cfg;
    try {
      cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
      continue;
    }
    const keys = collectArchiveStreamerMatchKeys(cfg, id);
    if (keys.has(w)) matches.push(id);
  }
  if (matches.length === 1) return { streamerId: matches[0] };
  if (matches.length === 0) {
    return { streamerId: null, reason: 'none', matches: [], configuredIds };
  }
  return { streamerId: null, reason: 'ambiguous', matches, configuredIds };
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
      Referer: `https://vod.sooplive.com/player/${videoId}`,
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
 * @param {object} vodInfo - from getSoopVodInfo (station_no, bbs_no, title_no, writer_id = API의 스트리머/BJ id)
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
        Referer: `https://vod.sooplive.com/player/${videoId}`,
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
 * Load streamer/data/config.json. comment_author_id(댓글 작성자) / debug.
 * 파일 키: `comment_author_id` 우선, 없으면 레거시 `authorUserId`.
 * 환경 변수: `CHURAHEE_COMMENT_AUTHOR_ID` 또는 `CHURAHEE_AUTHOR_USER_ID`(및 `{STREAMER}_*`).
 * @param {string} repoRoot
 * @param {string} streamerId - e.g. 'churahee', 'chebi2'
 * @returns {{ commentAuthorId: string, debug: boolean }}
 */
function loadStreamerConfig(repoRoot, streamerId) {
  const p = path.join(repoRoot, streamerId, 'data', 'config.json');
  const su = streamerId.toUpperCase();
  let commentAuthorId =
    process.env.CHURAHEE_COMMENT_AUTHOR_ID ||
    process.env[`${su}_COMMENT_AUTHOR_ID`] ||
    process.env.CHURAHEE_AUTHOR_USER_ID ||
    process.env[`${su}_AUTHOR_USER_ID`] ||
    '';
  let debug = !!(process.env.CHURAHEE_DEBUG || process.env.DEBUG);
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const config = JSON.parse(raw);
    if (config.comment_author_id != null && String(config.comment_author_id).trim() !== '') {
      commentAuthorId = String(config.comment_author_id).trim();
    } else if (config.authorUserId != null && String(config.authorUserId).trim() !== '') {
      commentAuthorId = String(config.authorUserId).trim();
    }
    if (config.debug != null) debug = !!config.debug;
  } catch (_) {}
  return { commentAuthorId, debug };
}

/** @deprecated Use loadStreamerConfig(repoRoot, 'churahee') */
function loadChuraheeConfig(repoRoot) {
  return loadStreamerConfig(repoRoot, 'churahee');
}

/** Global title/artist refs: songArchives/common/data (all streamers). */
function globalRefDataDir(repoRoot) {
  return path.join(repoRoot, 'common', 'data');
}

/**
 * Load artist reference (canonical artist + aliases).
 * File: common/data/artistReference.json
 */
function loadArtistReference(repoRoot) {
  const p = path.join(globalRefDataDir(repoRoot), 'artistReference.json');
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : null;
  } catch (_) {
    return null;
  }
}

/**
 * Load title reference (canonical title + aliases).
 * File: common/data/titleReference.json
 */
function loadTitleReference(repoRoot) {
  const p = path.join(globalRefDataDir(repoRoot), 'titleReference.json');
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : null;
  } catch (_) {
    return null;
  }
}

/**
 * Per-streamer default artist per song title (제목 문자열 키만).
 * File: {streamerId}/data/defaultArtistMapping.json
 */
function loadDefaultArtistMapping(repoRoot, streamerId) {
  const p = path.join(repoRoot, streamerId, 'data', 'defaultArtistMapping.json');
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const o = JSON.parse(raw);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch (_) {
    return {};
  }
}

/**
 * @param {Array<{ title: string, aliases?: string[], titleAliases?: string[] }>|null} titleRef
 * @returns {string|null} canonical title or null
 */
function resolveTitleCanonical(titleRef, rawTitle) {
  const s = (rawTitle || '').trim();
  if (!s || !titleRef || !titleRef.length) return null;
  for (const entry of titleRef) {
    const canonical = (entry.title || '').trim();
    const aliases = Array.isArray(entry.aliases)
      ? entry.aliases
      : Array.isArray(entry.titleAliases)
        ? entry.titleAliases
        : [];
    if (s === canonical || aliases.some((a) => String(a).trim() === s)) return canonical;
  }
  return null;
}

/**
 * @param {Array<{ artist: string, aliases?: string[] }>|null} artistRef
 * @returns {string|null} canonical artist or null
 */
function resolveArtistCanonical(artistRef, rawArtist) {
  const s = (rawArtist || '').trim();
  if (!s || !artistRef || !artistRef.length) return null;
  for (const entry of artistRef) {
    const canonical = (entry.artist || '').trim();
    const aliases = entry.aliases && Array.isArray(entry.aliases) ? entry.aliases : [];
    if (s === canonical || aliases.some((a) => String(a).trim() === s)) return canonical;
  }
  return null;
}

/** defaultArtistMapping 에서 해당 제목 키의 가수만 조회. */
function defaultArtistForCanonicalTitle(mapping, canonicalTitle) {
  if (!mapping || typeof mapping !== 'object') return '';
  const t = (canonicalTitle || '').trim();
  if (!t) return '';
  const v = mapping[t];
  return v != null && String(v).trim() !== '' ? String(v).trim() : '';
}

function readJsonArray(filePath) {
  try {
    const list = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}

function writeJsonData(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
}

function appendTitleReferenceFile(filePath, canonicalTitle) {
  const t = (canonicalTitle || '').trim();
  if (!t) return;
  const list = readJsonArray(filePath);
  if (list.some((e) => (e.title || '').trim() === t)) return;
  list.push({ title: t, aliases: [] });
  list.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ko'));
  writeJsonData(filePath, list);
}

function artistEntryExists(list, s) {
  const x = (s || '').trim();
  if (!x) return false;
  for (const e of list) {
    const c = (e.artist || '').trim();
    const aliases = e.aliases && Array.isArray(e.aliases) ? e.aliases : [];
    if (c === x || aliases.some((a) => String(a).trim() === x)) return true;
  }
  return false;
}

function appendArtistReferenceFile(filePath, canonicalArtist) {
  const t = (canonicalArtist || '').trim();
  if (!t) return;
  const list = readJsonArray(filePath);
  if (artistEntryExists(list, t)) return;
  list.push({ artist: t, aliases: [] });
  list.sort((a, b) => (a.artist || '').localeCompare(b.artist || '', 'ko'));
  writeJsonData(filePath, list);
}

/** 제목 키만 가나다순(ko) 정렬. 레거시 `__default__` 키는 제거한다. */
function reorderDefaultArtistMapping(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const rest = { ...obj };
  delete rest.__default__;
  const sortedKeys = Object.keys(rest).sort((a, b) => String(a).localeCompare(String(b), 'ko'));
  const out = {};
  for (const k of sortedKeys) out[k] = rest[k];
  return out;
}

function setDefaultArtistForTitle(filePath, titleKey, artistStr) {
  let o;
  try {
    o = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    o = {};
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) o = {};
  o[titleKey] = artistStr;
  writeJsonData(filePath, reorderDefaultArtistMapping(o));
}

function createResolveContext(repoRoot, streamerId) {
  const dir = globalRefDataDir(repoRoot);
  const ctx = {
    repoRoot,
    streamerId,
    paths: {
      titleRef: path.join(dir, 'titleReference.json'),
      artistRef: path.join(dir, 'artistReference.json'),
      defaultMap: path.join(repoRoot, streamerId, 'data', 'defaultArtistMapping.json'),
    },
    titleRef: [],
    artistRef: [],
    defaultMap: {},
    reloadFromDisk() {
      ctx.titleRef = readJsonArray(ctx.paths.titleRef);
      ctx.artistRef = readJsonArray(ctx.paths.artistRef);
      ctx.defaultMap = loadDefaultArtistMapping(repoRoot, streamerId);
    },
  };
  return ctx;
}

async function askYesNo(rl, message) {
  if (!rl) return false;
  const ans = (await rl.question(message)).trim().toUpperCase();
  return ans === 'Y' || ans === 'YES';
}

async function askArtistChoice(rl, defaultArt, rawArt) {
  if (!rl) return 1;
  const msg =
    `가수 불일치 — 제목 기준 기본값 "${defaultArt}" vs 댓글 "${rawArt}"\n` +
    `  [1] 기본값 사용\n` +
    `  [2] 댓글 가수 사용 (artistReference에 추가)\n` +
    `선택 (1/2): `;
  const a = (await rl.question(msg)).trim();
  return a === '2' ? 2 : 1;
}

function mergeSongMeta(item, title, artistStorage) {
  const out = { ...item, title };
  if (artistStorage == null || String(artistStorage).trim() === '') {
    out.artist = null;
  } else {
    out.artist = String(artistStorage).trim();
  }
  return out;
}

/**
 * @param {import('readline').Interface | null} rl
 */
async function resolveItemInteractive(rl, ctx, item, caches, interactive, debug) {
  const rawTitle = (item.title || '').trim();
  const rawArtistRaw = item.artist;
  const hadRawArtistInComment = rawArtistRaw != null && String(rawArtistRaw).trim() !== '';
  const rawArtist = hadRawArtistInComment ? String(rawArtistRaw).trim() : '';

  let titleRef = ctx.titleRef;
  let artistRef = ctx.artistRef;
  const titleRefPath = ctx.paths.titleRef;
  const artistRefPath = ctx.paths.artistRef;
  const defaultMapPath = ctx.paths.defaultMap;

  let canonicalTitle = resolveTitleCanonical(titleRef, rawTitle);

  if (!canonicalTitle) {
    const cacheKey = rawTitle;
    let registerNew = false;
    if (interactive && rl) {
      if (!caches.titleNewSong.has(cacheKey)) {
        const yn = await askYesNo(
          rl,
          `[새 노래?] titleReference에 없는 제목입니다 (오타 확인).\n` +
            `  rawTitle="${rawTitle}"  rawArtist="${rawArtist || '(댓글 생략)'}"\n` +
            `  새 노래로 등록하고 레퍼런스에 추가할까요? [Y/N]: `
        );
        caches.titleNewSong.set(cacheKey, yn);
      }
      registerNew = caches.titleNewSong.get(cacheKey);
    }

    if (registerNew) {
      appendTitleReferenceFile(titleRefPath, rawTitle);
      const rawArtistWasNew = rawArtist ? !artistEntryExists(artistRef, rawArtist) : false;
      if (rawArtist) appendArtistReferenceFile(artistRefPath, rawArtist);
      ctx.reloadFromDisk();
      titleRef = ctx.titleRef;
      artistRef = ctx.artistRef;
      canonicalTitle = rawTitle;
      if (rawArtist) {
        const canonicalFromRaw =
          resolveArtistCanonical(artistRef, rawArtist) || String(rawArtist).trim();
        if (canonicalFromRaw) {
          let doSetDefault = true;
          if (interactive && rl && rawArtistWasNew) {
            const mapKey = `newSongDefault:${canonicalTitle}\t${canonicalFromRaw}`;
            if (!caches.newSongDefaultMap.has(mapKey)) {
              const yn = await askYesNo(
                rl,
                `[새 노래+새 아티스트] 제목 "${canonicalTitle}" / 가수 "${canonicalFromRaw}"\n` +
                  `defaultArtistMapping.json에 기본 가수로 저장할까요? [Y/N]: `
              );
              caches.newSongDefaultMap.set(mapKey, yn);
            }
            doSetDefault = caches.newSongDefaultMap.get(mapKey);
          }
          if (doSetDefault) {
            setDefaultArtistForTitle(defaultMapPath, canonicalTitle, canonicalFromRaw);
            ctx.reloadFromDisk();
            artistRef = ctx.artistRef;
          }
        }
      }
    } else {
      canonicalTitle = rawTitle;
    }
  }

  if (debug) {
    console.error('[DEBUG] resolve:', { rawTitle, canonicalTitle, rawArtist, hadRawArtistInComment });
  }

  if (!hadRawArtistInComment) {
    const defBlank = defaultArtistForCanonicalTitle(ctx.defaultMap, canonicalTitle);
    if (defBlank) {
      return mergeSongMeta(item, canonicalTitle, defBlank);
    }
    if (interactive && rl) {
      const cacheKeyBlank = `blankArtist:${canonicalTitle}`;
      if (!caches.blankArtistAnswer.has(cacheKeyBlank)) {
        const typed = (
          await rl.question(
            `[가수 없음] 댓글에 가수가 없고 defaultArtistMapping에 제목 "${canonicalTitle}" 항목이 없습니다.\n` +
              `기록할 가수명을 입력하세요 (비우면 source에는 null, 레퍼런스/매핑은 변경 안 함): `
          )
        ).trim();
        caches.blankArtistAnswer.set(cacheKeyBlank, typed);
      }
      const typed = caches.blankArtistAnswer.get(cacheKeyBlank);
      if (!typed) {
        return mergeSongMeta(item, canonicalTitle, null);
      }
      if (!artistEntryExists(ctx.artistRef, typed)) {
        appendArtistReferenceFile(artistRefPath, typed);
        ctx.reloadFromDisk();
        artistRef = ctx.artistRef;
      }
      const canonFromTyped =
        resolveArtistCanonical(ctx.artistRef, typed) || String(typed).trim();
      setDefaultArtistForTitle(defaultMapPath, canonicalTitle, canonFromTyped);
      ctx.reloadFromDisk();
      return mergeSongMeta(item, canonicalTitle, canonFromTyped);
    }
    return mergeSongMeta(item, canonicalTitle, null);
  }

  let canonicalArtist = resolveArtistCanonical(artistRef, rawArtist);
  if (canonicalArtist) {
    return mergeSongMeta(item, canonicalTitle, canonicalArtist);
  }

  const def = defaultArtistForCanonicalTitle(ctx.defaultMap, canonicalTitle);

  if (def && rawArtist === def) {
    return mergeSongMeta(item, canonicalTitle, def);
  }

  if (!interactive || !rl) {
    const pick = def || rawArtist;
    return mergeSongMeta(item, canonicalTitle, pick || null);
  }

  const pickKey = `${canonicalTitle}\t${rawArtist}\t${def}`;
  if (!caches.artistPick.has(pickKey)) {
    const choice = await askArtistChoice(rl, def || '(없음)', rawArtist);
    caches.artistPick.set(pickKey, choice);
  }
  const choice = caches.artistPick.get(pickKey);

  if (choice === 1) {
    const pick = def || rawArtist;
    return mergeSongMeta(item, canonicalTitle, pick || null);
  }

  appendArtistReferenceFile(artistRefPath, rawArtist);
  ctx.reloadFromDisk();
  artistRef = ctx.artistRef;
  canonicalArtist = resolveArtistCanonical(artistRef, rawArtist) || rawArtist;

  const updKey = `upd:${canonicalTitle}\t${canonicalArtist}`;
  let doUpd = caches.updateDefault.get(updKey);
  if (doUpd === undefined) {
    doUpd = await askYesNo(
      rl,
      `defaultArtistMapping.json 에서 "${canonicalTitle}" 의 기본 가수를 "${canonicalArtist}" 로 바꿀까요? [Y/N]: `
    );
    caches.updateDefault.set(updKey, doUpd);
  }
  if (doUpd) {
    setDefaultArtistForTitle(defaultMapPath, canonicalTitle, canonicalArtist);
    ctx.reloadFromDisk();
  }

  return mergeSongMeta(item, canonicalTitle, canonicalArtist);
}

/**
 * Parse one line into { title, time, artist, noMistake?, recommended?, needsReview? } or null.
 * Uses parseConfig.parts + regexSequence: build regex from sequence, match line; then detect symbols (●○☆★?) on the line.
 * After regex capture, `resolveOpts`가 있으면 레퍼런스/매핑 resolve를 적용해 title·artist를 확정한다.
 * @param {string} line - line without linePrefix (already stripped)
 * @param {{ parts: Record<string, string>, regexSequence: string }} parseConfig
 * @param {boolean} [debug] - when true, log parsing steps to stderr
 * @param {null|{ rl: import('readline').Interface | null, ctx: object, caches: object, interactive: boolean }} [resolveOpts]
 * @returns {Promise<object|null>}
 */
async function parseTimelineLine(line, parseConfig, debug, resolveOpts = null) {
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

  const preInfo = {
    title,
    time: timeStr,
    artist: artist || null,
    ...(noMistake ? { noMistake: true } : {}),
    ...(recommended ? { recommended: true } : {}),
    ...(needsReview ? { needsReview: true } : {}),
  };

  if (resolveOpts) {
    const resolved = await resolveItemInteractive(
      resolveOpts.rl,
      resolveOpts.ctx,
      preInfo,
      resolveOpts.caches,
      resolveOpts.interactive,
      debug
    );
    if (debug) console.error('[DEBUG]   결과(resolve 후):', resolved);
    return resolved;
  }

  if (debug) console.error('[DEBUG]   결과(raw):', preInfo);
  return preInfo;
}

/**
 * Parse comment HTML into songInfo using streamer-specific parseConfig.
 * A line is recognized if it contains linePrefix (anywhere); then all occurrences of linePrefix are removed and the rest is parsed via regexSequence + parts.
 * @param {string} commentHtml - e.g. "🎤 Square 3:25:43 <br />\\n..."
 * @param {{ linePrefix: string, parts: Record<string, string>, regexSequence: string }} parseConfig
 * @param {boolean} [debug] - when true, log parsing steps to stderr
 * @param {null|{ rl: import('readline').Interface | null, ctx: object, caches: object, interactive: boolean }} [resolveOpts] - 있으면 줄마다 resolve 포함
 * @returns {Promise<Array<{ title: string, time: string, artist: string|null, ... }>>}
 */
async function parseCommentHtmlToSongInfo(commentHtml, parseConfig, debug, resolveOpts = null) {
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
    const info = await parseTimelineLine(lineWithoutPrefix, parseConfig || DEFAULT_PARSE_CONFIG, debug, resolveOpts);
    const dedupeKey =
      (info && (info.title || '') + '|' + (info.artist == null ? '' : info.artist) + '|' + (info.time || '')) || '';
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
 * @param {string} vodUrl - https://vod.sooplive.com/player/{videoId}
 * @param {string} repoRoot - path to `songArchives`
 * @param {string} [streamerId='churahee'] - e.g. 'churahee', 'chebi2' (data + parseConfig under that folder)
 * @param {object|null} [preloadedVodInfo] - if set, skip getSoopVodInfo (same object as returned by getSoopVodInfo)
 * @returns {Promise<{ videoId: string, title: string, date: string, songCount: number, replaced: boolean }>}
 */
async function runPipeline(vodUrl, repoRoot, streamerId = 'churahee', preloadedVodInfo = null) {
  const parsed = parseVodUrl(vodUrl);
  if (!parsed) {
    throw new Error('Invalid URL. Use: https://vod.sooplive.com/player/{videoId} or https://vod.sooplive.co.kr/player/{videoId}');
  }

  const { videoId } = parsed;
  const vodInfo =
    preloadedVodInfo != null ? preloadedVodInfo : await getSoopVodInfo(videoId);
  if (!vodInfo) throw new Error(`Failed to fetch VOD info for ${videoId}`);

  const comments = await getSoopComments(videoId, vodInfo);
  const config = loadStreamerConfig(repoRoot, streamerId);
  const parseConfig = loadParseConfig(repoRoot, streamerId);
  const COMMENT_AUTHOR_ID = config.commentAuthorId;
  const debug = config.debug;

  if (debug) {
    console.error('[DEBUG] streamer:', streamerId);
    console.error('[DEBUG] 댓글 총 개수:', comments.length);
    console.error('[DEBUG] comment_author_id:', COMMENT_AUTHOR_ID || '(비어 있음)');
  }

  const interactive = !!(process.stdin.isTTY && !process.env.ADD_VOD_NON_INTERACTIVE);
  const rl = interactive ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;

  const ctx = createResolveContext(repoRoot, streamerId);
  ctx.reloadFromDisk();
  const caches = {
      titleNewSong: new Map(),
      artistPick: new Map(),
      updateDefault: new Map(),
      blankArtistAnswer: new Map(),
      newSongDefaultMap: new Map(),
  };
  const resolveOpts = { rl, ctx, caches, interactive };

  let songInfo = [];
  try {
    for (const c of comments) {
      if (!COMMENT_AUTHOR_ID || (c.user_id || '') !== COMMENT_AUTHOR_ID) continue;
      if (debug) console.error('[DEBUG] --- comment_author_id 댓글 파싱 시작 ---');
      const parsedList = await parseCommentHtmlToSongInfo(c.comment, parseConfig, debug, resolveOpts);
      if (debug) console.error('[DEBUG] --- 파싱 완료 → 곡 수:', parsedList.length);
      if (debug && parsedList.length > 0) {
        console.error('[DEBUG] 파싱된 곡:', parsedList.map((p) => `${p.title}${p.artist ? ` (${p.artist})` : ''} ${p.time}`));
      }
      songInfo = songInfo.concat(parsedList);
    }
  } finally {
    if (rl) rl.close();
  }

  if (debug) {
    console.error('[DEBUG] 합친 songInfo 개수:', songInfo.length);
    if (songInfo.length === 0 && comments.length > 0) {
      console.error('[DEBUG] comment_author_id 댓글이 없거나 linePrefix 형식이 아님. config/parseConfig 확인.');
    }
  }

  const date = getBroadcastDate(vodInfo);
  const title = vodInfo.full_title || vodInfo.title || '';
  const thumb = vodInfo.thumb || '';
  const url = `https://vod.sooplive.com/player/${videoId}`;

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
  globalRefDataDir,
  loadArtistReference,
  loadTitleReference,
  loadDefaultArtistMapping,
  reorderDefaultArtistMapping,
  resolveTitleCanonical,
  resolveArtistCanonical,
  parseTimelineLine,
  parseCommentHtmlToSongInfo,
  mergeVodIntoSource,
  runPipeline,
  normalizeSoopUserId,
  listConfiguredStreamerIds,
  collectArchiveStreamerMatchKeys,
  findArchiveFolderByVodStreamerId,
};
