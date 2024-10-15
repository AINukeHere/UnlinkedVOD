songInfo = {
    "songInfo":[

    ]
}

with open('churahee/data/comment.txt','rt',encoding='utf-8') as f:
    lines = f.readlines()

for line in lines:
    res = line.split('[')
    title = res[0].replace('：',':').replace('⁚',':')
    timeline = res[1].replace(']','')
    recommended = False
    noMistake = False
    if '☆' in timeline:
        timeline = timeline.replace('☆','')
        recommended = True
    if '●' in timeline:
        timeline = timeline.replace('●','')
        noMistake = True
    title = title.strip()
    timeline = timeline.strip()
    info = {}
    info['title'] = title
    info['time'] = timeline
    if noMistake:
        info['noMistake'] = True
    if recommended:
        info['recommended'] = True
    songInfo['songInfo'].append(info)

import json
song_info = ',\n '.join(json.dumps(song, ensure_ascii=False) for song in songInfo["songInfo"])

# 전체 구조를 다시 맞추기 위해서 수동으로 넣기
json_output = f'{{\n "songInfo": [\n {song_info}\n ]\n}}'

with open('churahee/data/comment.json', 'w', encoding='utf-8') as f:
    f.write(json_output)
    # json.dump(songInfo, f, indent=2, ensure_ascii=False)
    