import json
import random

def get_trait_status(tc, traits_dict, board_size):
    unfixable = []
    fixable = []
    needed_emblems = []
    
    for t, count in tc.items():
        bps = traits_dict.get(t, {}).get('breakpoints', [2])
        if count in bps:
            continue
            
        next_bp = next((b for b in bps if b > count), None)
        if max(bps) == 1:
            # Unique traits cannot have emblems
            unfixable.append(t)
            continue
            
        if next_bp:
            fixable.append(t)
            deficit_amount = next_bp - count
            # Can we equip this many emblems?
            if count + deficit_amount - 1 < board_size:
                needed_emblems.extend([t] * deficit_amount)
            else:
                unfixable.append(t)
        else:
            unfixable.append(t)
            
    return unfixable, fixable, needed_emblems

def get_max_cost(pop):
    if pop <= 1: return 1
    if pop <= 3: return 2
    if pop == 4: return 3
    if pop <= 6: return 4
    return 5

def run():
    with open('tft_s17_base.json', 'r', encoding='utf-8') as f:
        base = json.load(f)
        
    champions = base['champions']
    traits_dict = base['traits']
    
    trait_to_champs = {}
    for c, d in champions.items():
        for t in d['traits']:
            trait_to_champs.setdefault(t, []).append(c)

    perfect_comps_by_pop = {i: set() for i in range(4, 11)}
    combinations = []
    
    all_champs = list(champions.keys())
    
    for pop in range(4, 11):
        if pop <= 3:
            valid_seeds = [c for c, d in champions.items() if d['cost'] <= 3]
        elif pop <= 6:
            valid_seeds = [c for c, d in champions.items() if d['cost'] <= 4]
        else:
            valid_seeds = all_champs
            
        if not valid_seeds:
            valid_seeds = all_champs
            
        seeds = valid_seeds * (50000 // len(valid_seeds) + 1)
        random.shuffle(seeds)
        
        if pop >= 9:
            seeds = [['格雷福斯', '烬', '莫德凯撒']] * 50 + seeds
            
        missing_seeds = set(valid_seeds)
        
        for i in range(60000):
            if i < len(seeds):
                seed_val = seeds[i]
                if isinstance(seed_val, list):
                    board = set(seed_val)
                else:
                    board = set([seed_val])
            else:
                if missing_seeds:
                    board = set([random.choice(list(missing_seeds))])
                else:
                    board = set([random.choice(valid_seeds)])
                
            if len(board) > pop:
                continue 
                
            while len(board) < pop:
                tc = {}
                for c in board:
                    for t in champions[c]['traits']:
                        tc[t] = tc.get(t, 0) + 1
                        
                unfixable, fixable, needed_emblems = get_trait_status(tc, traits_dict, len(board))
                candidates = set()
                
                if fixable:
                    t = random.choice(fixable)
                    candidates.update(trait_to_champs.get(t, []))
                else:
                    active_perfect = [t for t, count in tc.items() if count in traits_dict.get(t, {}).get('breakpoints', [2])]
                    if active_perfect:
                        random.shuffle(active_perfect)
                        for t in active_perfect:
                            potentials = set(trait_to_champs.get(t, [])) - board
                            if potentials:
                                candidates.update(potentials)
                                break
                    if not candidates:
                        candidates.update(champions.keys())
                        
                candidates = candidates - board
                
                # Apply cost-gating constraints
                max_cost = get_max_cost(pop)
                valid_candidates = {c for c in candidates if champions[c]['cost'] <= max_cost}
                
                if not valid_candidates: 
                    break
                
                scored_cands = []
                for cand in valid_candidates:
                    cand_traits = champions[cand]['traits']
                    score = 0
                    for t in cand_traits:
                        if t in fixable:
                            score += 10
                        elif tc.get(t, 0) in traits_dict.get(t, {}).get('breakpoints', [2]):
                            score += 5
                        else:
                            bps = traits_dict.get(t, {}).get('breakpoints', [2])
                            if 1 in bps:
                                score += 8
                            else:
                                score -= 8
                                
                    if pop <= 5:
                        score += (6 - champions[cand]['cost']) * 0.1
                    else:
                        score += champions[cand]['cost'] * 0.1
                        
                    scored_cands.append((score, cand))
                
                scored_cands.sort(reverse=True, key=lambda x: x[0])
                pool = scored_cands[:15]
                
                import math
                max_score = pool[0][0]
                temp = 4.0
                weights = [math.exp((s - max_score) / temp) for s, _ in pool]
                cands = [c for _, c in pool]
                
                chosen = random.choices(cands, weights=weights, k=1)[0]
                board.add(chosen)
                
            if len(board) == pop:
                tc = {}
                for c in board:
                    for t in champions[c]['traits']: tc[t] = tc.get(t, 0) + 1
                    
                unfixable, _, needed_emblems = get_trait_status(tc, traits_dict, pop)
                
                emblems_used = []
                is_perfect = False
                
                # Check if the board is perfect
                if len(unfixable) == 0 and len(needed_emblems) <= 3:
                    is_perfect = True
                    emblems_used.extend(needed_emblems)
                    
                if is_perfect:
                    comp_tuple = tuple(sorted(list(board)))
                    if comp_tuple not in perfect_comps_by_pop[pop]:
                        perfect_comps_by_pop[pop].add(comp_tuple)
                        
                        for c in comp_tuple:
                            if c in missing_seeds:
                                missing_seeds.remove(c)
                                
                        final_traits = []
                        for t, count in tc.items():
                            if t in emblems_used:
                                count += emblems_used.count(t)
                            final_traits.append({"name": t, "level": count})
                            
                        total_cost = sum(champions[c]['cost'] for c in comp_tuple)
                        
                        combinations.append({
                            "champions": list(comp_tuple),
                            "traits": final_traits,
                            "cost": total_cost,
                            "deficits": emblems_used,
                            "population": pop
                        })
                        
            if len(perfect_comps_by_pop[pop]) >= 40 and not missing_seeds:
                break

    used_traits = set()
    used_champs = set()
    for comp in combinations:
        used_champs.update(comp['champions'])
        used_traits.update(t['name'] for t in comp['traits'])

    out = {
        "set": "17",
        "champions": sorted(list(used_champs)),
        "traits": sorted(list(used_traits)),
        "champDict": champions,
        "combinations": combinations
    }
    
    with open('tft-web/public/data_s17.json', 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

if __name__ == '__main__':
    run()
