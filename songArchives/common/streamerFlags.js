/**
 * 버전 표시 플래그(실수 없음 / 추천 / 검토 필요)를 쓰는 스트리머 목록.
 * - Node: require('./streamerFlags')
 * - 브라우저: <script src="../common/streamerFlags.js"> 후 window.SONG_ARCHIVE_STREAMER_FLAGS
 *
 * 새 스트리머를 플래그 사용으로 추가할 때 STREAMERS_WITH_VERSION_FLAGS 에 id 를 넣거나
 * `npm run add-streamer -- --id <id> --title <이름> --flags` 를 사용하세요.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SONG_ARCHIVE_STREAMER_FLAGS = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  /** @type {readonly string[]} */
  var STREAMERS_WITH_VERSION_FLAGS = Object.freeze([
    // BEGIN_STREAMERS_WITH_VERSION_FLAGS
    'churahee',
    'irumi1523',
    // END_STREAMERS_WITH_VERSION_FLAGS
  ]);

  function usesVersionFlags(streamerId) {
    var id = String(streamerId || '').trim();
    if (!id) return false;
    return STREAMERS_WITH_VERSION_FLAGS.indexOf(id) !== -1;
  }

  return {
    STREAMERS_WITH_VERSION_FLAGS: STREAMERS_WITH_VERSION_FLAGS,
    usesVersionFlags: usesVersionFlags,
  };
});
