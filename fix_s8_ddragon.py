import json

with open('data/raw/tft_cdragon.json', encoding='utf-8') as f:
    d = json.load(f)
    champs = d.get('sets', {}).get('8', {}).get('champions', [])
    mapping = {}
    for c in champs:
        apiName = c.get('apiName', '')
        if apiName.startswith('TFT8_'):
            champ_id = apiName.split('_')[1]
            if champ_id == 'WuKong': champ_id = 'MonkeyKing'
            if champ_id == 'VelKoz': champ_id = 'Velkoz'
            if champ_id == 'ChoGath': champ_id = 'Chogath'
            if champ_id == 'LeBlanc': champ_id = 'Leblanc'
            if champ_id == 'KhaZix': champ_id = 'Khazix'
            if champ_id == 'Nunu': champ_id = 'Nunu'
            if champ_id == 'AurelionSol': champ_id = 'AurelionSol'
            if champ_id == 'BelVeth': champ_id = 'Belveth'
            mapping[c['name']] = champ_id

with open('tft-web/public/data_s8.json', 'r', encoding='utf-8') as f2:
    s8_data = json.load(f2)

for champ, data in s8_data['champDict'].items():
    if champ in mapping:
        champ_id = mapping[champ]
        data['imgUrl'] = f'https://ddragon.leagueoflegends.com/cdn/13.5.1/img/champion/{champ_id}.png'
    elif champ == '努努和威朗普':
        data['imgUrl'] = 'https://ddragon.leagueoflegends.com/cdn/13.5.1/img/champion/Nunu.png'

with open('tft-web/public/data_s8.json', 'w', encoding='utf-8') as f3:
    json.dump(s8_data, f3, ensure_ascii=False)
