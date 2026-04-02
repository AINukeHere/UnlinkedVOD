# 노래 아카이브 (songArchives)

스트리머별 **노래 기록 보관소**와 **공통 파이프라인**을 둡니다.

## 구조

웹에서 **`songArchives/index.html`** 에서 스트리머별 보관소로 이동합니다.

```
songArchives/
├── addVod.js               # 통합 진입: URL만 넘기면 VOD 스트리머 id로 아카이브 선택
├── index.html              # 허브: 스트리머 링크
├── common/
│   ├── archive-page.css    # 스트리머 보관소 공통 레이아웃·스타일
│   ├── archive-page.js     # 공통 UI (목록·날짜 패널 등, songs 전역 사용)
│   ├── soopPipeline.js     # Soop API, 댓글 파싱, source.json 병합
│   └── preprocess.py      # source.json → 각 스트리머 songs.js
├── churahee/
│   ├── data/
│   ├── index.html          # SONG_ARCHIVE_PAGE + songs.js + ../common/archive-page.*
│   └── songs.js
├── chebi2/
│   └── …
```

- **보관소 UI**는 `common/archive-page.css`, `common/archive-page.js` 한 벌을 모든 스트리머가 공유합니다. 스트리머 폴더에는 `index.html`(제목·favicon 설정), `songs.js`, `data/`만 둡니다.
- **add 파이프라인**도 `common/soopPipeline.js` 등으로 공통입니다.
- **스트리머별**로 `data/config.json`(`comment_author_id` 등), `data/parseConfig.json`(파싱 규칙), `data/source.json` 등이 다릅니다.

## 새 스트리머 보관소 페이지

- `songArchives/chebi2/index.html` 전체를 `songArchives/{폴더명}/index.html`로 복사합니다.
- `window.SONG_ARCHIVE_PAGE`의 `siteTitle`·`favicon`(선택)을 수정합니다.
- `<title>`·`<h1 class="site-title">` 문자열은 같은 제목으로 맞춥니다(선택 — `archive-page.js`가 `siteTitle`로 동기화합니다).
- `data/`, `songs.js`를 두고, 허브 `songArchives/index.html`에 링크를 추가합니다.

공통 리소스 경로: `../common/archive-page.css`, `../common/archive-page.js`

## 실행

저장소 **루트**에서 `npm run add -- "https://vod.sooplive.com/player/{videoId}"` 를 실행합니다. (`songArchives/addVod.js`)

preprocess는 **저장소 루트에서도** 실행 가능합니다 (스크립트가 `songArchives` 경로를 자동 계산).

```bash
python songArchives/common/preprocess.py churahee
```

자세한 절차는 [churahee/README.md](churahee/README.md) 참고.
