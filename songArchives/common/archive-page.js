function getListSort() {
  const el = document.getElementById('listSort');
  return (el && el.value) || 'title';
}

function getVersionSort() {
  const el = document.getElementById('versionSort');
  return (el && el.value) || 'dateDesc';
}

function getVersionFilters() {
  return {
    noMistakeOnly: document.getElementById('filterVersionNoMistake')?.checked ?? false,
    recommendedOnly: document.getElementById('filterVersionRecommended')?.checked ?? false,
    needsReviewOnly: document.getElementById('filterVersionNeedsReview')?.checked ?? false,
  };
}

function getMinVersionCount() {
  const el = document.getElementById('minVersionCount');
  const raw = el?.value;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return 1;
  return Math.max(1, n);
}

function parseVodDate(dateStr) {
  if (!dateStr) return 0;
  const part = String(dateStr).trim().slice(0, 10);
  const t = new Date(part).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function maxDateFromVersions(versions) {
  if (!versions || !versions.length) return 0;
  const timestamps = versions.map((v) => parseVodDate(v.date)).filter((t) => t > 0);
  return timestamps.length ? Math.max(...timestamps) : 0;
}

function minDateFromVersions(versions) {
  if (!versions || !versions.length) return 0;
  const timestamps = versions.map((v) => parseVodDate(v.date)).filter((t) => t > 0);
  return timestamps.length ? Math.min(...timestamps) : 0;
}

function noMistakeRatio(versions) {
  if (!versions || !versions.length) return 0;
  const total = versions.length;
  if (!total) return 0;
  const ok = versions.filter((v) => v.noMistake).length;
  return ok / total;
}

function noMistakeCount(versions) {
  if (!versions || !versions.length) return 0;
  return versions.filter((v) => v.noMistake).length;
}

function applyVersionFilterOnly(versions, versionFilters) {
  let list = versions ? [...versions] : [];
  if (versionFilters.noMistakeOnly) list = list.filter((v) => v.noMistake);
  if (versionFilters.recommendedOnly) list = list.filter((v) => v.recommended);
  if (versionFilters.needsReviewOnly) list = list.filter((v) => v.needsReview);
  return list;
}

function sortVersionsByVersionSort(versions, versionSort) {
  let list = versions ? [...versions] : [];
  if (versionSort === 'dateAsc') {
    list.sort((a, b) => parseVodDate(a.date) - parseVodDate(b.date));
  } else {
    list.sort((a, b) => parseVodDate(b.date) - parseVodDate(a.date));
  }
  return list;
}

function getListSortLabel(listSort) {
  switch (listSort) {
    case 'title':
      return '가나다순';
    case 'dateDesc':
      return '최신 방송순';
    case 'dateAsc':
      return '오래된 방송순';
    case 'versionCountDesc':
      return '버전 많은 순';
    case 'noMistakeRatioDesc':
      return '실수 없음 비율 높은 순';
    case 'noMistakeRatioAsc':
      return '실수 없음 비율 낮은 순';
    case 'noMistakeCountDesc':
      return '실수 없음 많은 순';
    case 'noMistakeCountAsc':
      return '실수 없음 적은 순';
    default:
      return '가나다순';
  }
}

function getVersionSortLabel(versionSort) {
  switch (versionSort) {
    case 'dateAsc':
      return '오래된순';
    case 'dateDesc':
    default:
      return '최신순';
  }
}

function getCheckedDisplayLabels(versionFilters) {
  const labels = [];
  if (versionFilters.noMistakeOnly) labels.push('실수 없음');
  if (versionFilters.recommendedOnly) labels.push('추천');
  if (versionFilters.needsReviewOnly) labels.push('검토 필요');
  if (!labels.length) return ['전체 버전'];
  return labels;
}

function renderFilterDescription(minVersionCount, listSort, versionSort, versionFilters) {
  const el = document.getElementById('filterDescription');
  if (!el) return;

  const listLabel = getListSortLabel(listSort);
  const versionLabel = getVersionSortLabel(versionSort);
  const kindsLabel = getCheckedDisplayLabels(versionFilters).join(' ');

  el.textContent =
    '기록이 최소 ' +
    minVersionCount +
    '개 있는 곡을 ' +
    listLabel +
    '으로 정렬합니다. | 기록은 ' +
    versionLabel +
    '으로 정렬합니다. | ' +
    kindsLabel +
    '만 표시합니다.';
}

function applyVersionFilterAndSort(versions, versionSort, versionFilters) {
  let list = versions ? [...versions] : [];
  if (versionFilters.noMistakeOnly) list = list.filter((v) => v.noMistake);
  if (versionFilters.recommendedOnly) list = list.filter((v) => v.recommended);
  if (versionFilters.needsReviewOnly) list = list.filter((v) => v.needsReview);
  if (versionSort === 'dateAsc') {
    list.sort((a, b) => parseVodDate(a.date) - parseVodDate(b.date));
  } else {
    list.sort((a, b) => parseVodDate(b.date) - parseVodDate(a.date));
  }
  return list;
}

function versionIconsHtml(version) {
  const parts = [];
  if (version.noMistake) parts.push('<span class="version-icon" title="실수 없음">○</span>');
  if (version.recommended) parts.push('<span class="version-icon" title="추천">☆</span>');
  if (version.needsReview) parts.push('<span class="version-icon version-icon-review" title="검토 필요">?</span>');
  return parts.length ? '<span class="version-icons">' + parts.join('') + '</span>' : '';
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function loadSongs(searchTerm = '') {
  const container = document.getElementById('songList');
  if (!container) return;

  const versionFilters = getVersionFilters();
  const versionSort = getVersionSort();
  const minVersionCount = getMinVersionCount();

  const listSort = getListSort();

  renderFilterDescription(minVersionCount, listSort, versionSort, versionFilters);

  let list = songs
    .filter((song) => song.title.toLowerCase().includes((searchTerm || '').toLowerCase()))
    .map((song) => ({
      song,
      versions: song.versions || [],
    }))
    // 체크박스 필터는 아직 적용하지 않고, 곡 정렬을 위한 기준(최소 버전 수)만 먼저 적용
    .filter(({ versions }) => versions.length >= minVersionCount);

  if (listSort === 'title') {
    list.sort((a, b) => (a.song.title || '').localeCompare(b.song.title || '', 'ko'));
  } else if (listSort === 'dateDesc') {
    list.sort((a, b) => maxDateFromVersions(b.versions) - maxDateFromVersions(a.versions));
  } else if (listSort === 'dateAsc') {
    list.sort((a, b) => minDateFromVersions(a.versions) - minDateFromVersions(b.versions));
  } else if (listSort === 'versionCountDesc') {
    list.sort((a, b) => b.versions.length - a.versions.length);
  } else if (listSort === 'noMistakeRatioDesc') {
    list.sort(
      (a, b) =>
        noMistakeRatio(b.versions) - noMistakeRatio(a.versions) ||
        b.versions.length - a.versions.length
    );
  } else if (listSort === 'noMistakeRatioAsc') {
    list.sort(
      (a, b) =>
        noMistakeRatio(a.versions) - noMistakeRatio(b.versions) ||
        a.versions.length - b.versions.length
    );
  } else if (listSort === 'noMistakeCountDesc') {
    list.sort(
      (a, b) =>
        noMistakeCount(b.versions) - noMistakeCount(a.versions) ||
        b.versions.length - a.versions.length
    );
  } else if (listSort === 'noMistakeCountAsc') {
    list.sort(
      (a, b) =>
        noMistakeCount(a.versions) - noMistakeCount(b.versions) ||
        a.versions.length - b.versions.length
    );
  }

  container.innerHTML = '';

  list.forEach(({ song, versions }) => {
    // 1) 버전 정렬(versionSort) 먼저 수행
    const versionsSorted = sortVersionsByVersionSort(versions, versionSort);
    // 2) 체크박스에 해당하는 버전은 우선 표시, 나머지는 뒤로 보내고 희미하게 처리
    const versionsMatching = applyVersionFilterOnly(versionsSorted, versionFilters);
    const matchingSet = new Set(versionsMatching);
    const versionsToDisplay = [
      ...versionsMatching,
      ...versionsSorted.filter((v) => !matchingSet.has(v)),
    ];

    const row = document.createElement('section');
    row.className = 'song-row';

    const titleEl = document.createElement('h2');
    titleEl.className = 'song-row-title';
    titleEl.textContent = song.title;

    const strip = document.createElement('div');
    strip.className = 'version-strip';

    versionsToDisplay.forEach((v) => {
      const icons = versionIconsHtml(v);
      const card = document.createElement('a');
      card.href = v.url;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
      const isMatching = matchingSet.has(v);
      card.className = 'version-card' + (isMatching ? '' : ' version-card-faded');
      card.innerHTML = `
        <span class="version-card-thumb">
          <img src="${escapeHtml(v.thumbnail)}" alt="" loading="lazy" />
        </span>
        <span class="version-card-info">
          <span class="version-card-meta">
            <span class="version-card-date">${escapeHtml(v.date)}</span>
            ${icons ? `<span class="version-card-icons">${icons}</span>` : ''}
          </span>
          <span class="version-card-title">${escapeHtml(v.videoTitle || '')}</span>
        </span>
      `;
      strip.appendChild(card);
    });

    row.appendChild(titleEl);
    row.appendChild(strip);
    container.appendChild(row);
  });
}

function searchSongs() {
  loadSongs(document.getElementById('searchBar')?.value ?? '');
}

function onFilterOrSortChange() {
  loadSongs(document.getElementById('searchBar')?.value ?? '');
}

(function setupStripDragScroll() {
  const DRAG_THRESHOLD = 5;
  let state = { strip: null, startX: 0, startScroll: 0, didMove: false };
  let preventClick = false;

  function getStrip(el) {
    return el && el.closest ? el.closest('.version-strip') : null;
  }

  function isStripBackground(target) {
    const strip = getStrip(target);
    return strip && target === strip;
  }

  function endDrag(allowPreventClick) {
    if (state.strip) {
      if (state.didMove && allowPreventClick) preventClick = true;
      state.strip.classList.remove('dragging');
      state = { strip: null, startX: 0, startScroll: 0, didMove: false };
    }
  }

  document.addEventListener('mousedown', (e) => {
    if (!isStripBackground(e.target)) return;
    const strip = getStrip(e.target);
    state = { strip, startX: e.clientX, startScroll: strip.scrollLeft, didMove: false };
  });

  document.addEventListener('mousemove', (e) => {
    if (!state.strip) return;
    const dx = state.startX - e.clientX;
    if (!state.didMove && Math.abs(dx) > DRAG_THRESHOLD) {
      state.didMove = true;
      state.strip.classList.add('dragging');
    }
    if (state.didMove) state.strip.scrollLeft = state.startScroll + dx;
  });

  document.addEventListener('mouseup', () => endDrag(true));
  window.addEventListener('mouseup', () => endDrag(true), true);
  document.addEventListener('mouseleave', (e) => {
    if (e.target === document.documentElement || e.target === document.body) endDrag(false);
  });

  document.addEventListener('click', (e) => {
    if (preventClick && getStrip(e.target)) {
      e.preventDefault();
      e.stopPropagation();
      preventClick = false;
    }
  }, true);

  document.addEventListener('touchstart', (e) => {
    if (!isStripBackground(e.target) || e.touches.length !== 1) return;
    const strip = getStrip(e.target);
    state = { strip, startX: e.touches[0].clientX, startScroll: strip.scrollLeft, didMove: false };
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!state.strip || e.touches.length !== 1) return;
    const dx = state.startX - e.touches[0].clientX;
    if (!state.didMove && Math.abs(dx) > DRAG_THRESHOLD) {
      state.didMove = true;
      state.strip.classList.add('dragging');
    }
    if (state.didMove) state.strip.scrollLeft = state.startScroll + dx;
  }, { passive: true });

  document.addEventListener('touchend', () => endDrag(true));
  document.addEventListener('touchcancel', () => endDrag(false));
})();

function renderDataLastUpdated() {
  const el = document.getElementById('dataLastUpdated');
  if (!el) return;
  if (typeof SONGS_DATA_LAST_UPDATED !== 'string' || !SONGS_DATA_LAST_UPDATED) {
    el.textContent = '';
    return;
  }
  const d = new Date(SONGS_DATA_LAST_UPDATED);
  if (Number.isNaN(d.getTime())) {
    el.textContent = '데이터 갱신: ' + SONGS_DATA_LAST_UPDATED;
    el.title = SONGS_DATA_LAST_UPDATED;
    return;
  }
  el.textContent =
    '데이터 갱신: ' +
    d.toLocaleString('ko-KR', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Seoul',
    });
  el.title = 'UTC: ' + d.toISOString();
}

/** 다시보기 플레이어 URL에서 쿼리를 제거한 페이지 주소 (동일 방송 중복 제거용) */
function vodPageUrl(rawUrl) {
  try {
    const u = new URL(rawUrl, typeof location !== 'undefined' ? location.href : undefined);
    u.search = '';
    return u.toString();
  } catch {
    const s = String(rawUrl);
    const i = s.indexOf('?');
    return i >= 0 ? s.slice(0, i) : s;
  }
}

const VOD_CAL_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

let vodIndexCache = null;

function buildVodIndex() {
  const byBase = new Map();
  if (typeof songs === 'undefined' || !Array.isArray(songs)) {
    return { entries: [], byDate: new Map() };
  }

  for (const song of songs) {
    const versions = song.versions || [];
    for (const v of versions) {
      if (!v || !v.url) continue;
      const base = vodPageUrl(v.url);
      const datePart = String(v.date || '').trim().slice(0, 10);
      const ts = parseVodDate(datePart);
      const existing = byBase.get(base);
      if (!existing) {
        byBase.set(base, {
          pageUrl: base,
          date: datePart,
          ts,
          videoTitle: v.videoTitle || '',
          thumbnail: v.thumbnail || '',
        });
      } else {
        if (ts > existing.ts) {
          existing.date = datePart;
          existing.ts = ts;
        }
        if (!existing.videoTitle && v.videoTitle) existing.videoTitle = v.videoTitle;
        if (!existing.thumbnail && v.thumbnail) existing.thumbnail = v.thumbnail;
      }
    }
  }

  const entries = Array.from(byBase.values());
  const byDate = new Map();
  for (const e of entries) {
    if (!e.date) continue;
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date).push(e);
  }
  for (const [, arr] of byDate) {
    arr.sort((a, b) => (a.pageUrl || '').localeCompare(b.pageUrl || ''));
  }
  return { entries, byDate };
}

function getVodIndex() {
  if (!vodIndexCache) vodIndexCache = buildVodIndex();
  return vodIndexCache;
}

function getVodPanelDateSort() {
  const el = document.getElementById('vodPanelDateSort');
  return (el && el.value) || 'dateDesc';
}

function getVodPanelViewMode() {
  const el = document.getElementById('vodPanelViewMode');
  return (el && el.value) || 'list';
}

function sortedVodEntries(entries, sortMode) {
  const list = entries ? [...entries] : [];
  if (sortMode === 'dateAsc') {
    list.sort((a, b) => (a.ts || 0) - (b.ts || 0) || (a.pageUrl || '').localeCompare(b.pageUrl || ''));
  } else {
    list.sort((a, b) => (b.ts || 0) - (a.ts || 0) || (a.pageUrl || '').localeCompare(b.pageUrl || ''));
  }
  return list;
}

function renderVodPanelList() {
  const ul = document.getElementById('vodPanelList');
  if (!ul) return;
  const { entries } = getVodIndex();
  const sortMode = getVodPanelDateSort();
  const sorted = sortedVodEntries(entries, sortMode);

  ul.innerHTML = '';
  sorted.forEach((e) => {
    const li = document.createElement('li');
    li.className = 'vod-panel-item';
    const a = document.createElement('a');
    a.className = 'vod-panel-link';
    a.href = e.pageUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    const dateSpan = document.createElement('span');
    dateSpan.className = 'vod-panel-date';
    dateSpan.textContent = e.date || '날짜 없음';
    a.appendChild(dateSpan);
    if (e.videoTitle) {
      const t = document.createElement('span');
      t.className = 'vod-panel-link-title';
      t.textContent = e.videoTitle;
      a.appendChild(t);
    }
    li.appendChild(a);
    ul.appendChild(li);
  });
}

/** 한국(서울) 기준 오늘이 속한 연-월 `YYYY-MM` */
function getCurrentYearMonthSeoul() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value;
  const mRaw = parts.find((p) => p.type === 'month')?.value;
  if (!y || mRaw == null || mRaw === '') {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  return `${y}-${String(mRaw).padStart(2, '0')}`;
}

function enumerateYearMonths(minDateStr, maxDateStr, newestFirst) {
  const months = [];
  const min = String(minDateStr || '').slice(0, 7);
  const max = String(maxDateStr || '').slice(0, 7);
  if (!min || min.length < 7 || !max || max.length < 7) return months;

  const [y0, m0] = min.split('-').map((x) => Number.parseInt(x, 10));
  const [y1, m1] = max.split('-').map((x) => Number.parseInt(x, 10));
  if (!Number.isFinite(y0) || !Number.isFinite(m0) || !Number.isFinite(y1) || !Number.isFinite(m1)) {
    return months;
  }

  let y = y0;
  let m = m0;
  const endKey = y1 * 12 + (m1 - 1);
  for (;;) {
    const key = y * 12 + (m - 1);
    if (key > endKey) break;
    months.push({ y, m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  if (newestFirst) months.reverse();
  return months;
}

function primaryVodForDay(dayEntries, sortMode) {
  if (!dayEntries || !dayEntries.length) return null;
  const copy = [...dayEntries];
  if (sortMode === 'dateAsc') {
    copy.sort((a, b) => (a.pageUrl || '').localeCompare(b.pageUrl || ''));
  } else {
    copy.sort((a, b) => (b.pageUrl || '').localeCompare(a.pageUrl || ''));
  }
  return copy[0];
}

function renderVodPanelCalendar() {
  const wrap = document.getElementById('vodPanelCalendarWrap');
  if (!wrap) return;
  const { entries, byDate } = getVodIndex();
  if (!entries.length) {
    wrap.innerHTML = '';
    return;
  }

  const sortMode = getVodPanelDateSort();
  const chron = sortedVodEntries(entries, 'dateAsc');
  const firstDataDate = chron[0]?.date;
  const firstYm = String(firstDataDate || '').slice(0, 7);
  const curYm = getCurrentYearMonthSeoul();
  if (!firstYm || firstYm.length < 7) {
    wrap.innerHTML = '';
    return;
  }
  /* 가장 오래된 기록 월 ~ 오늘(서울)이 속한 월 (ISO YYYY-MM 문자열 비교) */
  const minRangeYm = firstYm <= curYm ? firstYm : curYm;
  const maxRangeYm = firstYm <= curYm ? curYm : firstYm;
  const months = enumerateYearMonths(
    `${minRangeYm}-01`,
    `${maxRangeYm}-01`,
    sortMode === 'dateDesc'
  );

  wrap.innerHTML = '';
  months.forEach(({ y, m }) => {
    const section = document.createElement('section');
    section.className = 'vod-cal-month';
    const h3 = document.createElement('h3');
    h3.className = 'vod-cal-month-title';
    h3.textContent = `${y}년 ${m}월`;
    section.appendChild(h3);

    const grid = document.createElement('div');
    grid.className = 'vod-cal-grid';
    VOD_CAL_WEEKDAYS.forEach((wd) => {
      const h = document.createElement('div');
      h.className = 'vod-cal-weekday';
      h.textContent = wd;
      grid.appendChild(h);
    });

    const first = new Date(y, m - 1, 1);
    const lastDay = new Date(y, m, 0).getDate();
    const startPad = first.getDay();
    for (let i = 0; i < startPad; i += 1) {
      const pad = document.createElement('div');
      pad.className = 'vod-cal-day is-pad';
      pad.setAttribute('aria-hidden', 'true');
      grid.appendChild(pad);
    }

    for (let d = 1; d <= lastDay; d += 1) {
      const mm = String(m).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const dateStr = `${y}-${mm}-${dd}`;
      const dayList = byDate.get(dateStr);
      if (dayList && dayList.length) {
        const primary = primaryVodForDay(dayList, sortMode);
        const a = document.createElement('a');
        a.className = 'vod-cal-day';
        a.href = primary ? primary.pageUrl : '#';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.title =
          dayList.length > 1
            ? `${dateStr} · 다시보기 ${dayList.length}건`
            : primary?.videoTitle
              ? `${dateStr} — ${primary.videoTitle}`
              : dateStr;
        const inner = document.createElement('span');
        inner.className = 'vod-cal-day-inner';
        inner.textContent = String(d);
        if (dayList.length > 1) {
          const badge = document.createElement('span');
          badge.className = 'vod-cal-day-count';
          badge.textContent = String(dayList.length);
          inner.appendChild(badge);
        }
        a.appendChild(inner);
        grid.appendChild(a);
      } else {
        const span = document.createElement('div');
        span.className = 'vod-cal-day';
        span.textContent = String(d);
        grid.appendChild(span);
      }
    }

    section.appendChild(grid);
    wrap.appendChild(section);
  });
}

function updateVodPanelVisibility() {
  const mode = getVodPanelViewMode();
  const listWrap = document.getElementById('vodPanelListWrap');
  const calWrap = document.getElementById('vodPanelCalendarWrap');
  if (listWrap && calWrap) {
    const isList = mode === 'list';
    listWrap.classList.toggle('is-hidden', !isList);
    listWrap.toggleAttribute('hidden', !isList);
    calWrap.classList.toggle('is-hidden', isList);
    calWrap.toggleAttribute('hidden', isList);
  }
}

function renderVodPanel() {
  updateVodPanelVisibility();
  const mode = getVodPanelViewMode();
  if (mode === 'list') {
    renderVodPanelList();
  } else {
    renderVodPanelCalendar();
  }
}

function setupVodPanel() {
  const panel = document.getElementById('vodPanel');
  const toggle = document.getElementById('vodPanelToggle');
  if (toggle && panel) {
    toggle.addEventListener('click', () => {
      const collapsed = panel.classList.toggle('is-collapsed');
      toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    });
  }
  document.getElementById('vodPanelViewMode')?.addEventListener('change', renderVodPanel);
  document.getElementById('vodPanelDateSort')?.addEventListener('change', renderVodPanel);
  renderVodPanel();
}

/** Soop CDN 프로필 로고 (webp). fetch 불필요 — <link rel="icon">은 CORS 제한 없이 로드됨. */
function soopProfileLogoWebpUrl(channelId) {
  const id = String(channelId).trim().toLowerCase();
  if (!id) return null;
  const enc = encodeURIComponent(id);
  return `https://stimg.sooplive.com/LOGO/ch/${enc}/m/${enc}.webp`;
}

function guessFaviconMimeType(href) {
  const lower = String(href).toLowerCase();
  if (lower.includes('.webp')) return 'image/webp';
  if (lower.includes('.svg')) return 'image/svg+xml';
  if (lower.includes('.ico')) return 'image/x-icon';
  return 'image/png';
}

function ensureStimgPreconnect() {
  const origin = 'https://stimg.sooplive.com';
  if (document.querySelector(`link[rel="preconnect"][href="${origin}"]`)) return;
  const pc = document.createElement('link');
  pc.rel = 'preconnect';
  pc.href = origin;
  pc.crossOrigin = 'anonymous';
  document.head.insertBefore(pc, document.head.firstChild);
}

/**
 * 스트리머 폴더 index.html: window.SONG_ARCHIVE_PAGE
 * - siteTitle (선택)
 * - favicon (선택): 절대 URL 또는 스트리머 폴더 기준 상대 경로. 있으면 Soop CDN보다 우선.
 * - soopChannelId (선택): Soop 채널 슬러그(로고 URL 경로의 ch/{id}/m/{id}.webp). stimg에서 webp 파비콘.
 */
function applySongArchivePageConfig() {
  const c = typeof window !== 'undefined' ? window.SONG_ARCHIVE_PAGE : null;
  if (!c || typeof c !== 'object') return;
  if (c.siteTitle) {
    document.title = c.siteTitle;
    const h1 = document.querySelector('.site-title');
    if (h1) h1.textContent = c.siteTitle;
  }

  let iconHref = null;
  let iconType = 'image/png';
  if (typeof c.favicon === 'string' && c.favicon.trim()) {
    iconHref = c.favicon.trim();
    iconType = guessFaviconMimeType(iconHref);
  } else if (typeof c.soopChannelId === 'string' && c.soopChannelId.trim()) {
    iconHref = soopProfileLogoWebpUrl(c.soopChannelId);
    if (iconHref) {
      iconType = 'image/webp';
      ensureStimgPreconnect();
    }
  }
  if (!iconHref) return;

  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.insertBefore(link, document.head.firstChild);
  }
  link.type = iconType;
  link.href = iconHref;
}

applySongArchivePageConfig();

window.onload = () => {
  renderDataLastUpdated();
  loadSongs();
  setupVodPanel();
  document.getElementById('searchBar')?.addEventListener('input', searchSongs);
  document.getElementById('searchBar')?.addEventListener('keyup', searchSongs);
  document.getElementById('listSort')?.addEventListener('change', onFilterOrSortChange);
  document.getElementById('versionSort')?.addEventListener('change', onFilterOrSortChange);
  document.getElementById('minVersionCount')?.addEventListener('input', onFilterOrSortChange);
  ['filterVersionNoMistake', 'filterVersionRecommended', 'filterVersionNeedsReview'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', onFilterOrSortChange);
  });
};
