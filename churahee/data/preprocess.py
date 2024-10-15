import json

with open("churahee/data/source.json","rt", encoding='utf-8') as f:
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

songs_dict = {}
for history in json_data['history']:
    if "template" in history:
        continue
    date = history['date']
    videoTitle = history['title']
    url_base = history['url']
    # 썸네일 URL 생성
    thumbnail_url =  history["thumbnail"]
    
    for song in history['songInfo']:
        title = song['title']
        time_in_seconds = time_to_seconds(song['time'])
        vod_url = f"{url_base}?change_second={time_in_seconds}"
        noMistake = False
        recommended = False
        if 'noMistake' in song:
            noMistake = song['noMistake']
        if 'recommended' in song:
            recommended = song['recommended']
        
        # 기존 노래 타이틀이 이미 존재하면 versions에 추가
        if title in songs_dict:
            songs_dict[title]["versions"].append({
                "date": date,
                "url": vod_url,
                "videoTitle": videoTitle,
                "views": 1000,  # 기본 조회수는 1000으로 설정 (변경 가능)
                "thumbnail": thumbnail_url,
                "noMistake": noMistake,
                "recommended": recommended
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
                        "recommended": recommended
                    }
                ]
            }

songs_js_data = list(songs_dict.values())  # 딕셔너리 값을 배열로 변환
# 결과 출력 (songs.js 형태로 변환)
songs_js = f"const songs = {json.dumps(songs_js_data, indent=2, ensure_ascii=False)};"
# print(songs_js)

# 변환된 songs.js 파일로 저장
with open("churahee/songs.js", "w", encoding="utf-8") as f:
    f.write(songs_js)
