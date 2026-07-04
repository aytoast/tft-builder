import json
import sys
import os

def load_json(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(filepath, data):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def main():
    data_file = sys.argv[1] if len(sys.argv) > 1 else 'tft-web/public/data.json'
    weights_file = sys.argv[2] if len(sys.argv) > 2 else 'scoring_weights.json'
    output_file = sys.argv[3] if len(sys.argv) > 3 else data_file
    
    print(f"Loading datasets from {data_file} and {weights_file}...")
    weights = load_json(weights_file)
    app_data = load_json(data_file)
    
    # Identify set from app_data or fallback
    current_set = str(app_data.get('set', '8'))
    if current_set == '8':
        cdragon = load_json('tft_cdragon.json')
    else:
        cdragon = load_json('tft_latest.json')
        
    set_data = cdragon['sets'].get(current_set, list(cdragon['sets'].values())[-1])
    
    # Extract champion stats from CDragon and build champDict
    champ_stats = {}
    champ_dict = {}
    for c in set_data['champions']:
        name = c['name']
        cost = c.get('cost', 1)
        api_name = c.get('apiName', '') or ''
        tile_icon = c.get('tileIcon')
        if tile_icon:
            icon_path = tile_icon.lower().replace('.tex', '.png')
            img_url = f"https://raw.communitydragon.org/latest/game/{icon_path}"
        else:
            img_url = f"https://cdn.metatft.com/file/metatft/champions/{api_name.lower()}.png"
        
        champ_dict[name] = {
            'cost': cost,
            'apiName': api_name,
            'imgUrl': img_url
        }
        
        stats = c.get('stats', {})
        if name and stats:
            champ_stats[name] = stats
            
    print(f"Loaded stats for {len(champ_stats)} champions.")
    
    # Scoring configuration
    ehp_base = weights['stat_weights']['ehp_baseline']
    dps_base = weights['stat_weights']['dps_baseline']
    armor_factor = weights['stat_weights']['armor_mitigation_factor']
    mr_factor = weights['stat_weights']['mr_mitigation_factor']
    cost4_mult = weights['stat_weights'].get('carry_cost_multiplier_4', 1.2)
    cost5_mult = weights['stat_weights'].get('carry_cost_multiplier_5', 2.0)
    
    trait_mults = weights['trait_multipliers']
    synergy = weights['synergy_bonus']
    
    print("Calculating advanced power scores...")
    scores = []
    
    # First pass: calculate scores
    for comp in app_data.get('combinations', []):
        team_ehp = 0
        team_dps = 0
        
        # 1. Base Stats Contribution
        for c_name in comp['champions']:
            stats = champ_stats.get(c_name)
            if not stats:
                continue # Skip if stats missing
            
            hp = stats.get('hp') or 500.0
            armor = stats.get('armor') or 20.0
            mr = stats.get('magicResist') or 20.0
            ad = stats.get('damage') or 40.0
            ats = stats.get('attackSpeed') or 0.6
            
            # Apply cost-based multipliers directly to individual champion DPS/EHP to simulate star scaling
            c_cost = champ_dict.get(c_name, {}).get('cost', 1)
            c_mult = 1.0
            if c_cost == 5:
                c_mult = cost5_mult
            elif c_cost == 4:
                c_mult = cost4_mult
                
            ehp = (hp * (1 + armor/armor_factor) * 0.5 + hp * (1 + mr/mr_factor) * 0.5) * c_mult
            dps = (ad * ats) * c_mult
            
            team_ehp += ehp
            team_dps += dps
            
        # 2. Trait Multipliers
        ehp_multiplier = 1.0
        dps_multiplier = 1.0
        
        frontline_count = 0
        backline_count = 0
        
        for t in comp['traits']:
            t_name = t['name']
            if t_name in trait_mults:
                ehp_multiplier *= trait_mults[t_name].get('ehp_mult', 1.0)
                dps_multiplier *= trait_mults[t_name].get('dps_mult', 1.0)
                
            if t_name in ['斗士', '护卫', '秘术卫士', '战斗机甲', '吉祥物']:
                frontline_count += 1
            if t_name in ['强袭枪手', '灵能使', '情报特工', '决斗大师', '枪神', '气象主播']:
                backline_count += 1
                
        # 3. Synergy Balance
        balance_mult = 1.0
        if frontline_count > 0 and backline_count > 0:
            balance_mult = synergy['balanced_team_mult']
        elif frontline_count > 0 or backline_count > 0:
            balance_mult = synergy['unbalanced_team_mult']
            
        # 4. Leftover Penalty
        leftovers = comp.get('leftovers', 0)
        penalty_mult = max(0.5, 1.0 - (leftovers * (synergy['dead_trait_penalty']/100.0)))
        
        # 5. Final Calculation
        modified_ehp = team_ehp * ehp_multiplier
        modified_dps = team_dps * dps_multiplier
        
        # Scale to a readable score
        raw_score = (modified_ehp / ehp_base) * (modified_dps / dps_base) * balance_mult * penalty_mult * 100
        comp['powerScore'] = round(raw_score, 2)
        scores.append(raw_score)

    # 6. Assign Tiers
    scores.sort(reverse=True)
    total = len(scores)
    
    # Add champDict to output
    app_data['champDict'] = champ_dict
    
    # Assign tiers
    s_thresh = scores[int(total * 0.1)] if total > 0 else 0
    a_thresh = scores[int(total * 0.35)] if total > 0 else 0
    b_thresh = scores[int(total * 0.70)] if total > 0 else 0
    
    for comp in app_data['combinations']:
        sc = comp.get('powerScore', 0)
        if sc >= s_thresh: comp['tier'] = 'S'
        elif sc >= a_thresh: comp['tier'] = 'A'
        elif sc >= b_thresh: comp['tier'] = 'B'
        else: comp['tier'] = 'C'
        
    print(f"Scores calculated and tiers assigned. Saving to {output_file}...")
    save_json(output_file, app_data)
    print("Done!")

if __name__ == '__main__':
    main()
