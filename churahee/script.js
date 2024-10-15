const N = 5; // 탑 N개의 버전을 보여줄 개수

function loadSongs(searchTerm = "") {
  const songList = document.getElementById('songList');
  songList.innerHTML = ''; // 기존 목록 초기화
  
  const filteredSongs = songs.filter(song =>
    song.title.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  filteredSongs.forEach(song => {
    const li = document.createElement('li');
    const songTitle = document.createElement('h3');
    const versionPreviewDiv = document.createElement('div');
    versionPreviewDiv.className = 'versionPreview'
    songTitle.innerText = song.title;

    const versionButton = document.createElement('button');
    versionButton.innerText = `${song.versions.length}개의 버전 보기`;
    versionButton.onclick = () => showTopNVersions(song);

    li.appendChild(songTitle);
    li.appendChild(versionButton);
    li.appendChild(versionPreviewDiv);
    li.id = song.title;
    songList.appendChild(li);
  });
}

function showTopNVersions(song) {
  // const container = document.querySelector('.container');
  // container.innerHTML = `<h2>${song.title}</h2>`;
  const songListItem = document.getElementById(`${song.title}`);
  const container = songListItem.lastChild
  container.innerHTML = ''
  const ul = document.createElement('ul');
  ul.classList.add('version-list');

  // 버전들을 조회수 기준으로 정렬한 후 탑 N개를 가져옴
  const topVersions = song.versions
    // .sort((a, b) => b.views - a.views)
    // .slice(0, N);

  topVersions.forEach(version => {
    const li = document.createElement('li');

    // 이미지에 링크 추가
    li.innerHTML = `
      <div>
        <a href="${version.url}" target="_blank">
          <img src="${version.thumbnail}" alt="Thumbnail" width="150" height="100" />
        </a>
        <a href="${version.url}" target="_blank">${version.date} 방송<br>${version.videoTitle}</a>
      </div>
    `;
    ul.appendChild(li);
  });

  container.appendChild(ul);
}


function searchSongs() {
  const searchTerm = document.getElementById('searchBar').value;
  loadSongs(searchTerm);
}
// 노래 버전들을 화면에 추가하는 함수
function displaySongVersions(versions, songTitle) {
  const versionContainer = document.getElementById('versionContainer');

  // 제목 추가 (노래 클릭 시 해당 노래의 제목 표시)
  const titleElement = document.createElement('h3');
  titleElement.textContent = songTitle;

  // 제목을 컨테이너에 추가
  versionContainer.appendChild(titleElement);

  versions.forEach(version => {
    // 노래 버전의 각 요소 생성
    const versionElement = document.createElement('div');
    versionElement.classList.add('version-item');

    // 썸네일 이미지에 링크 추가
    const thumbnailLink = document.createElement('a');
    thumbnailLink.href = version.url;  // 썸네일 이미지를 클릭하면 VOD URL로 이동
    thumbnailLink.target = "_blank";   // 새 창에서 열기

    const thumbnail = document.createElement('img');
    thumbnail.src = version.thumbnail;
    thumbnail.alt = `${version.date} 버전의 썸네일`;

    // 썸네일 이미지를 링크 안에 추가
    thumbnailLink.appendChild(thumbnail);

    // 텍스트 정보 (날짜와 조회수) 추가
    const infoText = document.createElement('p');
    infoText.textContent = `날짜: ${version.date} | 조회수: ${version.views}`;

    // 버전 요소에 썸네일 링크와 텍스트 정보 추가
    versionElement.appendChild(thumbnailLink);
    versionElement.appendChild(infoText);

    // 버전 컨테이너에 이 버전 추가
    versionContainer.appendChild(versionElement);
  });
}

// 노래 리스트를 표시하는 함수 (각 노래를 클릭할 수 있게 처리)
function displaySongs(songs) {
  const songList = document.getElementById('songList');
  songList.innerHTML = ''; // 기존 노래 리스트 초기화

  songs.forEach(song => {
    const songElement = document.createElement('li');
    songElement.textContent = song.title;

    // 노래를 클릭하면 해당 노래의 버전들이 표시되도록 이벤트 추가
    songElement.addEventListener('click', () => {
      // 기존에 선택된 노래의 버전들을 추가로 표시
      displaySongVersions(song.versions, song.title);
    });

    songList.appendChild(songElement);
  });
}

window.onload = () => loadSongs();
