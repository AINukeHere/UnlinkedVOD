# UnlinkedVOD

스트리머 VOD·노래 기록을 위한 정적 웹 프로젝트입니다.

## 현재 상태

| 서비스 | 경로 | 상태 |
|--------|------|------|
| **반응 클립 연결 그래프** | `/` (루트) | 준비 중 (더미 페이지) |
| **노래 기록 보관소(허브)** | `/songArchives/` | 사용 가능 |
| **츄라희·체비 보관소** | `/songArchives/churahee/` 등 | 루트 → songArchives 에서 이동 |

## GitHub Pages

- **메인(루트)**: [https://ainukehere.github.io/UnlinkedVOD/](https://ainukehere.github.io/UnlinkedVOD/)
- **노래 기록 허브**: [https://ainukehere.github.io/UnlinkedVOD/songArchives/](https://ainukehere.github.io/UnlinkedVOD/songArchives/)
- **츄라희 보관소**: `…/songArchives/churahee/`

## 기술 스택

- **배포**: GitHub Pages (정적)
- **로컬**: Live Server 등으로 `songArchives/churahee/index.html` 또는 루트 열기
- **데이터 추가**: Node.js + Python (`songArchives/common` 파이프라인)

## 로컬에서 사용하기

1. **의존성** (데이터 추가 시)
   ```bash
   npm install
   ```

2. **사이트 확인**
   - 노래 기록: 루트에서 `songArchives/` → 스트리머 선택, 또는 `songArchives/index.html`

3. **VOD 추가**
   ```bash
   npm run add -- "https://vod.sooplive.co.kr/player/{videoId}"
   ```
   상세: **[songArchives/churahee/README.md](songArchives/churahee/README.md)** · 아카이브 구조: **[songArchives/README.md](songArchives/README.md)**

## 프로젝트 구조

```
├── index.html
├── package.json
├── songArchives/              # 노래 아카이브
│   ├── README.md
│   ├── common/                # 공통: soopPipeline.js, preprocess.py
│   ├── churahee/              # 스트리머별 페이지·데이터
│   └── chebi2/
└── README.md
```

## 라이선스

MIT License
