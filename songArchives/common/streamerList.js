/** 공개 노래 기록 보관소 목록 (허브·헤더 드롭다운 공통) */
var SONG_ARCHIVE_STREAMERS = [
  { id: 'churahee', name: '츄라희' },
  { id: 'irumi1523', name: '백시호' },
  { id: 'chebi2', name: '체비' },
];

if (typeof module === 'object' && module.exports) {
  module.exports = { SONG_ARCHIVE_STREAMERS: SONG_ARCHIVE_STREAMERS };
} else {
  window.SONG_ARCHIVE_STREAMER_LIST = {
    SONG_ARCHIVE_STREAMERS: SONG_ARCHIVE_STREAMERS,
  };
}
