# UnlinkedVOD - Streamer Reactions Hub

스트리머 반응 영상과 커뮤니티를 위한 웹 서비스입니다.

## 기능

- 🎬 **스트리머 반응 영상 시각화**: RDF 데이터를 사용한 인터랙티브 그래프
- 🎵 **츄라희 노래 모음집**: 노래 검색 및 관리
- 💬 **커뮤니티**: 글 작성, 댓글, 좋아요 기능
- 📸 **이미지 업로드**: 글에 이미지 첨부 가능

## 기술 스택

- **Backend**: Node.js + Express
- **Frontend**: HTML, CSS, JavaScript
- **Data Visualization**: D3.js, RDF.js
- **File Upload**: Multer
- **Deployment**: Railway

## 로컬 개발 환경 설정

1. **의존성 설치**
   ```bash
   npm install
   ```

2. **개발 서버 실행**
   ```bash
   npm run dev
   ```

3. **브라우저에서 확인**
   - 메인 페이지: http://localhost:3000
   - 노래 모음집: http://localhost:3000/churahee
   - 커뮤니티: http://localhost:3000/community

## Railway 배포

### 1. Railway 계정 생성
- [Railway.app](https://railway.app)에서 GitHub 계정으로 가입

### 2. 프로젝트 배포
1. Railway 대시보드에서 "New Project" 클릭
2. "Deploy from GitHub repo" 선택
3. 이 저장소 선택
4. 자동으로 배포 시작

### 3. 환경 변수 설정 (선택사항)
Railway 대시보드에서 환경 변수 설정:
- `NODE_ENV=production`
- 기타 필요한 환경 변수

### 4. 도메인 설정
- Railway에서 제공하는 기본 도메인 사용
- 또는 커스텀 도메인 연결 가능

## API 엔드포인트

### 글 관련
- `POST /api/posts` - 새 글 작성
- `GET /api/posts` - 글 목록 조회
- `GET /api/posts/:id` - 글 상세 조회
- `POST /api/posts/:id/like` - 좋아요
- `POST /api/posts/:id/comments` - 댓글 추가

### 노래 관련
- `GET /api/songs` - 노래 목록 조회
- `POST /api/songs` - 노래 추가

### 기타
- `GET /api/rdf` - RDF 데이터 조회

## 프로젝트 구조

```
├── public/                 # 정적 파일
│   ├── index.html         # 메인 페이지
│   ├── community.html     # 커뮤니티 페이지
│   ├── churahee/          # 노래 모음집
│   └── uploads/           # 업로드된 파일
├── server.js              # Express 서버
├── package.json           # 의존성 관리
├── railway.json           # Railway 배포 설정
└── data.ttl              # RDF 데이터
```

## 개발 가이드

### 새 기능 추가
1. `server.js`에 API 엔드포인트 추가
2. `public/` 폴더에 프론트엔드 파일 추가
3. 필요시 데이터베이스 스키마 수정

### 데이터베이스 마이그레이션
현재는 메모리 저장소를 사용하지만, 프로덕션에서는 PostgreSQL 등 실제 데이터베이스를 사용하는 것을 권장합니다.

## 라이선스

MIT License

## 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
