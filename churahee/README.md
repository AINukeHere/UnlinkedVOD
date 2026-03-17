# 츄라희 노래 모음집 — 데이터 추가 방법

## 새 다시보기 추가 / 기존 VOD 갱신

Soop 다시보기 URL만 있으면 로컬에서 한 번에 반영할 수 있습니다.

### 1. 저장소 루트에서 실행

프로젝트 **루트**(UnlinkedVOD)에서 아래 중 하나로 실행하세요.

```bash
# npm 스크립트 (URL을 인자로)
npm run churahee:add -- "https://vod.sooplive.co.kr/player/189435111"

# 또는 node로 직접
node churahee/addVod.js "https://vod.sooplive.co.kr/player/189435111"
```

- **URL 형식**: `https://vod.sooplive.co.kr/player/{videoId}` 만 지원합니다.
- **같은 videoId가 이미 있으면**: 해당 VOD 데이터를 **교체**하고, 없으면 **추가**합니다.

### 2. 자동으로 일어나는 일

1. Soop API로 VOD 정보·댓글을 가져옵니다.
2. 댓글에서 타임라인(노래 제목 + 구간)을 파싱합니다. 옵션으로 **공식 레퍼런스**(`songReference.json`)로 제목/가수를 정규화합니다.
3. `churahee/data/source.json` 에 반영합니다(같은 videoId면 교체, 없으면 추가).
4. `churahee/data/preprocess.py` 를 실행해 `churahee/songs.js` 를 다시 만듭니다.

### 3. 배포

변경된 `source.json`, `songs.js` 를 커밋한 뒤 푸시하면 됩니다.

```bash
git add churahee/data/source.json churahee/songs.js
git commit -m "churahee: VOD 추가/갱신"
git push
```

GitHub Pages를 쓰는 경우, push 후 잠시 지나면 사이트에 반영됩니다.

---

## 필요 환경

- **Node.js** (addVod 스크립트 실행)
- **Python** (preprocess.py 실행 — addVod가 자동 호출)

### 작성자 user_id (필수)

Soop 댓글 작성자 **user_id**를 설정해야 합니다. 이 ID로 작성된 댓글만 타임라인으로 파싱합니다.

**파일로 설정 (권장)**  
1. `churahee/data/config.example.json`을 `churahee/data/config.json`으로 복사합니다.  
2. `config.json`에서 `"authorUserId": ""`를 본인 Soop user_id로 채웁니다.  
   예: `"authorUserId": "내_user_id"`  
3. `config.json`은 `.gitignore`에 있어 커밋되지 않습니다.

**환경 변수**  
`config.json`이 없거나 값이 비어 있으면 환경 변수를 씁니다.  
- 작성자 ID: `CHURAHEE_AUTHOR_USER_ID`  
- 디버그: `CHURAHEE_DEBUG` 또는 `DEBUG` (1이면 켜짐)

### add 할 때 디버깅

`config.json`에 `"debug": true`를 넣으면 파이프라인 단계별 로그가 stderr로 출력되고, 에러 시 스택 전체가 찍힙니다. (환경 변수 `CHURAHEE_DEBUG` 또는 `DEBUG`도 동일하게 동작)

로그에서 확인할 수 있는 것: 댓글 총 개수, 설정된 작성자 user_id, 작성자 댓글에서 파싱된 곡 수·목록, 합친 songInfo 개수. 0 songs면 작성자 user_id가 안 맞거나, 댓글이 `🎤 제목 시간` 형식이 아닐 수 있음.

### 노래·가수 공식 레퍼런스 (오타·영문/한글명 정규화)

댓글의 **노래 제목**과 **가수**를 각각 레퍼런스에서 찾아 캐노니컬로 바꿉니다. 곡 레퍼런스와 가수 레퍼런스를 분리해 관리합니다.

- **곡 레퍼런스** `churahee/data/songReference.json`  
  - 형식: `[{ "title": "캐노니컬 제목", "artist": "캐노니컬 가수", "titleAliases": ["별칭1", "별칭2"] }, ...]`  
  - `title`, `artist`: 이 프로젝트에서 쓰는 캐노니컬 제목·가수.  
  - `titleAliases`: **필수 배열**. 댓글에 쓸 수 있는 **제목**의 다른 표기(오타, 한글/영문 등).  
  - 댓글 제목이 `title` 또는 `titleAliases` 중 하나와 일치하고, 가수도 일치하면 이 항목의 title/artist로 정규화됩니다.
- **가수 레퍼런스** `churahee/data/artistReference.json`  
  - 형식: `[{ "artist": "캐노니컬 가수", "aliases": ["별칭1", "별칭2"] }, ...]`  
  - `artist`: 캐노니컬 가수명.  
  - `aliases`: **필수 배열**. 댓글에 쓸 수 있는 다른 표기(IU, 이지은, TAEYEON 등).  
  - 댓글 가수가 `artist` 또는 `aliases` 중 하나와 일치하면 해당 캐노니컬 가수로 치환됩니다.
- **동작 순서**: add 시 (1) 댓글에서 제목·가수 파싱(예: `🎤 블루밍 (이지은) 42:00` → 제목 `블루밍`, 가수 `이지은`). (2) 가수를 `artistReference`로 조회해 캐노니컬 가수로 치환. (3) 제목을 `songReference`에서 조회(같은 캐노니컬 가수인 곡만)해 캐노니컬 제목·가수로 치환.
- **예시**: `songReference.example.json` → `songReference.json`, `artistReference.example.json` → `artistReference.json`으로 복사해 사용. 파일이 없으면 해당 정규화는 건너뜁니다.
