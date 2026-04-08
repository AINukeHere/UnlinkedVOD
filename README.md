# UnlinkedVOD — 노래 기록 보관소

## 노래 기록 허브

- **GitHub Pages**: [https://ainukehere.github.io/UnlinkedVOD/songArchives/](https://ainukehere.github.io/UnlinkedVOD/songArchives/)
- 로컬에서는 저장소에서 `songArchives/index.html`을 열면 스트리머별 보관소로 이동할 수 있습니다.

## 노래 데이터 추가

저장소 **루트**에서 실행합니다. Soop 다시보기 URL만 넣으면, VOD 메타의 스트리머 id(`writer_id`)로 `songArchives/{스트리머}/` 아카이브가 자동 선택됩니다.

```bash
npm install
npm run add -- "https://vod.sooplive.com/player/{videoId}"
```

`vod.sooplive.com` / `vod.sooplive.co.kr` 의 `/player/{videoId}` 형식을 씁니다. 같은 `videoId`가 이미 있으면 교체하고, 없으면 추가합니다.

**진행 순서(자동):** Soop API로 VOD·댓글 수집 → 해당 스트리머 `data/parseConfig.json`으로 타임라인 파싱 → `songReference` / `artistReference`가 있으면 제목·가수 정규화 → `data/source.json` 반영 → `python songArchives/common/preprocess.py {스트리머}`로 `songs.js` 재생성(add 스크립트가 호출).

변경된 `source.json`, `songs.js` 등을 커밋·푸시하면 배포에 반영됩니다.

## `config.json` (`songArchives/{스트리머}/data/config.json`)

`config.example.json`을 복사해 `config.json`으로 두고 값을 채웁니다. 이 저장소에서는 `config.json`이 `.gitignore`에 포함되어 있을 수 있습니다.

| 키 | 설명 |
|----|------|
| **`comment_author_id`** (권장) | Soop **댓글**의 `user_id`와 같게 둡니다. 이 계정이 쓴 댓글만 타임라인으로 파싱합니다. |
| **`authorUserId`** | 레거시 이름. `comment_author_id`와 같은 역할입니다. |
| **`streamer_id`** (선택) | VOD의 스트리머 id(`writer_id`)와 **폴더명·`comment_author_id`만으로는 매칭이 안 될 때** 넣습니다. |
| **`soopWriterId`** | 레거시 이름. `streamer_id`와 비슷한 보조 매칭용입니다. |
| **`debug`** | `true`이면 파이프라인 단계 로그가 stderr에 더 자세히 나옵니다. |

**아카이브 선택:** VOD의 `writer_id`가 아래 **어느 하나**와 같으면 그 스트리머 폴더가 고해집니다 — **폴더 이름**, **`comment_author_id`**, (있으면) **`streamer_id`** / **`soopWriterId`**, **`authorUserId`**.

**환경 변수** (`config.json`이 없거나 값이 비어 있을 때):  
`{스트리머대문자}_COMMENT_AUTHOR_ID`, `{스트리머대문자}_AUTHOR_USER_ID`, 그리고 코드에 남아 있는 `CHURAHEE_COMMENT_AUTHOR_ID` / `CHURAHEE_AUTHOR_USER_ID` 폴백. 디버그는 `CHURAHEE_DEBUG` 또는 `DEBUG`.

## 새 스트리머 보관소 페이지

1. `songArchives/chebi2/index.html` 전체를 `songArchives/{폴더명}/index.html`로 복사합니다.
2. `window.SONG_ARCHIVE_PAGE`에서 `siteTitle`, `soopChannelId`(Soop 채널 슬러그 — stimg 파비콘용) 또는 로컬·절대 URL `favicon`(있으면 CDN보다 우선)을 수정합니다.
3. `<title>`·`<h1 class="site-title">`는 `siteTitle`과 맞춥니다(선택 — `archive-page.js`가 동기화합니다).
4. `data/`(`config.json`, `parseConfig.json`, `source.json` 초기화 등), `songs.js`를 준비합니다.
5. `songArchives/index.html` 허브에 스트리머 링크를 추가합니다.

공통 스크립트·스타일: `../common/archive-page.css`, `../common/archive-page.js`

## 노래·가수 공식 레퍼런스

댓글에서 뽑은 **제목·가수**를 캐노니컬 표기로 맞춥니다. 파일이 없으면 해당 단계는 건너뜁니다.

**곡** — `songArchives/common/data/titleReference.json`

- 배열. 항목 예: `{ "title": "캐노니컬 제목", "aliases": ["별칭1", "별칭2"] }`
- `aliases`: 댓글에 나올 수 있는 제목의 다른 표기(오타, 한글/영문 등). **필수 배열.**
- 댓글 제목이 `title` 또는 `aliases` 중 하나와 맞으면 `title`로 정규화합니다.

**가수** — `songArchives/common/data/artistReference.json`

- 배열. 항목 예: `{ "artist": "캐노니컬 가수", "aliases": ["별칭1", "별칭2"] }`
- `aliases`: 댓글에 나올 수 있는 다른 표기. **필수 배열.**

**순서:** (1) 댓글 한 줄 파싱으로 제목·가수 추출 → (2) `titleReference`로 제목 치환 → (3) `artistReference`로 가수 치환 → (4) 스트리머별 `defaultArtistMapping.json`으로 가수 보강.
