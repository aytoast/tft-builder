import json

with open('data/raw/tft_cdragon.json', encoding='utf-8') as f:
    d = json.load(f)
    champs = d.get('sets', {}).get('8', {}).get('champions', [])
    mapping = {c['name']: c['apiName'].lower() for c in champs}

with open('tft-web/public/data_s8.json', 'r', encoding='utf-8') as f2:
    s8_data = json.load(f2)

for champ, data in s8_data['champDict'].items():
    if champ in mapping:
        apiname = mapping[champ]
        data['imgUrl'] = f'https://raw.communitydragon.org/latest/game/assets/characters/{apiname}/hud/{apiname}_square.tft_set8.png'

with open('tft-web/public/data_s8.json', 'w', encoding='utf-8') as f3:
    json.dump(s8_data, f3, ensure_ascii=False)
