# 노래 아카이브 (songArchives)

스트리머별 **노래 기록 보관소**와 **공통 파이프라인**을 둡니다.

## 구조

웹에서 **`songArchives/index.html`** 에서 스트리머별 보관소로 이동합니다.

```
songArchives/
├── index.html              # 허브: 스트리머 링크
├── common/                 # 공통 (스트리머 폴더와 무관)
│   ├── soopPipeline.js     # Soop API, 댓글 파싱, source.json 병합
│   └── preprocess.py       # source.json → 각 스트리머 songs.js
├── churahee/               # 스트리머: 츄라희
│   ├── data/               # config, parseConfig, source.json, 레퍼런스
│   ├── addVod.js
│   ├── index.html, songs.js, …
├── chebi2/                 # 스트리머: 체비 등 (예시)
│   └── …
```

- **공통 코드**는 `common/`만 수정하면 모든 스트리머 add 파이프라인에 반영됩니다.
- **스트리머별**로 `data/config.json`(댓글 작성자), `data/parseConfig.json`(파싱 규칙), `data/source.json` 등이 다릅니다.

## 실행

저장소 **루트**에서 npm 스크립트를 쓰거나, `node songArchives/{스트리머}/addVod.js` 를 실행합니다.

preprocess는 **저장소 루트에서도** 실행 가능합니다 (스크립트가 `songArchives` 경로를 자동 계산).

```bash
python songArchives/common/preprocess.py churahee
```

자세한 절차는 [churahee/README.md](churahee/README.md) 참고.
