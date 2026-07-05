// Builder Tab Logic

const SHOP_ODDS = {
  1: [100, 0, 0, 0, 0],
  2: [100, 0, 0, 0, 0],
  3: [75, 25, 0, 0, 0],
  4: [55, 30, 15, 0, 0],
  5: [45, 33, 20, 2, 0],
  6: [25, 40, 30, 5, 0],
  7: [19, 30, 40, 10, 1],
  8: [18, 25, 32, 22, 3],
  9: [10, 20, 25, 35, 10],
  10: [5, 10, 20, 40, 25]
};

let builderBoard = [];
let builderLevel = 8;
const MAX_SLOTS = 10;

function initBuilder() {
    renderBuilderSlots();
    
    document.getElementById('builder-level').addEventListener('input', (e) => {
        builderLevel = parseInt(e.target.value);
        document.getElementById('builder-level-display').textContent = builderLevel;
        updateBuilderCalculations();
    });

    const searchInput = document.getElementById('builder-champ-search');
    const searchResults = document.getElementById('builder-search-results');

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        if (!term) {
            searchResults.style.display = 'none';
            return;
        }
        
        // Filter champions
        if (!window.allData || !window.allData.champions) return;
        const matches = window.allData.champions.filter(c => c.toLowerCase().includes(term));
        
        searchResults.innerHTML = '';
        if (matches.length > 0) {
            matches.forEach(c => {
                const div = document.createElement('div');
                div.className = 'search-result-item';
                const imgUrl = window.allData.champDict[c].imgUrl || '/placeholder.png';
                div.innerHTML = `<img src="${imgUrl}" onerror="this.src='/placeholder.png'"><span>${c}</span>`;
                div.addEventListener('click', () => {
                    addChampionToBoard(c);
                    searchInput.value = '';
                    searchResults.style.display = 'none';
                });
                searchResults.appendChild(div);
            });
            searchResults.style.display = 'block';
        } else {
            searchResults.style.display = 'none';
        }
    });
    
    // Close search results on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.builder-search')) {
            searchResults.style.display = 'none';
        }
    });
}

function addChampionToBoard(champ) {
    if (builderBoard.length < MAX_SLOTS && !builderBoard.includes(champ)) {
        builderBoard.push(champ);
        renderBuilderSlots();
        updateBuilderCalculations();
    }
}

function removeChampionFromBoard(index) {
    builderBoard.splice(index, 1);
    renderBuilderSlots();
    updateBuilderCalculations();
}

function renderBuilderSlots() {
    const container = document.getElementById('builder-slots');
    container.innerHTML = '';
    
    for (let i = 0; i < MAX_SLOTS; i++) {
        const slot = document.createElement('div');
        slot.className = 'builder-slot';
        
        if (i < builderBoard.length) {
            const champ = builderBoard[i];
            slot.classList.add('filled');
            const imgUrl = window.allData.champDict[champ].imgUrl || '/placeholder.png';
            slot.innerHTML = `
                <img src="${imgUrl}" onerror="this.src='/placeholder.png'" title="${champ}">
                <div class="remove-slot" onclick="removeChampionFromBoard(${i})">×</div>
            `;
        } else {
            slot.innerHTML = '<span style="color:rgba(255,255,255,0.2); font-size: 24px;">+</span>';
        }
        container.appendChild(slot);
    }
}

function updateBuilderCalculations() {
    if (!window.allData || !window.allData.combinations) return;
    if (builderBoard.length === 0) {
        document.getElementById('closest-comps-list').innerHTML = '<div class="empty-state">添加奕子以计算最贴合阵容...</div>';
        document.getElementById('shop-recommendations-list').innerHTML = '<div class="empty-state">添加奕子以计算抓牌推荐...</div>';
        return;
    }

    // 1. Calculate Closest Comps
    const boardSet = new Set(builderBoard);
    let compScores = [];
    
    window.allData.combinations.forEach(comp => {
        const compChamps = new Set(comp.champions);
        let intersection = 0;
        compChamps.forEach(c => {
            if (boardSet.has(c)) intersection++;
        });
        
        const union = new Set([...builderBoard, ...comp.champions]).size;
        const jaccard = intersection / union;
        
        // Boost if population aligns closely with level
        const popDiff = Math.abs((comp.population || comp.champions.length) - builderLevel);
        const levelScore = Math.max(0, 1 - (popDiff * 0.1));
        
        const finalScore = jaccard * levelScore;
        if (finalScore > 0) {
            compScores.push({ comp, score: finalScore, intersection, total: comp.champions.length });
        }
    });
    
    compScores.sort((a, b) => b.score - a.score);
    const topComps = compScores.slice(0, 5);
    
    renderClosestComps(topComps);
    
    // 2. Calculate EVS for Shop Recommendations
    calculateAndRenderEVS(topComps, boardSet);
}

function renderClosestComps(topComps) {
    const container = document.getElementById('closest-comps-list');
    container.innerHTML = '';
    
    if (topComps.length === 0) {
        container.innerHTML = '<div class="empty-state">没有找到匹配的阵容</div>';
        return;
    }
    
    topComps.forEach(item => {
        const card = document.createElement('div');
        card.className = 'comp-match-card';
        
        const traitNames = item.comp.traits.map(t => `${t.name}`).join(', ');
        const missing = item.comp.champions.filter(c => !builderBoard.includes(c));
        
        card.innerHTML = `
            <div class="comp-match-header">
                <strong>${window.generateComboName ? window.generateComboName(item.comp) : '组合'}</strong>
                <span class="match-score">贴合度: ${(item.score * 100).toFixed(0)}%</span>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 5px;">进度: ${item.intersection} / ${item.total}</div>
            <div style="font-size: 12px;">缺少: ${missing.join(', ')}</div>
        `;
        container.appendChild(card);
    });
}

function calculateAndRenderEVS(topComps, boardSet) {
    const container = document.getElementById('shop-recommendations-list');
    container.innerHTML = '';
    
    const champDict = window.allData.champDict;
    if (!champDict) return;
    
    const odds = SHOP_ODDS[builderLevel] || SHOP_ODDS[10];
    
    let candidateScores = {};
    
    // Evaluate champions missing from top comps
    topComps.forEach((item, index) => {
        const compWeight = 1 / (index + 1); // #1 comp = 1, #2 = 0.5, etc.
        const missing = item.comp.champions.filter(c => !boardSet.has(c));
        
        missing.forEach(champ => {
            if (!candidateScores[champ]) {
                candidateScores[champ] = { score: 0, comps: [] };
            }
            candidateScores[champ].score += compWeight * 10;
            candidateScores[champ].comps.push(index + 1);
        });
    });
    
    // Apply Scarcity Multiplier
    let evsArray = [];
    for (const [champ, data] of Object.entries(candidateScores)) {
        const cost = champDict[champ] ? champDict[champ].cost : 1;
        const prob = odds[cost - 1]; // 0-indexed for 1-cost
        
        // If prob is 0, EVS is effectively 0 because you can't roll it (requires leveling)
        if (prob <= 0) continue;
        
        // Scarcity multiplier: lower probability -> higher urgency EVS
        const scarcity = 100 / prob; 
        const finalEvs = data.score * scarcity;
        
        evsArray.push({ champ, evs: finalEvs, cost, prob, comps: data.comps });
    }
    
    evsArray.sort((a, b) => b.evs - a.evs);
    const topRecs = evsArray.slice(0, 5);
    
    if (topRecs.length === 0) {
        container.innerHTML = '<div class="empty-state">当前等级刷不到所需卡牌，建议升级！</div>';
        return;
    }
    
    topRecs.forEach(rec => {
        const card = document.createElement('div');
        card.className = 'evs-card';
        const imgUrl = window.allData.champDict[rec.champ].imgUrl || '/placeholder.png';
        
        card.innerHTML = `
            <img src="${imgUrl}" onerror="this.src='/placeholder.png'">
            <div class="evs-info">
                <span class="evs-name" style="color: var(--cost-${rec.cost})">${rec.champ} (${rec.cost}费)</span>
                <span class="evs-reason">用于最贴合阵容 #${rec.comps[0]} | 刷新率: ${rec.prob}%</span>
            </div>
            <div class="evs-score">${rec.evs.toFixed(0)} 分</div>
        `;
        container.appendChild(card);
    });
}

// Hook into loadData complete event, or just expose a refresh method
window.refreshBuilder = function() {
    updateBuilderCalculations();
};

document.addEventListener('DOMContentLoaded', initBuilder);
