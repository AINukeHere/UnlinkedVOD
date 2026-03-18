import json
import os
import sys
from datetime import datetime, timezone

# Archive root = parent of this file's directory (songArchives/common → songArchives).
# Run: python songArchives/common/preprocess.py [streamerId]  (cwd 무관)
_script_dir = os.path.dirname(os.path.abspath(__file__))
archive_root = os.path.dirname(_script_dir)
streamer_id = sys.argv[1] if len(sys.argv) > 1 else "churahee"
source_path = os.path.join(archive_root, streamer_id, "data", "source.json")
songs_js_path = os.path.join(archive_root, streamer_id, "songs.js")

with open(source_path, "rt", encoding="utf-8") as f:
    json_data = json.load(f)


# 시간을 초 단위로 변환하는 함수
def time_to_seconds(time_str):
    splitres = time_str.split(':')
    h = 0
    m = 0
    s = 0
    if len(splitres) == 3:
        h, m, s = map(int, splitres)
    elif len(splitres) == 2:
        m, s = map(int, splitres)
    elif len(splitres) == 1:
        s = map(int, splitres)

    return h * 3600 + m * 60 + s

# url 겹치는지 체크용
url_dict = {}

songs_dict = {}
for history in json_data['history']:
    if "template" in history:
        continue
    
    url_base = history['url']
    if url_base in url_dict:
        print(f'[중복] url: {url_base}')
    else:
        url_dict[url_base] = True

    date = history['date']
    videoTitle = history['title']
    # 썸네일 URL 생성
    thumbnail_url =  history["thumbnail"]
    
    for song in history['songInfo']:
        title = song['title']
        time_in_seconds = time_to_seconds(song['time'])
        vod_url = f"{url_base}?change_second={time_in_seconds}"
        noMistake = False
        recommended = False
        needsReview = False
        if 'noMistake' in song:
            noMistake = song['noMistake']
        if 'recommended' in song:
            recommended = song['recommended']
        if 'needsReview' in song:
            needsReview = song['needsReview']

        # 기존 노래 타이틀이 이미 존재하면 versions에 추가
        if title in songs_dict:
            songs_dict[title]["versions"].append({
                "date": date,
                "url": vod_url,
                "videoTitle": videoTitle,
                "views": 1000,  # 기본 조회수는 1000으로 설정 (변경 가능)
                "thumbnail": thumbnail_url,
                "noMistake": noMistake,
                "recommended": recommended,
                "needsReview": needsReview
            })
        # 새로운 노래 타이틀이면 새로운 항목 생성
        else:
            songs_dict[title] = {
                "title": title,
                "versions": [
                    {
                        "date": date,
                        "videoTitle": videoTitle,
                        "url": vod_url,
                        "views": 1000,
                        "thumbnail": thumbnail_url,
                        "noMistake": noMistake,
                        "recommended": recommended,
                        "needsReview": needsReview
                    }
                ]
            }

songs_js_data = list(songs_dict.values())  # 딕셔너리 값을 배열로 변환
# 데이터 빌드 시각 (UTC ISO) — 페이지 상단에 표시
last_updated = datetime.now(timezone.utc).isoformat()
songs_js = (
    f"const SONGS_DATA_LAST_UPDATED = {json.dumps(last_updated)};\n"
    f"const songs = {json.dumps(songs_js_data, indent=2, ensure_ascii=False)};"
)
# print(songs_js)

# 변환된 songs.js 파일로 저장
with open(songs_js_path, "w", encoding="utf-8") as f:
    f.write(songs_js)
