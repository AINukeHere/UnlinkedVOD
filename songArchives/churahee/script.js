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
      card.rel = 'noopener';
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

window.onload = () => {
  renderDataLastUpdated();
  loadSongs();
  document.getElementById('searchBar')?.addEventListener('input', searchSongs);
  document.getElementById('searchBar')?.addEventListener('keyup', searchSongs);
  document.getElementById('listSort')?.addEventListener('change', onFilterOrSortChange);
  document.getElementById('versionSort')?.addEventListener('change', onFilterOrSortChange);
  document.getElementById('minVersionCount')?.addEventListener('input', onFilterOrSortChange);
  ['filterVersionNoMistake', 'filterVersionRecommended', 'filterVersionNeedsReview'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', onFilterOrSortChange);
  });
};
