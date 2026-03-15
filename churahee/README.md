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
2. 댓글에서 타임라인(노래 제목 + 구간)을 파싱합니다.
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

### 환경 변수

- **`CHURAHEE_AUTHOR_USER_ID`** (필수): Soop 댓글 작성자 user_id. 이 ID로 작성된 댓글만 타임라인으로 파싱합니다.  
  - 로컬에서 addVod를 실행하기 전에 설정하세요.  
  - **Cursor 터미널 / PowerShell** (한 줄):  
    `$env:CHURAHEE_AUTHOR_USER_ID="내_user_id"; npm run churahee:add -- "https://vod.sooplive.co.kr/player/12345"`  
  - **bash**:  
    `CHURAHEE_AUTHOR_USER_ID=내_user_id npm run churahee:add -- "https://vod.sooplive.co.kr/player/12345"`  
  - **확인** (PowerShell): `echo $env:CHURAHEE_AUTHOR_USER_ID`  
  - **확인** (Node 기준): `node -e "console.log(process.env.CHURAHEE_AUTHOR_USER_ID || '(비어 있음)')"`
