# UnlinkedVOD — 개발자 안내

사용자용 안내는 [README.md](README.md)를 보세요. 이 문서는 로컬 실행, 데이터 파이프라인, 커뮤니티(Apps Script) 배포, 새 스트리머 추가를 다룹니다.

## 구성 개요

```
UnlinkedVOD/
├── index.html                 # 루트 랜딩 (반응 클립 — 준비 중)
├── songArchives/
│   ├── index.html             # 스트리머별 보관소 허브
│   ├── addVod.js              # CLI: VOD URL → source.json / songs.js
│   ├── {streamer}/            # churahee, irumi1523, chebi2, singgyul …
│   │   ├── index.html
│   │   ├── songs.js           # 페이지가 읽는 곡 목록 (생성물)
│   │   └── data/
│   │       ├── source.json
│   │       ├── parseConfig.json
│   │       ├── defaultArtistMapping.json
│   │       ├── config.example.json
│   │       └── config.json    # gitignore (로컬 전용)
│   └── common/
│       ├── archive-page.js / .css
│       ├── community-data.js
│       ├── add-song-dialog.html
│       ├── soopPipeline.js
│       ├── preprocess.py
│       ├── data/              # titleReference / artistReference
│       └── apps-script/
│           └── Code.gs
└── package.json
```

각 스트리머 페이지: `songs.js` → `archive-page.js` → `community-data.js`.  
모달 마크업은 `community-data.js`가 `add-song-dialog.html`을 `fetch`합니다. `file://`보다 로컬 정적 서버를 권장합니다.

## 요구 사항

- Node.js **≥ 18** (`npm run add`)
- Python 3 (`preprocess.py`, add 스크립트가 호출)
- 커뮤니티 기능: Google 계정 + Sheets / Apps Script 웹 앱

---

## 데이터 넣는 두 가지 방법

### 1) 운영자 CLI (`npm run add`)

저장소 **루트**에서 Soop 다시보기 URL만 넣으면, VOD 메타의 `writer_id`로 `songArchives/{스트리머}/`가 선택됩니다.

```bash
npm install
npm run add -- "https://vod.sooplive.com/player/{videoId}"
```

같은 `videoId`가 있으면 교체, 없으면 추가합니다.

**진행 순서:** Soop API로 VOD·댓글 수집 → `data/parseConfig.json` 파싱 → `titleReference` / `artistReference` 정규화 → `defaultArtistMapping.json` 보강 → `data/source.json` → `python songArchives/common/preprocess.py {스트리머}`로 `songs.js` 재생성.

변경분을 커밋·푸시하면 GitHub Pages에 반영됩니다.

### 2) 방문객 제출 — Google Sheets + Apps Script

| 파일 | 역할 |
|------|------|
| `songArchives/common/community-data.js` | 조회·제출·모달·미리보기 |
| `songArchives/common/add-song-dialog.html` | 모달 마크업 |
| `songArchives/common/apps-script/Code.gs` | `doGet` / `doPost` |

**배포 요약** (`Code.gs` 상단 주석과 동일):

1. 스프레드시트에 Apps Script로 `Code.gs` 반영  
2. 스코프: spreadsheets + (선택) `script.external_request` (`vod_info`용)  
3. 웹 앱 배포: 실행 계정 **나**, 액세스 **모든 사용자**  
4. 배포 URL → `community-data.js`의 `COMMUNITY_SHEETS_APPS_SCRIPT_ID` / URL, 또는 `window.SONG_ARCHIVE_PAGE.sheetsWebAppUrl`  
5. 코드 변경 후 **새 버전 배포**

**API:**

- `GET ?action=songs&streamerId=churahee`
- `GET ?action=vod_info&videoId=…`
- `GET ?action=authorize`
- `POST { action: "submit_song", … }`

표시 플래그(실수 없음·추천·검토·싱크룸) UI는 현재 `churahee`, `irumi1523`에서만 노출됩니다.  
시트 기록 시 선행 `= + - @` 등은 수식 인젝션 방지를 위해 무력화합니다. 공개 제출 API이므로 `pending` 승인·레이트 리밋 등을 운영에서 검토하세요.

---

## `config.json`

경로: `songArchives/{스트리머}/data/config.json`  
`config.example.json`을 복사합니다. `songArchives/**/data/config.json`은 `.gitignore` 대상입니다.

| 키 | 설명 |
|----|------|
| **`comment_author_id`** (권장) | Soop 댓글 `user_id`. 이 계정 댓글만 타임라인 파싱 |
| **`authorUserId`** | 레거시 (`comment_author_id`와 동일) |
| **`streamer_id`** (선택) | `writer_id` 보조 매칭 |
| **`soopWriterId`** | 레거시 (`streamer_id` 보조) |
| **`debug`** | `true`면 파이프라인 로그 상세 |

**아카이브 선택:** VOD `writer_id`가 폴더명, `comment_author_id`, (있으면) `streamer_id` / `soopWriterId` / `authorUserId` 중 하나와 같으면 해당 폴더 선택.

**환경 변수:** `{스트리머대문자}_COMMENT_AUTHOR_ID`, `{스트리머대문자}_AUTHOR_USER_ID`, `CHURAHEE_*` 폴백. 디버그: `CHURAHEE_DEBUG` / `DEBUG`.

---

## 새 스트리머 보관소

1. 기존 스트리머 `index.html`을 `songArchives/{폴더명}/`로 복사  
2. `window.SONG_ARCHIVE_PAGE`: `siteTitle`, `soopChannelId` (필요 시 `sheetsWebAppUrl`)  
3. `<title>`·`<h1>`을 `siteTitle`과 맞춤  
4. `data/` + `songs.js` 준비  
5. `songArchives/index.html`에 링크 추가  
6. 스크립트 순서: `songs.js` → `archive-page.js` → `community-data.js`

---

## 노래·가수 레퍼런스

- **곡** `songArchives/common/data/titleReference.json`  
  `{ "title": "캐노니컬", "aliases": ["별칭", …] }` (`aliases` 필수)
- **가수** `songArchives/common/data/artistReference.json`  
  `{ "artist": "캐노니컬", "aliases": ["별칭", …] }`

**순서:** 댓글 파싱 → `titleReference` → `artistReference` → 스트리머 `defaultArtistMapping.json`.  
커뮤니티 모달 가수 자동 입력도 `songs` + `defaultArtistMapping.json`을 사용합니다.

## Pages 배포

- 허브: [songArchives/](https://ainukehere.github.io/UnlinkedVOD/songArchives/)  
- 정적 사이트. `source.json` / `songs.js` 변경은 커밋·푸시로 반영.  
- 커뮤니티 기록은 시트 + Apps Script이며, 프론트만 푸시해도 시트 데이터는 기존 배포 URL을 그대로 씁니다.
