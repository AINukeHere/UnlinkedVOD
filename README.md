# UnlinkedVOD

스트리머 VOD·노래 기록을 위한 정적 웹 프로젝트입니다.

## 현재 상태

| 서비스 | 경로 | 상태 |
|--------|------|------|
| **반응 클립 연결 그래프** | `/` (루트) | 준비 중 (더미 페이지) |
| **츄라희의 노래 기록** | `/churahee/` | 사용 가능 |

## GitHub Pages

저장소 **Settings → Pages** 에서 Source를 설정하면 아래 주소로 접속할 수 있습니다.

- **메인(루트)**: [https://ainukehere.github.io/UnlinkedVOD/](https://ainukehere.github.io/UnlinkedVOD/)
- **츄라희 노래 기록**: [https://ainukehere.github.io/UnlinkedVOD/churahee/](https://ainukehere.github.io/UnlinkedVOD/churahee/)

## 기술 스택

- **배포**: GitHub Pages (정적)
- **로컬 확인**: Live Server 등으로 `churahee/index.html` 또는 루트 열기
- **데이터 추가**: Node.js + Python (로컬 전용, `churahee` 파이프라인)

## 로컬에서 사용하기

1. **의존성** (데이터 추가 시에만 필요)
   ```bash
   npm install
   ```
   현재 `package.json`에는 서버 의존성 없음. `churahee:add` 등 스크립트 실행 시 Node만 필요.

2. **사이트 확인**
   - 루트: `index.html` — 반응 클립 그래프 안내(준비 중)
   - 노래 기록: `churahee/index.html` — Live Server로 열거나 GitHub Pages 배포 후 `/churahee/` 접속

3. **노래 기록에 VOD 추가**
   ```bash
   npm run churahee:add -- "https://vod.sooplive.co.kr/player/{videoId}"
   ```
   자세한 절차·환경 변수(`CHURAHEE_AUTHOR_USER_ID`)는 **[churahee/README.md](churahee/README.md)** 참고.

## 프로젝트 구조

```
├── index.html          # 루트 더미 페이지 (반응 클립 그래프 준비 중)
├── package.json        # churahee:add, churahee:migrate 스크립트
├── churahee/           # 츄라희 노래 기록 (정적 앱)
│   ├── index.html
│   ├── styles.css
│   ├── script.js
│   ├── songs.js        # preprocess로 생성
│   ├── addVod.js       # VOD 추가 CLI
│   ├── soopPipeline.js # Soop API·댓글 파싱
│   ├── data/
│   │   ├── source.json # 원본 타임라인 데이터
│   │   ├── preprocess.py
│   │   └── migrateAfreecaToSoop.js
│   └── README.md       # 데이터 추가 방법
├── data.ttl            # (기타 RDF 등)
└── README.md
```

## 라이선스

MIT License
