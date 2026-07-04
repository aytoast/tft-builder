let allData = null;
let selectedTraits = new Set();
let selectedChamps = new Set();
let excludedChamps = new Set();
let selectedEmblems = {}; // New tracking for Emblems
let currentSort = 'cost-desc';
let starredCombos = new Set(JSON.parse(localStorage.getItem('tft-stars') || '[]'));
let showStarredOnly = false;
let currentSeason = '8';
let currentPopFilter = 'all';
let seasonDataCache = {};

// Pagination state
let currentRenderIndex = 0;
let currentRenderList = [];
let renderObserver = null;
let currentGridNode = null;
let currentTotalIdx = 0;

function getChampCost(champName) {
  if (allData && allData.champDict && allData.champDict[champName]) {
    return allData.champDict[champName].cost || 1;
  }
  return 1;
}

// Sidebar Resizing Logic
document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.querySelector('.sidebar');
  let isResizing = false;

  sidebar.addEventListener('mousedown', (e) => {
    // Check if clicking near the right edge
    if (e.offsetX > sidebar.offsetWidth - 10) {
      isResizing = true;
      document.body.style.cursor = 'col-resize';
      sidebar.style.userSelect = 'none'; // Prevent text selection
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const newWidth = e.clientX;
    if (newWidth >= 250 && newWidth <= 600) {
      sidebar.style.width = newWidth + 'px';
      sidebar.style.flex = `0 0 ${newWidth}px`;
    }
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = '';
      sidebar.style.userSelect = '';
    }
  });
});

function generateComboName(comp) {
  let sortedTraits = [...comp.traits].sort((a, b) => b.level - a.level);
  let topTrait = sortedTraits[0] ? sortedTraits[0].name : '';
  let secondTrait = sortedTraits[1] ? sortedTraits[1].name : '';

  let fiveCount = comp.champions.filter(c => getChampCost(c) === 5).length;
  let fourCount = comp.champions.filter(c => getChampCost(c) === 4).length;
  let maxCost = Math.max(...comp.champions.map(c => getChampCost(c)));
  
  let name = '';
  if (sortedTraits.length > 0 && sortedTraits[0].level >= 6) {
    name = topTrait; 
    if (secondTrait) name += '·' + secondTrait;
  } else if (maxCost <= 3) {
    name = `赌狗${topTrait}`;
  } else if (fiveCount >= 3) {
    name = `${topTrait}九五`;
  } else if (fourCount >= 3) {
    name = `${topTrait}拼多多`;
  } else {
    name = `${topTrait}·${secondTrait}`;
  }
  
  if (!name || name === '·') name = '混合阵容';
  
  return name;
}

async function loadData(season) {
  try {
    currentSeason = season;
    document.getElementById('result-count').textContent = "正在加载阵容...";
    
    const maxPop = season == 8 ? 9 : 10;
    document.getElementById('main-title').textContent = `最高${maxPop}人口成型阵容库 (Set ${season})`;

    // Hide or show population buttons based on maxPop
    document.querySelectorAll('.pop-btn').forEach(btn => {
      const popVal = parseInt(btn.dataset.pop);
      if (!isNaN(popVal)) {
        btn.style.display = popVal > maxPop ? 'none' : 'inline-block';
      }
    });

    if (seasonDataCache[season]) {
      allData = seasonDataCache[season];
    } else {
      const res = await fetch(`/data_s${season}.json?v=` + Date.now());
      allData = await res.json();
      seasonDataCache[season] = allData;
    }
    
    // Clear filters
    selectedTraits.clear();
    selectedChamps.clear();
    excludedChamps.clear();
    selectedEmblems = {};
    const searchInputs = document.querySelectorAll('.search-input');
    searchInputs.forEach(input => input.value = '');
    
    // Reset population filter
    currentPopFilter = 'all';
    document.querySelectorAll('.pop-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.pop === 'all');
    });
    
    // Clear DOM containers
    document.getElementById('trait-filters').innerHTML = '';
    document.getElementById('champ-filters').innerHTML = '';
    document.getElementById('emblem-filters').innerHTML = '';

    // Extract unique emblems used across all combinations
    let uniqueEmblems = new Set();
    allData.combinations.forEach(c => {
      if (c.deficits) {
        c.deficits.forEach(e => uniqueEmblems.add(e));
      }
    });

    // Render Emblem filters as Counters
    let emblemsArray = Array.from(uniqueEmblems).sort();
    emblemsArray.forEach(emb => {
      const wrapper = document.createElement('div');
      wrapper.className = 'emblem-counter';
      
      const label = document.createElement('span');
      label.textContent = emb;
      
      const controls = document.createElement('div');
      controls.className = 'counter-controls';
      
      const btnMinus = document.createElement('button');
      btnMinus.textContent = '-';
      
      const countSpan = document.createElement('span');
      countSpan.textContent = selectedEmblems[emb] || 0;
      
      const btnPlus = document.createElement('button');
      btnPlus.textContent = '+';
      
      btnMinus.addEventListener('click', () => {
          let current = selectedEmblems[emb] || 0;
          if (current > 0) {
              selectedEmblems[emb] = current - 1;
              if (selectedEmblems[emb] === 0) delete selectedEmblems[emb];
              countSpan.textContent = selectedEmblems[emb] || 0;
              renderFilters();
              renderCombinations();
          }
      });
      
      btnPlus.addEventListener('click', () => {
          selectedEmblems[emb] = (selectedEmblems[emb] || 0) + 1;
          countSpan.textContent = selectedEmblems[emb];
          renderFilters();
          renderCombinations();
      });
      
      controls.appendChild(btnMinus);
      controls.appendChild(countSpan);
      controls.appendChild(btnPlus);
      
      wrapper.appendChild(label);
      wrapper.appendChild(controls);
      
      document.getElementById('emblem-filters').appendChild(wrapper);
    });
    
    renderFilters();
    renderCombinations();
    
    // Event listener for Population Filter
    document.querySelectorAll('.pop-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.pop-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentPopFilter = e.target.dataset.pop;
        renderCombinations();
      });
    });

  } catch (err) {
    console.error("Failed to load data", err);
    document.getElementById('result-count').textContent = "数据加载失败";
  }
}

async function init() {
  setupSearch();
  setupControls();
  
  const sentinel = document.getElementById('load-more-sentinel');
  if (sentinel) {
    renderObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && currentRenderIndex < currentRenderList.length) {
         renderNextBatch(30);
      }
    }, { rootMargin: '400px' });
    renderObserver.observe(sentinel);
  }
  
  // Tab listeners
  const tabs = document.querySelectorAll('.season-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      tabs.forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      const season = e.target.dataset.season;
      loadData(season);
    });
  });
  
  await loadData('8');
}

function setupSearch() {
  const traitSearch = document.getElementById('trait-search');
  traitSearch.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const labels = document.querySelectorAll('#trait-filters .checkbox-label');
    labels.forEach(lbl => {
      lbl.style.display = lbl.textContent.toLowerCase().includes(term) ? 'flex' : 'none';
    });
  });

  const champSearch = document.getElementById('champ-search');
  champSearch.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const labels = document.querySelectorAll('#champ-filters .champ-filter-item');
    labels.forEach(lbl => {
      lbl.style.display = lbl.textContent.toLowerCase().includes(term) ? 'flex' : 'none';
    });
  });
}

function setupControls() {
  document.getElementById('sort-select').addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderCombinations();
  });

  document.getElementById('toggle-starred').addEventListener('click', (e) => {
    showStarredOnly = !showStarredOnly;
    e.currentTarget.classList.toggle('active', showStarredOnly);
    renderCombinations();
  });

  document.getElementById('clear-filters').addEventListener('click', () => {
    selectedTraits.clear();
    selectedChamps.clear();
    excludedChamps.clear();
    selectedEmblems = {};
    document.querySelectorAll('#trait-filters input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('#champ-filters input[type="checkbox"]').forEach(cb => cb.checked = false);
    const counterSpans = document.querySelectorAll('.emblem-counter .counter-controls span');
    counterSpans.forEach(span => span.textContent = '0');
    
    document.getElementById('trait-search').value = '';
    renderFilters();
    renderCombinations();
  });
}

function renderFilters() {
  const traitContainer = document.getElementById('trait-filters');
  traitContainer.innerHTML = '';
  allData.traits.forEach(trait => {
    const label = document.createElement('label');
    label.className = 'checkbox-label';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = trait;
    cb.checked = selectedTraits.has(trait);
    cb.addEventListener('change', (e) => {
      if (e.target.checked) selectedTraits.add(trait);
      else selectedTraits.delete(trait);
      renderCombinations();
      updateActiveFiltersUI();
    });
    label.appendChild(cb);
    label.appendChild(document.createTextNode(trait));
    traitContainer.appendChild(label);
  });

  const champContainer = document.getElementById('champ-filters');
  champContainer.innerHTML = '';
  allData.champions.forEach(champ => {
    const label = document.createElement('div');
    label.className = 'champ-filter-item';
    let state = selectedChamps.has(champ) ? 'inc' : (excludedChamps.has(champ) ? 'exc' : 'none');
    label.dataset.state = state;
    
    const text = document.createElement('span');
    text.className = 'champ-name';
    text.textContent = champ;

    const actions = document.createElement('div');
    actions.className = 'champ-actions';

    const btnInc = document.createElement('button');
    btnInc.className = 'champ-btn btn-inc';
    btnInc.textContent = '✓';
    if(state === 'inc') btnInc.classList.add('active');
    
    const btnExc = document.createElement('button');
    btnExc.className = 'champ-btn btn-exc';
    btnExc.textContent = '✗';
    if(state === 'exc') btnExc.classList.add('active');

    btnInc.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state === 'inc') {
            selectedChamps.delete(champ);
            state = 'none';
        } else {
            selectedChamps.add(champ);
            excludedChamps.delete(champ);
            state = 'inc';
        }
        updateUI();
    });

    btnExc.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state === 'exc') {
            excludedChamps.delete(champ);
            state = 'none';
        } else {
            excludedChamps.add(champ);
            selectedChamps.delete(champ);
            state = 'exc';
        }
        updateUI();
    });

    function updateUI() {
        label.dataset.state = state;
        if(state === 'inc') { btnInc.classList.add('active'); btnExc.classList.remove('active'); }
        else if(state === 'exc') { btnExc.classList.add('active'); btnInc.classList.remove('active'); }
        else { btnInc.classList.remove('active'); btnExc.classList.remove('active'); }
        renderCombinations();
        updateActiveFiltersUI();
    }

    actions.appendChild(btnInc);
    actions.appendChild(btnExc);
    label.appendChild(text);
    label.appendChild(actions);

    champContainer.appendChild(label);
  });
}

function updateActiveFiltersUI() {
  const container = document.getElementById('active-filters');
  container.innerHTML = '';
  
  const hasFilters = selectedTraits.size > 0 || selectedChamps.size > 0 || excludedChamps.size > 0 || Object.keys(selectedEmblems).length > 0;
  document.getElementById('clear-filters').style.display = hasFilters ? 'block' : 'none';

  const createChip = (val, type, count = 1) => {
    const chip = document.createElement('div');
    chip.className = 'filter-chip';
    let displayText = type === 'emblem' ? `${count}x ${val}纹章` : val;
    if (type === 'champ_inc') displayText = '包含 ' + val;
    if (type === 'champ_exc') displayText = '排除 ' + val;
    chip.innerHTML = `<span>${displayText}</span><span class="remove">×</span>`;
    chip.addEventListener('click', () => {
      if (type === 'trait') {
        selectedTraits.delete(val);
        document.querySelector(`input[value="${val}"]`).checked = false;
      } else if (type === 'champ_inc') {
        selectedChamps.delete(val);
        renderFilters();
      } else if (type === 'champ_exc') {
        excludedChamps.delete(val);
        renderFilters();
      } else if (type === 'emblem') {
        delete selectedEmblems[val];
        // Re-render emblem counters to reset to 0
        const counterSpans = document.querySelectorAll('.emblem-counter span');
        counterSpans.forEach(span => {
            if (span.textContent === val) {
                span.nextElementSibling.querySelector('span').textContent = '0';
            }
        });
      }
      renderCombinations();
      renderFilters(); // re-render filters to remove chip
    });
    return chip;
  };

  selectedTraits.forEach(t => container.appendChild(createChip(t, 'trait')));
  selectedChamps.forEach(c => container.appendChild(createChip(c, 'champ_inc')));
  excludedChamps.forEach(c => container.appendChild(createChip(c, 'champ_exc')));
  for (let [emb, count] of Object.entries(selectedEmblems)) {
      if (count > 0) {
          container.appendChild(createChip(emb, 'emblem', count));
      }
  }
}

function renderCombinations() {
  updateActiveFiltersUI();

  const mainContainer = document.getElementById('combinations-container');
  mainContainer.innerHTML = '';
  
  if (!allData || !allData.combinations) return;

  let filtered = allData.combinations.filter(comp => {
    const compId = currentSeason + '_' + comp.champions.slice().sort().join(',');
    comp._id = compId;
    if (showStarredOnly && !starredCombos.has(compId)) return false;
    
    // Check population filter
    if (currentPopFilter !== 'all') {
      const popSize = comp.population || comp.champions.length;
      if (popSize !== parseInt(currentPopFilter)) return false;
    }

    const compTraitNames = comp.traits.map(t => t.name);
    for (let t of selectedTraits) {
      if (!compTraitNames.includes(t)) return false;
    }
    for (let c of selectedChamps) {
      if (!comp.champions.includes(c)) return false;
    }
    for (let c of excludedChamps) {
      if (comp.champions.includes(c)) return false;
    }

    const deficits = comp.deficits || [];
    const needed = {};
    deficits.forEach(d => needed[d] = (needed[d] || 0) + 1);
    
    const selectedKeys = Object.keys(selectedEmblems).filter(k => selectedEmblems[k] > 0);
    const neededKeys = Object.keys(needed);
    
    // Must have exactly the same types of emblems
    if (selectedKeys.length !== neededKeys.length) return false;
    
    // Must have exactly the same quantity of each emblem
    for (let emb of neededKeys) {
      if ((selectedEmblems[emb] || 0) !== needed[emb]) return false;
    }

    return true;
  });

  const sortBy = currentSort;
  if (sortBy === 'cost-desc') {
    filtered.sort((a, b) => b.cost - a.cost);
  } else if (sortBy === 'cost-asc') {
    filtered.sort((a, b) => a.cost - b.cost);
  } else if (sortBy === 'population-desc') {
    filtered.sort((a, b) => (b.population || b.champions.length) - (a.population || a.champions.length));
  } else if (sortBy === 'population-asc') {
    filtered.sort((a, b) => (a.population || a.champions.length) - (b.population || b.champions.length));
  }

  document.getElementById('result-count').textContent = `找到 ${filtered.length} 个阵容`;

  if (filtered.length === 0) {
    mainContainer.innerHTML = '<div class="empty-state">没有找到符合条件的阵容，请尝试减少一些筛选条件。</div>';
    return;
  }

  currentRenderList = [];
  currentTotalIdx = 0;

  // Decide if we should group by population
  if (currentSort.includes('population')) {
    const popGroups = {};
    filtered.forEach(comp => {
      const pop = comp.population || comp.champions.length;
      if (!popGroups[pop]) popGroups[pop] = [];
      popGroups[pop].push(comp);
    });

    const sortedPops = Object.keys(popGroups).sort((a, b) => currentSort === 'population-asc' ? a - b : b - a);

    sortedPops.forEach(pop => {
      currentRenderList.push({ type: 'header', pop: pop, count: popGroups[pop].length });
      popGroups[pop].forEach(comp => currentRenderList.push({ type: 'comp', comp: comp }));
    });
  } else {
    // If sorting by cost, don't group by population so high-cost are globally at the top
    const headerPopText = currentPopFilter === 'all' ? '所有' : currentPopFilter;
    currentRenderList.push({ type: 'header', pop: headerPopText, count: filtered.length });
    filtered.forEach(comp => currentRenderList.push({ type: 'comp', comp: comp }));
  }

  currentRenderIndex = 0;
  currentGridNode = null;
  
  // Try to hide the sentinel before rendering
  const sentinel = document.getElementById('load-more-sentinel');
  if (sentinel) sentinel.style.display = 'none';

  renderNextBatch(40);
}

function createCompCard(comp) {
  const card = document.createElement('div');
  card.className = 'combo-card';
  card.style.setProperty('--card-index', Math.min(currentTotalIdx++, 20));
  
  let sortedChamps = [...comp.champions].sort((a, b) => getChampCost(b) - getChampCost(a));

  let champsHTML = sortedChamps.map(c => {
    const imgUrl = (allData.champDict && allData.champDict[c]) ? allData.champDict[c].imgUrl : '';
    const cost = getChampCost(c);
    
    return `
      <div class="champ-badge-img cost-${cost} tooltip" data-tip="${c}">
        <img src="${imgUrl}" alt="${c}" loading="lazy" onload="this.classList.add('loaded')" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 100 100\\'%3E%3Crect width=\\'100\\' height=\\'100\\' fill=\\'%23333\\'/%3E%3Ctext x=\\'50\\' y=\\'55\\' font-family=\\'Arial\\' font-size=\\'20\\' fill=\\'%23888\\' text-anchor=\\'middle\\'%3E?%3C/text%3E%3C/svg%3E'; this.classList.add('loaded')" />
      </div>
    `;
  }).join('');

  let sortedTraits = [...comp.traits].sort((a, b) => b.level - a.level);
  let traitsHTML = sortedTraits.map(t => {
    const isHigh = t.level >= 3 ? 'trait-high' : '';
    return `<span class="trait-badge ${isHigh}">${t.name} ${t.level}</span>`;
  }).join('');

  const isStarred = starredCombos.has(comp._id);
  const deficits = comp.deficits || [];
  
  const deficitCounts = {};
  deficits.forEach(d => deficitCounts[d] = (deficitCounts[d] || 0) + 1);
  
  let emblemHtml = '';
  for (let [emb, count] of Object.entries(deficitCounts)) {
    emblemHtml += `<div class="emblem-badge">+${count} ${emb}纹章</div>`;
  }

  card.innerHTML = `
    <div class="combo-header">
      <div class="combo-title-group">
        <button class="star-btn ${isStarred ? 'starred' : ''}" data-id="${comp._id}">
          ${isStarred ? '★' : '☆'}
        </button>
        <h3>${generateComboName(comp)}</h3>
      </div>
      <div class="combo-info">
        ${emblemHtml}
        <span class="combo-cost">💰 ${comp.cost}</span>
      </div>
    </div>
    <div class="champ-list">
      ${champsHTML}
    </div>
    <div class="trait-list">
      ${traitsHTML}
    </div>
  `;
  
  card.querySelector('.star-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const btn = e.target;
    const id = btn.dataset.id;
    if (starredCombos.has(id)) {
      starredCombos.delete(id);
      btn.classList.remove('starred');
      btn.textContent = '☆';
    } else {
      starredCombos.add(id);
      btn.classList.add('starred');
      btn.textContent = '★';
    }
    localStorage.setItem('tft-stars', JSON.stringify([...starredCombos]));
    if (showStarredOnly) renderCombinations();
  });
  
  return card;
}

function renderNextBatch(batchSize) {
  const mainContainer = document.getElementById('combinations-container');
  const endIndex = Math.min(currentRenderIndex + batchSize, currentRenderList.length);
  
  for (let i = currentRenderIndex; i < endIndex; i++) {
    const item = currentRenderList[i];
    if (item.type === 'header') {
      const popHeader = document.createElement('h2');
      popHeader.className = 'population-header';
      popHeader.innerHTML = `<span>👥 ${item.pop} 人口阵容</span><span class="pop-count">(${item.count})</span>`;
      mainContainer.appendChild(popHeader);

      currentGridNode = document.createElement('div');
      currentGridNode.className = 'combinations-grid';
      mainContainer.appendChild(currentGridNode);
    } else {
      if (!currentGridNode) {
         currentGridNode = document.createElement('div');
         currentGridNode.className = 'combinations-grid';
         mainContainer.appendChild(currentGridNode);
      }
      const card = createCompCard(item.comp);
      currentGridNode.appendChild(card);
    }
  }
  
  currentRenderIndex = endIndex;
  
  const sentinel = document.getElementById('load-more-sentinel');
  if (sentinel) {
    if (currentRenderIndex < currentRenderList.length) {
      sentinel.style.display = 'block';
    } else {
      sentinel.style.display = 'none';
    }
  }
}

document.addEventListener('DOMContentLoaded', init);
