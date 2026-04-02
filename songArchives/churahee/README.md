# 노래 기록 보관소 — 데이터 추가 방법

노래 아카이브는 **`songArchives/`** 아래에 공통 모듈(`common/`)과 스트리머 폴더(`churahee/`, `chebi2/` 등)가 있습니다. 각 스트리머는 **자기 `data/`**의 `config`, `parseConfig`, `source.json`, 레퍼런스만 쓰며, 파싱 규칙은 `parseConfig.json`으로 다르게 둡니다.

## 새 다시보기 추가 / 기존 VOD 갱신

Soop 다시보기 URL만 있으면 로컬에서 한 번에 반영할 수 있습니다.

### 1. 저장소 루트에서 실행

프로젝트 **루트**(UnlinkedVOD)에서 실행하세요. Soop VOD 메타의 **스트리머 id**(API 필드명 `writer_id`)가 아래 **어느 하나와 같으면** 그 아카이브를 고릅니다: **폴더 이름**, **`comment_author_id`**, (선택) **`streamer_id`** / 레거시 `soopWriterId`, 레거시 `authorUserId`. 보통은 **`comment_author_id`만** 있으면 됩니다.

```bash
npm run add -- "https://vod.sooplive.co.kr/player/189435111"
# 또는 npm run add -- "https://vod.sooplive.com/player/189435111"
```

- **URL 형식**: `vod.sooplive.com` / `vod.sooplive.co.kr` 의 `/player/{videoId}` (쿼리·해시 무시).
- **같은 videoId가 이미 있으면**: 해당 VOD 데이터를 **교체**하고, 없으면 **추가**합니다.

### 2. 자동으로 일어나는 일

1. Soop API로 VOD 정보를 받아 **스트리머 id(`writer_id`)로 아카이브 폴더를 고른 뒤**, 댓글을 가져옵니다.
2. 해당 스트리머의 **parseConfig**(`songArchives/{streamer}/data/parseConfig.json`)로 댓글 라인을 파싱합니다.
3. 옵션으로 해당 스트리머의 **songReference/artistReference**로 제목·가수를 정규화합니다.
4. `songArchives/{streamer}/data/source.json`에 반영합니다(같은 videoId면 교체, 없으면 추가).
5. `python songArchives/common/preprocess.py {streamer}`로 `{streamer}/songs.js`를 다시 만듭니다. 이때 **데이터 갱신 시각**이 `songs.js`에 기록되며, 보관소 페이지 헤더 우측에 표시됩니다.

### 3. 배포

변경된 `source.json`, `songs.js` 를 커밋한 뒤 푸시하면 됩니다.

```bash
git add songArchives/churahee/data/source.json songArchives/churahee/songs.js
git commit -m "churahee: VOD 추가/갱신"
git push
```

GitHub Pages를 쓰는 경우, push 후 잠시 지나면 사이트에 반영됩니다.

---

## 필요 환경

- **Node.js** (addVod 스크립트 실행)
- **Python** (preprocess.py 실행 — addVod가 자동 호출)

### comment_author_id (필수) · 스트리머 id와 아카이브 매칭

Soop **댓글**의 `user_id`와 같은 값을 **`comment_author_id`**에 넣습니다. 이 계정이 쓴 댓글만 타임라인으로 파싱합니다. **`npm run add`** 는 VOD의 **스트리머 id**(`writer_id`)가 위 매칭 후보 중 하나와 맞는 아카이브를 고릅니다. **`streamer_id`는 넣지 않아도 됩니다** — 폴더명(예: `churahee`)이나 `comment_author_id`가 VOD id와 같으면 생략 가능합니다.

**파일로 설정 (권장)**  
1. `songArchives/churahee/data/config.example.json`을 `songArchives/churahee/data/config.json`으로 복사합니다.  
2. `"comment_author_id"`를 타임라인을 쓰는 Soop 계정의 **댓글 user_id**로 채웁니다.  
3. (선택) 폴더명·`comment_author_id`만으로는 VOD `writer_id`와 맞지 않을 때만 **`streamer_id`**(또는 레거시 `soopWriterId`)를 넣습니다.  
4. 기존 설정은 그대로 둘 수 있습니다: 코드가 **`authorUserId`**(→ 댓글 작성자), **`soopWriterId`**(→ VOD 스트리머 id 보조)도 읽습니다.  
5. `config.json`은 `.gitignore`에 있어 커밋되지 않습니다.

**환경 변수**  
`config.json`이 없거나 값이 비어 있으면 환경 변수를 씁니다.  
- 댓글 작성자: `CHURAHEE_COMMENT_AUTHOR_ID` (또는 레거시 `CHURAHEE_AUTHOR_USER_ID`)  
- 디버그: `CHURAHEE_DEBUG` 또는 `DEBUG` (1이면 켜짐)

### add 할 때 디버깅

`config.json`에 `"debug": true`를 넣으면 파이프라인 단계별 로그가 stderr로 출력되고, 에러 시 스택 전체가 찍힙니다. (환경 변수 `CHURAHEE_DEBUG` 또는 `DEBUG`도 동일하게 동작)

로그에서 확인할 수 있는 것: 댓글 총 개수, `comment_author_id`, 해당 댓글에서 파싱된 곡 수·목록, 합친 songInfo 개수. 0 songs면 `comment_author_id`가 댓글 `user_id`와 안 맞거나, 댓글이 **parseConfig.linePrefix** 형식이 아닐 수 있음.

### 스트리머별 파싱 설정 (parseConfig.json)

각 스트리머 폴더의 `data/parseConfig.json`에서 **정규식 기반**으로 댓글 파싱 방식을 정의합니다.

- **linePrefix**: 타임라인으로 인식할 문자열(예: `"🎤"`). 이 문자열이 **포함된** 줄만 곡으로 파싱하며, 파싱 시 해당 문자열을 라인에서 모두 제거한 뒤 나머지를 정규식으로 파싱합니다.
- **parts**: 한 줄에서 떼어낼 각 파트의 정규식(캡처 그룹 1개).  
  - `songTitle`: 제목  
  - `songArtist`: 가수(괄호 안 내용만 쓰려면 `"\\s*\\(([^)]*)\\)"`)  
  - `time`: 시간 `"(\\d{1,2}:\\d{1,2}(?::\\d{1,2})?)"`  
  스트리머마다 패턴을 다르게 넣을 수 있습니다.
- **regexSequence**: `parts`를 조합한 한 줄 정규식. `{파트명}`(필수), `{파트명?}`(선택)으로 넣습니다. 예: `"{songTitle}{songArtist?}\\s*{time}"` → 가수 괄호가 없어도 매칭됩니다.

파싱 순서: linePrefix로 대상 줄 판별 → 접두사 전부 제거 → 그 줄에서 실수(●○)·추천(☆★)·검토(?) 여부 판별 → 심볼 제거한 뒤 `regexSequence`로 제목·가수·시간 추출.

### 노래·가수 공식 레퍼런스 (오타·영문/한글명 정규화)

댓글의 **노래 제목**과 **가수**를 각각 레퍼런스에서 찾아 캐노니컬로 바꿉니다. 곡 레퍼런스와 가수 레퍼런스를 분리해 관리합니다.

- **곡 레퍼런스** `songArchives/churahee/data/songReference.json`  
  - 형식: `[{ "title": "캐노니컬 제목", "artist": "캐노니컬 가수", "titleAliases": ["별칭1", "별칭2"] }, ...]`  
  - `title`, `artist`: 이 프로젝트에서 쓰는 캐노니컬 제목·가수.  
  - `titleAliases`: **필수 배열**. 댓글에 쓸 수 있는 **제목**의 다른 표기(오타, 한글/영문 등).  
  - 댓글 제목이 `title` 또는 `titleAliases` 중 하나와 일치하고, 가수도 일치하면 이 항목의 title/artist로 정규화됩니다.
- **가수 레퍼런스** `songArchives/churahee/data/artistReference.json`  
  - 형식: `[{ "artist": "캐노니컬 가수", "aliases": ["별칭1", "별칭2"] }, ...]`  
  - `artist`: 캐노니컬 가수명.  
  - `aliases`: **필수 배열**. 댓글에 쓸 수 있는 다른 표기(IU, 이지은, TAEYEON 등).  
  - 댓글 가수가 `artist` 또는 `aliases` 중 하나와 일치하면 해당 캐노니컬 가수로 치환됩니다.
- **동작 순서**: add 시 (1) 댓글에서 제목·가수 파싱(예: `🎤 블루밍 (이지은) 42:00` → 제목 `블루밍`, 가수 `이지은`). (2) 가수를 `artistReference`로 조회해 캐노니컬 가수로 치환. (3) 제목을 `songReference`에서 조회(같은 캐노니컬 가수인 곡만)해 캐노니컬 제목·가수로 치환.
- **예시**: `songReference.example.json` → `songReference.json`, `artistReference.example.json` → `artistReference.json`으로 복사해 사용. 파일이 없으면 해당 정규화는 건너뜁니다.
