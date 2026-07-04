import json
import itertools

# 1. Parse tft_data.txt
with open('tft_data.txt', 'r', encoding='utf-8') as f:
    lines = f.read().splitlines()

trait_thresholds = {}
champions = {}

mode = None
for line in lines:
    line = line.strip()
    if not line:
        continue
    if line == '羁绊':
        mode = 'trait'
        continue
    elif line == '奕子':
        mode = 'champ'
        continue
        
    if mode == 'trait':
        parts = line.split(' ')
        name = parts[0]
        if len(parts) > 1:
            thresholds = [int(x) for x in parts[1].split('/')]
            trait_thresholds[name] = thresholds
    elif mode == 'champ':
        parts = line.split(' ')
        name = parts[0]
        traits = parts[1].split('/')
        champions[name] = traits

costs = {
  5: ['亚托克斯', '努努和威朗普', '辛德拉', '迦娜', '蕾欧娜', '莫德凯撒', '费德提克', '厄加特', '厄斐琉斯'],
  4: ['塔莉垭', '佛耶戈', '奥瑞利安·索尔', '卑尔维斯', '厄运小姐', '莎弥拉', '瑟提', '扎克', '劫', '索拉卡', '瑟庄妮', '艾克'],
  3: ['阿利斯塔', '科加斯', '贾克斯', '卡莎', '乐芙兰', '尼菈', '拉莫斯', '锐雯', '赛娜', '娑娜', '薇恩', '维克兹', '佐伊'],
  2: ['安妮', '卡蜜尔', '德莱文', '伊泽瑞尔', '菲奥娜', '金克丝', '李青', '墨菲特', '芮尔', '希维尔', '蔚', '亚索', '悠米'],
  1: ['艾希', '布里茨', '加里奥', '普朗克', '凯尔', '璐璐', '拉克丝', '内瑟斯', '波比', '雷克顿', '塞拉斯', '泰隆', '孙悟空']
}

def get_cost(champ):
    for c, lst in costs.items():
        if champ in lst:
            return c
    return 1

# Only cost <= 3, non-monster
pool = {c: t for c, t in champions.items() if ('怪兽' not in t or c == '厄加特') and get_cost(c) <= 3}
champ_names = list(pool.keys())
print(f"Cost <= 3 pool size: {len(champ_names)}")

supers = ['普朗克', '李青', '墨菲特']
available_others = [c for c in champ_names if c not in supers]

results = []

# Search sizes 6, 7, 8
for target_size in [6, 7, 8]:
    for subset in itertools.combinations(available_others, target_size - 3):
        combo = supers + list(subset)
        total_cost = sum(get_cost(c) for c in combo)
        
        active_traits = []
        leftover_count = 0
        
        for trait, thresholds in trait_thresholds.items():
            if trait in ['怪兽', '气象主播', '枪神', '堕落使者', '精英战士']:
                continue
            count = sum(1 for c in combo if trait in pool.get(c, []))
            if count == 0:
                continue
                
            level = 0
            for th in thresholds:
                if count >= th:
                    level = th
            if level > 0:
                active_traits.append({"name": trait, "level": level})
            else:
                leftover_count += count
                
        # Must have at least 3 active traits (Supers + 2 others)
        if len(active_traits) >= 3:
            results.append({
                "champions": combo,
                "traits": active_traits,
                "cost": total_cost,
                "leftovers": leftover_count,
                "size": target_size
            })

# Sort by: Most traits -> Least leftovers -> Smallest size -> Lowest cost
results.sort(key=lambda x: (-len(x['traits']), x['leftovers'], x['size'], x['cost']))

top_results = results[:50]
print(f"Found {len(top_results)} optimal super comps!")

# Load existing data.json
with open('tft-web/public/data.json', 'r', encoding='utf-8') as f:
    web_data = json.load(f)

# To ensure we don't duplicate or pollute, let's just keep combinations of size 9 (the original ones)
# and add our new super combinations.
original_9_unit = [c for c in web_data['combinations'] if len(c['champions']) == 9]

# Clear out any previous Super combinations added from the last script run
web_data['combinations'] = original_9_unit

existing_combos = set(','.join(sorted(c['champions'])) for c in web_data['combinations'])

added = 0
for r in top_results:
    key = ','.join(sorted(r['champions']))
    if key not in existing_combos:
        web_data['combinations'].append({
            "champions": r["champions"],
            "traits": r["traits"],
            "cost": r["cost"]
        })
        added += 1

with open('tft-web/public/data.json', 'w', encoding='utf-8') as f:
    json.dump(web_data, f, ensure_ascii=False, indent=2)

print(f"Added {added} new Super comps to data.json")
