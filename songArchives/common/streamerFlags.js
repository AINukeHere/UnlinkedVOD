/** 실수 없음·추천·검토 필요 플래그를 쓰는 스트리머 id */
var STREAMERS_WITH_VERSION_FLAGS = ['churahee', 'irumi1523'];

function usesVersionFlags(streamerId) {
  return STREAMERS_WITH_VERSION_FLAGS.indexOf(String(streamerId || '').trim()) !== -1;
}

if (typeof module === 'object' && module.exports) {
  module.exports = { STREAMERS_WITH_VERSION_FLAGS: STREAMERS_WITH_VERSION_FLAGS, usesVersionFlags: usesVersionFlags };
} else {
  window.SONG_ARCHIVE_STREAMER_FLAGS = {
    STREAMERS_WITH_VERSION_FLAGS: STREAMERS_WITH_VERSION_FLAGS,
    usesVersionFlags: usesVersionFlags,
  };
}
