import json

def run():
    with open('tft_latest.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Latest set
    s = str(max(int(k) for k in data['sets'].keys() if k.isdigit()))
    set_data = data['sets'][s]
    
    champions = {}
    blacklist = {'魔像', '峡谷迅捷蟹', '训练假人', '超级机甲', '小木灵', '海魔至尊', '迷你黑洞'}
    
    for champ in set_data['champions']:
        # Filter out weird non-purchasable units, usually cost 0 or 11
        if champ.get('cost') in [1, 2, 3, 4, 5] and champ['name'] not in blacklist:
            icon_path = champ.get('tileIcon', '').lower().replace('.tex', '.png')
            # Some paths start with ASSETS/..., cdragon maps them inside game/
            img_url = f"https://raw.communitydragon.org/latest/game/{icon_path}"
            champions[champ['name']] = {
                'cost': champ['cost'],
                'apiName': champ['apiName'],
                'imgUrl': img_url,
                'traits': champ.get('traits', [])
            }
            
    traits = {}
    for trait in set_data['traits']:
        effects = trait.get('effects', [])
        bps = sorted([e['minUnits'] for e in effects if 'minUnits' in e])
        if not bps:
            bps = [2] # Fallback if no effects defined, though rare
            
        traits[trait['name']] = {
            'apiName': trait['apiName'],
            'breakpoints': bps
        }
        
    out = {
        'set': s,
        'champions': champions,
        'traits': traits
    }
    
    with open('tft_s17_base.json', 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        
    print(f"Extracted Set {s}: {len(champions)} champions, {len(traits)} traits.")

if __name__ == '__main__':
    run()
