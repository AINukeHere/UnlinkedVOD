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

function applyVersionFilterOnly(versions, versionFilters) {
  let list = versions ? [...versions] : [];
  if (versionFilters.noMistakeOnly) list = list.filter((v) => v.noMistake);
  if (versionFilters.recommendedOnly) list = list.filter((v) => v.recommended);
  if (versionFilters.needsReviewOnly) list = list.filter((v) => v.needsReview);
  return list;
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

  let list = songs.filter((song) =>
    song.title.toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  list = list
    .map((song) => ({
      song,
      filteredVersions: applyVersionFilterOnly(song.versions, versionFilters),
    }))
    .filter(({ filteredVersions }) => filteredVersions.length >= 1);

  const listSort = getListSort();
  if (listSort === 'title') {
    list.sort((a, b) => (a.song.title || '').localeCompare(b.song.title || '', 'ko'));
  } else if (listSort === 'dateDesc') {
    list.sort((a, b) => maxDateFromVersions(b.filteredVersions) - maxDateFromVersions(a.filteredVersions));
  } else if (listSort === 'dateAsc') {
    list.sort((a, b) => minDateFromVersions(a.filteredVersions) - minDateFromVersions(b.filteredVersions));
  } else if (listSort === 'versionCountDesc') {
    list.sort((a, b) => b.filteredVersions.length - a.filteredVersions.length);
  }

  container.innerHTML = '';

  list.forEach(({ song, filteredVersions }) => {
    const versionsToShow = applyVersionFilterAndSort(song.versions, versionSort, versionFilters);

    const row = document.createElement('section');
    row.className = 'song-row';

    const titleEl = document.createElement('h2');
    titleEl.className = 'song-row-title';
    titleEl.textContent = song.title;

    const strip = document.createElement('div');
    strip.className = 'version-strip';

    versionsToShow.forEach((v) => {
      const icons = versionIconsHtml(v);
      const card = document.createElement('a');
      card.href = v.url;
      card.target = '_blank';
      card.rel = 'noopener';
      card.className = 'version-card';
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
  ['filterVersionNoMistake', 'filterVersionRecommended', 'filterVersionNeedsReview'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', onFilterOrSortChange);
  });
};
