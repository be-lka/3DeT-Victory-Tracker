// Theme Management
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = themeToggle.querySelector('.theme-icon');

// Load theme from localStorage or default to dark
const currentTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', currentTheme);
updateThemeIcon(currentTheme);

themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
});

function updateThemeIcon(theme) {
    themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// Character Data Management
let characters = [];
let combatMode = false;
let preparationPhase = false;
const battlefieldSections = 5;
const defaultBattlefieldSection = 2;
const STORAGE_KEYS = {
    characters: 'rpg-characters',
    autosave: 'rpg-characters-autosave',
    autosaveState: 'rpg-characters-autosave-state',
    history: 'rpg-resource-history'
};
const AUTOSAVE_MAX_ENTRIES = 8;
const AUTOSAVE_MIN_INTERVAL_MS = 10000;
const AUTOSAVE_DELAY_MS = 1500;
let autosaveTimer = null;
const HISTORY_MAX_ENTRIES = 200;
let resourceHistory = [];
let roundNumber = 0;
let turnsThisRound = 0;
const DEFAULT_AVATAR = 'img/default_character.jpg';
const STATUS_EFFECTS = [
    {
        key: 'desprevenido',
        label: 'Desprevenido',
        description: 'Perda nos testes de defesa; pode sofrer um ataque “pré-combate” antes da iniciativa.'
    },
    {
        key: 'indefeso',
        label: 'Indefeso',
        description: 'Não rola dados na defesa (só Resistência + bônus passivos). Inclui casos como paralisado e inconsciente.'
    },
    {
        key: 'caido',
        label: 'Caído',
        description: 'Perda em todos os testes até gastar um movimento pra levantar.'
    },
    {
        key: 'atordoado',
        label: 'Atordoado',
        description: 'No próximo turno não faz ação, só movimento.'
    },
    {
        key: 'agarrado',
        label: 'Agarrado',
        description: 'Não pode fazer ação nem movimento (exceto tentar se soltar).'
    },
    {
        key: 'paralisado',
        label: 'Paralisado',
        description: 'O alvo paralisado fica indefeso.'
    },
    {
        key: 'exausto',
        label: 'Exausto',
        description: 'PM vão a zero e Perda em todos os testes até descansar.'
    }
];
const STATUS_EFFECTS_MAP = STATUS_EFFECTS.reduce((acc, effect) => {
    acc[effect.key] = effect;
    acc[effect.label.toLowerCase()] = effect;
    return acc;
}, {});

function normalizeStatusList(statuses) {
    if (!Array.isArray(statuses)) return [];
    const normalized = [];
    statuses.forEach((status) => {
        if (!status) return;
        const key = String(status).toLowerCase();
        const effect = STATUS_EFFECTS_MAP[key];
        if (effect && !normalized.includes(effect.key)) {
            normalized.push(effect.key);
        }
    });
    return normalized;
}

const INVENTORY_RARITIES = ['comum', 'incomum', 'raro'];
const INVENTORY_LABELS = {
    comum: 'Comum',
    incomum: 'Incomum',
    raro: 'Raro'
};
const INVENTORY_BASE_CAPACITY = {
    comum: 2,
    incomum: 0,
    raro: 0
};
const INVENTORY_TIER_PRESETS = [
    {
        level: 0,
        label: 'Sem Inventário',
        summary: '2 Comum',
        capacity: { comum: 2, incomum: 0, raro: 0 }
    },
    {
        level: 1,
        label: 'Inventário 1',
        summary: '3 Comum • 1 Incomum',
        capacity: { comum: 3, incomum: 1, raro: 0 }
    },
    {
        level: 2,
        label: 'Inventário 2',
        summary: '5 Comum • 2 Incomum',
        capacity: { comum: 5, incomum: 2, raro: 0 }
    },
    {
        level: 3,
        label: 'Inventário 3',
        summary: '5 Comum • 4 Incomum • 1 Raro',
        capacity: { comum: 5, incomum: 4, raro: 1 }
    }
];
const INVENTORY_TIER_MAP = INVENTORY_TIER_PRESETS.reduce((acc, preset) => {
    acc[preset.level] = preset;
    return acc;
}, {});

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

function toFiniteInt(value, fallback = 0) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeInventoryTier(value) {
    const parsed = toFiniteInt(value, INVENTORY_TIER_PRESETS[0].level);
    return clampNumber(parsed, INVENTORY_TIER_PRESETS[0].level, INVENTORY_TIER_PRESETS[INVENTORY_TIER_PRESETS.length - 1].level);
}

function getInventoryCapacityForTier(level) {
    const preset = INVENTORY_TIER_MAP[level] || INVENTORY_TIER_PRESETS[0];
    return { ...preset.capacity };
}

function inferInventoryTier(character) {
    if (character && Number.isFinite(Number(character.inventarioNivel))) {
        return normalizeInventoryTier(character.inventarioNivel);
    }

    const capacitySource = character?.inventarioCapacidade && typeof character.inventarioCapacidade === 'object'
        ? character.inventarioCapacidade
        : {};
    const itemsSource = character?.inventario && typeof character.inventario === 'object'
        ? character.inventario
        : {};

    const comum = Math.max(toFiniteInt(capacitySource.comum, 0), toFiniteInt(itemsSource.comum, 0));
    const incomum = Math.max(toFiniteInt(capacitySource.incomum, 0), toFiniteInt(itemsSource.incomum, 0));
    const raro = Math.max(toFiniteInt(capacitySource.raro, 0), toFiniteInt(itemsSource.raro, 0));

    if (raro >= 1 && incomum >= 4 && comum >= 5) {
        return 3;
    }
    if (incomum >= 2 && comum >= 5) {
        return 2;
    }
    if (incomum >= 1 && comum >= 3) {
        return 1;
    }
    return 0;
}

function normalizeInventoryItems(items, capacity) {
    const source = items && typeof items === 'object' ? items : {};
    return {
        comum: clampNumber(toFiniteInt(source.comum, 0), 0, capacity.comum),
        incomum: clampNumber(toFiniteInt(source.incomum, 0), 0, capacity.incomum),
        raro: clampNumber(toFiniteInt(source.raro, 0), 0, capacity.raro)
    };
}

function ensureCharacterInventory(character) {
    const tier = inferInventoryTier(character);
    const capacity = getInventoryCapacityForTier(tier);
    const hasItems = character.inventario && typeof character.inventario === 'object';
    const items = hasItems ? normalizeInventoryItems(character.inventario, capacity) : { ...capacity };
    character.inventarioNivel = tier;
    character.inventarioCapacidade = capacity;
    character.inventario = items;
}

function normalizeCharacterData(character) {
    const normalized = {
        ...character,
        statuses: normalizeStatusList(character.statuses)
    };
    ensureCharacterInventory(normalized);
    return normalized;
}

// Load characters from JSON file
async function loadCharacters() {
    if (loadFromLocalStorage()) {
        return;
    }
    try {
        const response = await fetch('characters.json');
        if (!response.ok) {
            throw new Error('Failed to load characters.json');
        }
        const jsonData = await response.json();
        characters = jsonData.map(normalizeCharacterData);
        ensureBattlefieldPositions();
        saveCharacters(); // Sync to localStorage
        renderCharacters();
    } catch (error) {
        console.error('Error loading characters:', error);
        if (characters.length === 0) {
            // Create default sample data if nothing exists
            characters = [
                {
                    id: 1,
                    name: "Personagem Exemplo",
                    avatar: DEFAULT_AVATAR,
                    poder: 10,
                    habilidade: 8,
                    resistencia: 12,
                    pontosVida: 60,
                    pontosMana: 40,
                    pontosAcao: 10
                }
            ].map(normalizeCharacterData);
            saveCharacters();
            renderCharacters();
        }
    }
}

// Save characters to JSON (using localStorage as fallback since we can't write to files directly)
function saveCharacters() {
    localStorage.setItem(STORAGE_KEYS.characters, JSON.stringify(characters));
    queueAutosave();
    // Note: In a real scenario, you'd need a backend to save to JSON file
    // For now, we'll use localStorage as the primary storage
}

// Load from localStorage on page load
function loadFromLocalStorage() {
    const saved = localStorage.getItem(STORAGE_KEYS.characters);
    if (!saved) return false;
    try {
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) return false;
        characters = parsed.map(normalizeCharacterData);
        ensureBattlefieldPositions();
        renderCharacters();
        return true;
    } catch (error) {
        console.error('Error loading from localStorage:', error);
        return false;
    }
}

function queueAutosave() {
    if (autosaveTimer) {
        clearTimeout(autosaveTimer);
    }
    autosaveTimer = setTimeout(() => {
        autosaveTimer = null;
        performAutosave();
    }, AUTOSAVE_DELAY_MS);
}

function performAutosave() {
    const now = Date.now();
    const dataStr = JSON.stringify(characters);
    let state = {};
    try {
        state = JSON.parse(localStorage.getItem(STORAGE_KEYS.autosaveState) || '{}');
    } catch (error) {
        state = {};
    }

    const lastSavedAt = state.lastSavedAt || 0;
    if (state.lastHash === dataStr && now - lastSavedAt < AUTOSAVE_MIN_INTERVAL_MS) {
        return;
    }

    const snapshots = getAutosaveSnapshots();
    snapshots.push({
        timestamp: now,
        data: dataStr,
        count: characters.length
    });

    const trimmed = snapshots.slice(-AUTOSAVE_MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEYS.autosave, JSON.stringify(trimmed));
    localStorage.setItem(STORAGE_KEYS.autosaveState, JSON.stringify({
        lastHash: dataStr,
        lastSavedAt: now
    }));
}

function getAutosaveSnapshots() {
    const raw = localStorage.getItem(STORAGE_KEYS.autosave);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((entry) => entry && entry.data);
    } catch (error) {
        console.error('Error loading autosaves:', error);
        return [];
    }
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('pt-BR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function loadResourceHistory() {
    const raw = localStorage.getItem(STORAGE_KEYS.history);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed;
    } catch (error) {
        console.error('Error loading history:', error);
        return [];
    }
}

function saveResourceHistory() {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(resourceHistory));
}

function addResourceHistoryEntry(entry) {
    resourceHistory.unshift(entry);
    if (resourceHistory.length > HISTORY_MAX_ENTRIES) {
        resourceHistory = resourceHistory.slice(0, HISTORY_MAX_ENTRIES);
    }
    saveResourceHistory();
}

function getResourceLabel(type) {
    if (type === 'vida') return 'PV';
    if (type === 'mana') return 'PM';
    if (type === 'acao') return 'PA';
    if (typeof type === 'string' && type.startsWith('inventario-')) {
        const rarity = type.replace('inventario-', '');
        const label = INVENTORY_LABELS[rarity] || rarity;
        return `Inv ${label}`;
    }
    return type;
}

function getResourceActionLabel(type, delta) {
    if (type === 'vida') {
        return delta > 0 ? 'Ganhou PV' : 'Perdeu PV';
    }
    if (type === 'mana') {
        return delta > 0 ? 'Restaurou PM' : 'Gastou PM';
    }
    if (type === 'acao') {
        return delta > 0 ? 'Recuperou PA' : 'Gastou PA';
    }
    if (typeof type === 'string' && type.startsWith('inventario-')) {
        return delta > 0 ? 'Recuperou item' : 'Usou item';
    }
    return delta > 0 ? 'Recuperou' : 'Gastou';
}

function updateRoundIndicator() {
    const indicator = document.getElementById('round-indicator');
    if (!indicator) return;
    if (!combatMode || preparationPhase) {
        indicator.textContent = 'Rodada: —';
        indicator.classList.add('inactive');
        return;
    }
    indicator.textContent = `Rodada: ${roundNumber}`;
    indicator.classList.remove('inactive');
}

function setupMoreMenu() {
    const moreToggle = document.getElementById('more-toggle');
    const moreMenu = document.getElementById('more-menu');
    if (!moreToggle || !moreMenu) return;

    const closeMenu = () => {
        moreMenu.classList.remove('open');
        moreToggle.setAttribute('aria-expanded', 'false');
    };

    const toggleMenu = () => {
        const isOpen = moreMenu.classList.toggle('open');
        moreToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    };

    moreToggle.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleMenu();
    });

    document.addEventListener('click', (event) => {
        if (!moreMenu.contains(event.target) && event.target !== moreToggle) {
            closeMenu();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeMenu();
        }
    });

    moreMenu.querySelectorAll('button').forEach((button) => {
        button.addEventListener('click', () => {
            closeMenu();
        });
    });
}

// Render all characters
function renderCharacters() {
    const container = document.getElementById('characters-container');
    container.innerHTML = '';

    // Sort by initiative if in combat mode (highest first)
    let sortedCharacters = [...characters];
    if (combatMode && !preparationPhase) {
        // Use turnOrder for active combat, initiative for preparation phase
        sortedCharacters.sort((a, b) => {
            const initA = a.turnOrder !== undefined ? a.turnOrder : (a.iniciativa || 0);
            const initB = b.turnOrder !== undefined ? b.turnOrder : (b.iniciativa || 0);
            return initB - initA; // Highest first
        });
    } else if (combatMode && preparationPhase) {
        // During preparation, sort by initiative (if set)
        sortedCharacters.sort((a, b) => {
            const initA = a.iniciativa || 0;
            const initB = b.iniciativa || 0;
            return initB - initA; // Highest first
        });
    }

    sortedCharacters.forEach((character, index) => {
        const isCurrentTurn = combatMode && !preparationPhase && index === 0; // First card is current turn (only in active combat)
        const card = createCharacterCard(character, isCurrentTurn);
        container.appendChild(card);
    });
    
    // Update combat mode UI
    updateCombatModeUI();
    renderBattlefield(sortedCharacters);
}

// Create a character card element
function createCharacterCard(character, isCurrentTurn = false) {
    const card = document.createElement('div');

    ensureCharacterInventory(character);
    
    // Calculate max values
    const maxVida = character.resistencia * 5;
    const maxMana = character.habilidade * 5;
    const maxAcao = character.poder;
    
    // Ensure current values don't exceed max (but allow 0 values)
    // Use explicit checks to only default if value is null or undefined (not 0)
    if (character.pontosVida === undefined || character.pontosVida === null) {
        character.pontosVida = maxVida;
    } else {
        character.pontosVida = Math.max(0, Math.min(character.pontosVida, maxVida));
    }
    
    if (character.pontosMana === undefined || character.pontosMana === null) {
        character.pontosMana = maxMana;
    } else {
        character.pontosMana = Math.max(0, Math.min(character.pontosMana, maxMana));
    }
    
    if (character.pontosAcao === undefined || character.pontosAcao === null) {
        character.pontosAcao = maxAcao;
    } else {
        character.pontosAcao = Math.max(0, Math.min(character.pontosAcao, maxAcao));
    }
    
    // Check if character is "Perto da Morte" (pontosVida <= resistencia)
    const isPertoDaMorte = character.pontosVida <= character.resistencia;
    
    // Determine character type (default to 'player' if not set)
    const characterType = character.type || 'player';
    let cardClasses = 'character-card';
    
    // Add type-based class
    if (characterType === 'enemy') {
        cardClasses += ' character-enemy';
    } else if (characterType === 'friendly') {
        cardClasses += ' character-friendly';
    } else if (characterType === 'neutral') {
        cardClasses += ' character-neutral';
    }
    
    // Add "Perto da Morte" class if applicable
    if (isPertoDaMorte) {
        cardClasses += ' perto-da-morte';
    }
    
    // Add current turn glow if applicable
    if (isCurrentTurn) {
        cardClasses += ' current-turn';
    }
    
    card.className = cardClasses;
    
    // Calculate percentages
    const vidaPercent = (character.pontosVida / maxVida) * 100;
    const manaPercent = (character.pontosMana / maxMana) * 100;
    const acaoPercent = (character.pontosAcao / maxAcao) * 100;
    
    // Check if values should be hidden
    const hiddenValues = character.hiddenValues || false;

    const poderDisplay = hiddenValues ? '?' : character.poder;
    const habilidadeDisplay = hiddenValues ? '?' : character.habilidade;
    const resistenciaDisplay = hiddenValues ? '?' : character.resistencia;
    const inventorySlotsHTML = buildInventorySlotsHTML(character);
    
    card.innerHTML = `
        <div class="character-header">
            <div class="character-avatar-column">
                <img src="${character.avatar || DEFAULT_AVATAR}" 
                     alt="${character.name}" 
                     class="character-avatar"
                     data-character-id="${character.id}"
                     onerror="this.src='img/default_character.jpg'">
                <div class="character-attributes">
                    <div class="character-attribute">
                        <span class="character-attribute-label">Poder</span>
                        <span class="character-attribute-value">${poderDisplay}</span>
                    </div>
                    <div class="character-attribute">
                        <span class="character-attribute-label">Habilidade</span>
                        <span class="character-attribute-value">${habilidadeDisplay}</span>
                    </div>
                    <div class="character-attribute">
                        <span class="character-attribute-label">Resistência</span>
                        <span class="character-attribute-value">${resistenciaDisplay}</span>
                    </div>
                </div>
            </div>
            <div class="character-main">
                <div class="character-title-row">
                    <div class="character-name">${character.name}</div>
                    <div class="character-actions">
                        <button class="edit-character-btn" onclick="showEditCharacterModal(${character.id})" title="Editar personagem">
                            ✏️
                        </button>
                        <button class="delete-character-btn" onclick="deleteCharacter(${character.id})" title="Remover personagem">
                            🗑️
                        </button>
                    </div>
                </div>
                <div class="status-bars">
                    <div class="status-bar-container">
                    <div class="status-bar-label">
                            <span>Pontos de Vida</span>
                    </div>
                        <div class="status-bar" data-character-id="${character.id}" data-type="vida" data-max="${maxVida}">
                            <div class="status-bar-fill health" style="width: ${vidaPercent}%"></div>
                            ${hiddenValues ? '' : `<span class="status-bar-value">${character.pontosVida} / ${maxVida}</span>`}
                        </div>
                    </div>
                    <div class="status-bar-container">
                    <div class="status-bar-label">
                            <span>Pontos de Mana</span>
                    </div>
                        <div class="status-bar" data-character-id="${character.id}" data-type="mana" data-max="${maxMana}">
                            <div class="status-bar-fill mana" style="width: ${manaPercent}%"></div>
                            ${hiddenValues ? '' : `<span class="status-bar-value">${character.pontosMana} / ${maxMana}</span>`}
                        </div>
                    </div>
                    <div class="status-bar-container">
                    <div class="status-bar-label">
                            <span>Pontos de Ação</span>
                    </div>
                        <div class="status-bar" data-character-id="${character.id}" data-type="acao" data-max="${maxAcao}">
                            <div class="status-bar-fill action" style="width: ${acaoPercent}%"></div>
                            ${hiddenValues ? '' : `<span class="status-bar-value">${character.pontosAcao} / ${maxAcao}</span>`}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="character-statuses">
            <div class="status-header">
                <button class="status-edit-link" onclick="showStatusModal(${character.id})" title="Editar status">STATUS</button>
            </div>
            <div class="status-tags" data-character-id="${character.id}"></div>
        </div>
        <div class="character-inventory">
            <div class="inventory-header">
                <button class="inventory-edit-link" onclick="showInventoryModal(${character.id})" title="Editar inventário">Inventário</button>
            </div>
            <div class="inventory-groups" data-character-id="${character.id}">
                ${inventorySlotsHTML}
            </div>
        </div>
        ${combatMode ? `
        <div class="initiative-container">
            <label>Iniciativa:</label>
            <input type="number" 
                   class="initiative-input" 
                   value="${character.iniciativa || ''}" 
                   data-character-id="${character.id}"
                   onchange="updateInitiative(${character.id}, this.value)"
                   placeholder="0"
                   ${preparationPhase ? '' : 'readonly'}>
        </div>
        ` : ''}
    `;

    const statusTags = card.querySelector('.status-tags');
    if (statusTags) {
        renderStatusTags(statusTags, character);
    }

    const inventoryGroups = card.querySelector('.inventory-groups');
    if (inventoryGroups) {
        inventoryGroups.addEventListener('click', (event) => {
            const slot = event.target.closest('.inventory-slot');
            if (!slot || !inventoryGroups.contains(slot)) return;
            if (slot.classList.contains('placeholder')) return;

            const isSelected = slot.classList.contains('selected');
            inventoryGroups.querySelectorAll('.inventory-slot.selected').forEach((selected) => {
                selected.classList.remove('selected');
            });
            if (!isSelected) {
                slot.classList.add('selected');
            }
        });

        inventoryGroups.addEventListener('dblclick', (event) => {
            const slot = event.target.closest('.inventory-slot');
            if (!slot || !inventoryGroups.contains(slot)) return;
            if (slot.classList.contains('placeholder')) return;

            const rarity = slot.dataset.rarity;
            const characterId = parseInt(inventoryGroups.dataset.characterId, 10);
            if (!rarity || !characterId) return;

            const delta = slot.classList.contains('filled') ? -1 : 1;
            adjustInventoryItem(characterId, rarity, delta);
        });
    }
    
    // Add double-click listeners to bars
    const bars = card.querySelectorAll('.status-bar');
    bars.forEach(bar => {
        bar.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            const characterId = parseInt(bar.dataset.characterId);
            const type = bar.dataset.type;
            showInputModal(characterId, type);
        });
    });
    
    // Add double-click listener to avatar
    const avatar = card.querySelector('.character-avatar');
    avatar.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const characterId = parseInt(avatar.dataset.characterId);
        showAvatarModal(characterId);
    });
    
    return card;
}

function buildInventorySlotsHTML(character) {
    const items = character.inventario || {};
    const capacity = character.inventarioCapacidade || INVENTORY_BASE_CAPACITY;
    const groups = [];

    INVENTORY_RARITIES.forEach((rarity) => {
        const total = capacity[rarity] ?? 0;
        if (total <= 0) {
            return;
        }
        const filled = items[rarity] ?? 0;
        const label = INVENTORY_LABELS[rarity];
        let slotsHTML = '';

        for (let i = 0; i < total; i += 1) {
            const stateClass = i < filled ? 'filled' : 'empty';
            slotsHTML += `<span class="inventory-slot ${rarity} ${stateClass}" data-rarity="${rarity}" data-filled="${i < filled ? 'true' : 'false'}" aria-hidden="true"></span>`;
        }

        groups.push(`
            <div class="inventory-group" data-rarity="${rarity}" title="${label}: ${filled}/${total}">
                <span class="inventory-label">${label}</span>
                <div class="inventory-slots">${slotsHTML}</div>
            </div>
        `);
    });

    return groups.join('');
}

function adjustInventoryItem(characterId, rarity, delta) {
    const character = characters.find(c => c.id === characterId);
    if (!character || !INVENTORY_RARITIES.includes(rarity)) return;

    ensureCharacterInventory(character);
    const capacity = character.inventarioCapacidade?.[rarity] ?? 0;
    if (capacity <= 0) return;

    const before = character.inventario?.[rarity] ?? 0;
    const after = clampNumber(before + delta, 0, capacity);
    if (before === after) return;

    character.inventario[rarity] = after;
    addResourceHistoryEntry({
        timestamp: Date.now(),
        characterId: character.id,
        characterName: character.name,
        type: `inventario-${rarity}`,
        delta: after - before,
        before,
        after
    });
    saveCharacters();
    renderCharacters();
}

function renderStatusTags(container, character) {
    container.innerHTML = '';
    const statuses = normalizeStatusList(character.statuses);

    if (!statuses.length) {
        return;
    }

    statuses.forEach((statusKey) => {
        const effect = STATUS_EFFECTS_MAP[statusKey];
        if (!effect) return;
        const tag = document.createElement('span');
        tag.className = 'status-tag';
        tag.textContent = effect.label;
        const tooltip = document.createElement('span');
        tooltip.className = 'status-tooltip';
        tooltip.textContent = effect.description;
        tag.appendChild(tooltip);
        container.appendChild(tag);
    });
}

function ensureBattlefieldPositions() {
    characters.forEach((character) => {
        if (typeof character.battlefieldSection !== 'number' || Number.isNaN(character.battlefieldSection)) {
            character.battlefieldSection = defaultBattlefieldSection;
        }
    });
}

function renderBattlefield(sortedCharacters) {
    const panel = document.getElementById('battlefield-panel');
    if (!panel) return;

    // Update header text based on phase
    const header = panel.querySelector('.battlefield-header p');
    if (header) {
        if (preparationPhase) {
            header.textContent = 'Arraste os pontos para posicionar os personagens antes do combate.';
        } else if (combatMode) {
            header.textContent = 'Arraste os pontos para mudar a distância durante o combate.';
        } else {
            header.textContent = 'Arraste os pontos para mudar a distância.';
        }
    }

    ensureBattlefieldPositions();

    const sections = panel.querySelectorAll('.battlefield-section');
    sections.forEach((section) => {
        const dotsContainer = section.querySelector('.battlefield-dots');
        if (dotsContainer) {
            dotsContainer.innerHTML = '';
        }
    });

    const orderedCharacters = sortedCharacters && sortedCharacters.length ? sortedCharacters : [...characters];
    const currentTurnId = combatMode && !preparationPhase && orderedCharacters.length ? orderedCharacters[0].id : null;

    orderedCharacters.forEach((character) => {
        const sectionIndex = Math.min(
            battlefieldSections - 1,
            Math.max(0, character.battlefieldSection ?? defaultBattlefieldSection)
        );
        const section = panel.querySelector(`.battlefield-section[data-section-index="${sectionIndex}"]`);
        if (!section) return;

        const dotsContainer = section.querySelector('.battlefield-dots');
        if (!dotsContainer) return;

        const dot = document.createElement('div');
        const characterType = character.type || 'player';
        let dotClass = 'battlefield-dot';
        if (characterType === 'enemy') {
            dotClass += ' dot-enemy';
        } else if (characterType === 'friendly') {
            dotClass += ' dot-friendly';
        } else {
            dotClass += ' dot-player';
        }

        if (currentTurnId === character.id) {
            dotClass += ' current-turn';
        }

        dot.className = dotClass;
        dot.setAttribute('draggable', 'true');
        dot.dataset.characterId = character.id;
        dot.title = character.name;

        // Add character avatar image inside the dot
        const avatarImg = document.createElement('img');
        avatarImg.src = character.avatar || DEFAULT_AVATAR;
        avatarImg.alt = character.name;
        avatarImg.onerror = function() {
            this.src = DEFAULT_AVATAR;
        };
        dot.appendChild(avatarImg);

        dot.addEventListener('dragstart', (event) => {
            event.dataTransfer.setData('text/plain', character.id.toString());
        });

        dotsContainer.appendChild(dot);
    });
}

function setupBattlefieldDragAndDrop() {
    const sections = document.querySelectorAll('.battlefield-section');
    sections.forEach((section) => {
        section.addEventListener('dragover', (event) => {
            event.preventDefault();
            section.classList.add('is-drop-target');
        });

        section.addEventListener('dragleave', () => {
            section.classList.remove('is-drop-target');
        });

        section.addEventListener('drop', (event) => {
            event.preventDefault();
            section.classList.remove('is-drop-target');
            const characterId = parseInt(event.dataTransfer.getData('text/plain'), 10);
            if (!characterId) return;

            const sectionIndex = parseInt(section.dataset.sectionIndex, 10);
            const character = characters.find((c) => c.id === characterId);
            if (!character || Number.isNaN(sectionIndex)) return;

            character.battlefieldSection = sectionIndex;
            saveCharacters();
            renderCharacters();
        });
    });
}

// Modal Management
function showInputModal(characterId, type) {
    const character = characters.find(c => c.id === characterId);
    if (!character) return;
    
    const typeNames = {
        vida: 'Pontos de Vida',
        mana: 'Pontos de Mana',
        acao: 'Pontos de Ação'
    };
    
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    
    overlay.innerHTML = `
        <div class="modal">
            <div class="modal-title">Modificar ${typeNames[type]}</div>
            <div class="modal-hint">Digite +número para adicionar, -número para subtrair, ou apenas um número para definir o valor absoluto (ex: +10, -5, 50)</div>
            <input type="text" class="modal-input" id="value-input" placeholder="+10, -5 ou 50" autofocus>
            <div class="modal-buttons">
                <button class="modal-button" onclick="closeModal()">Cancelar</button>
                <button class="modal-button primary" onclick="applyValue(${characterId}, '${type}')">Aplicar</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Focus input and handle Enter key
    const input = overlay.querySelector('#value-input');
    input.focus();
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            applyValue(characterId, type);
        }
    });
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    });
}

function closeModal() {
    const overlay = document.querySelector('.modal-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function applyValue(characterId, type) {
    const input = document.getElementById('value-input');
    const valueStr = input.value.trim();
    
    // Validate input format - accepts +x, -x, or just x (absolute value)
    const relativeMatch = valueStr.match(/^([+-])(\d+)$/);
    const absoluteMatch = valueStr.match(/^(\d+)$/);
    
    if (!relativeMatch && !absoluteMatch) {
        alert('Formato inválido! Use +número para adicionar, -número para subtrair, ou apenas um número para definir o valor absoluto (ex: +10, -5, 50)');
        return;
    }
    
    const character = characters.find(c => c.id === characterId);
    if (!character) return;
    
    // Determine which property to update
    const propertyMap = {
        vida: 'pontosVida',
        mana: 'pontosMana',
        acao: 'pontosAcao'
    };
    
    const property = propertyMap[type];
    const maxProperty = type === 'vida' ? 'resistencia' : (type === 'mana' ? 'habilidade' : 'poder');
    const maxMultiplier = type === 'vida' ? 5 : (type === 'mana' ? 5 : 1);
    const maxValue = character[maxProperty] * maxMultiplier;
    
    // Store old value to detect healing/damage
    const oldValue = character[property];
    let operator = null;
    
    // Apply operation
    if (relativeMatch) {
        // Relative operation: +x or -x
        operator = relativeMatch[1];
        const value = parseInt(relativeMatch[2]);
        
        if (operator === '+') {
            character[property] = Math.min(character[property] + value, maxValue);
        } else {
            character[property] = Math.max(character[property] - value, 0);
        }
    } else if (absoluteMatch) {
        // Absolute value: just x
        const value = parseInt(absoluteMatch[1]);
        character[property] = Math.max(0, Math.min(value, maxValue));
        // Determine operator based on value change for animation purposes
        if (character[property] > oldValue) {
            operator = '+';
        } else if (character[property] < oldValue) {
            operator = '-';
        }
    }

    if (character[property] !== oldValue) {
        addResourceHistoryEntry({
            timestamp: Date.now(),
            characterId: character.id,
            characterName: character.name,
            type,
            delta: character[property] - oldValue,
            before: oldValue,
            after: character[property]
        });
    }
    
    // Check for different animation types
    const wasHealed = type === 'vida' && character[property] > oldValue;
    const healthLost = type === 'vida' && character[property] < oldValue;
    const manaSpent = type === 'mana' && character[property] < oldValue;
    const manaRecovered = type === 'mana' && character[property] > oldValue;
    const actionSpent = type === 'acao' && character[property] < oldValue;
    const actionRecovered = type === 'acao' && character[property] > oldValue;
    
    // Save and re-render
    saveCharacters();
    renderCharacters();
    
    // Trigger appropriate animations
    setTimeout(() => {
        const bar = document.querySelector(`.status-bar[data-character-id="${characterId}"][data-type="${type}"]`);
        if (!bar) return;
        
        if (wasHealed) {
            bar.classList.add('healing');
            setTimeout(() => bar.classList.remove('healing'), 1000);
        } else if (healthLost) {
            bar.classList.add('health-loss');
            setTimeout(() => bar.classList.remove('health-loss'), 1000);
        } else if (manaSpent) {
            bar.classList.add('mana-spent');
            setTimeout(() => bar.classList.remove('mana-spent'), 1000);
        } else if (manaRecovered) {
            bar.classList.add('mana-recovered');
            setTimeout(() => bar.classList.remove('mana-recovered'), 1000);
        } else if (actionSpent) {
            bar.classList.add('action-spent');
            setTimeout(() => bar.classList.remove('action-spent'), 1000);
        } else if (actionRecovered) {
            bar.classList.add('action-recovered');
            setTimeout(() => bar.classList.remove('action-recovered'), 1000);
        }
    }, 50); // Small delay to ensure DOM is ready
    
    closeModal();
}

// Delete a character
function deleteCharacter(characterId) {
    if (confirm('Tem certeza que deseja remover este personagem?')) {
        characters = characters.filter(c => c.id !== characterId);
        saveCharacters();
        renderCharacters();
    }
}

// Show avatar change modal
function showAvatarModal(characterId) {
    const character = characters.find(c => c.id === characterId);
    if (!character) return;
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    
    overlay.innerHTML = `
        <div class="modal" style="max-width: 500px;">
            <div class="modal-title">Alterar Avatar de ${character.name}</div>
            <div class="form-group">
                <label>URL da Imagem</label>
                <input type="text" class="modal-input" id="avatar-url" placeholder="https://..." value="${character.avatar || ''}">
            </div>
            <div style="text-align: center; margin: 15px 0; color: var(--text-secondary);">ou</div>
            <div class="form-group">
                <label>Enviar Imagem</label>
                <input type="file" class="modal-input" id="avatar-file" accept="image/*">
            </div>
            <div class="modal-buttons">
                <button class="modal-button" onclick="closeModal()">Cancelar</button>
                <button class="modal-button" onclick="removeAvatar(${characterId})">Remover</button>
                <button class="modal-button primary" onclick="updateAvatar(${characterId})">Aplicar</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Focus URL input
    const urlInput = overlay.querySelector('#avatar-url');
    urlInput.focus();
    
    // Handle file input
    const fileInput = overlay.querySelector('#avatar-file');
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                // Store as data URL in the URL input for preview
                urlInput.value = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    });
}

// Update character avatar
function updateAvatar(characterId) {
    const urlInput = document.getElementById('avatar-url');
    const avatarValue = urlInput.value.trim();
    
    const character = characters.find(c => c.id === characterId);
    if (!character) return;
    
    if (avatarValue) {
        character.avatar = avatarValue;
    } else {
        character.avatar = DEFAULT_AVATAR;
    }
    
    saveCharacters();
    renderCharacters();
    closeModal();
}

// Remove avatar (reset to default)
function removeAvatar(characterId) {
    const character = characters.find(c => c.id === characterId);
    if (!character) return;
    
    character.avatar = DEFAULT_AVATAR;
    saveCharacters();
    renderCharacters();
    closeModal();
}

// Show add character modal
function showAddCharacterModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    
    overlay.innerHTML = `
        <div class="modal" style="max-width: 500px;">
            <div class="modal-title">Adicionar Novo Personagem</div>
            <div class="form-group">
                <label>Nome do Personagem</label>
                <input type="text" class="modal-input" id="char-name" placeholder="Nome" autofocus>
            </div>
            <div class="form-group">
                <label>Avatar (URL ou Upload)</label>
                <input type="text" class="modal-input" id="char-avatar" placeholder="https://... ou deixe vazio para padrão">
                <input type="file" class="modal-input" id="char-avatar-file" accept="image/png,image/jpeg,image/webp">
            </div>
            <div class="form-group">
                <label>Tipo de Personagem</label>
                <select class="modal-input" id="char-type">
                    <option value="player">Jogador</option>
                    <option value="enemy">Inimigo NPC</option>
                    <option value="friendly">Aliado NPC</option>
                    <option value="neutral">NPC Neutro</option>
                </select>
            </div>
            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" id="char-hidden-values" style="width: auto; cursor: pointer;">
                    <span>Ocultar Valores</span>
                </label>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Poder</label>
                    <input type="number" class="modal-input" id="char-poder" placeholder="1" min="1" value="1">
                </div>
                <div class="form-group">
                    <label>Habilidade</label>
                    <input type="number" class="modal-input" id="char-habilidade" placeholder="1" min="1" value="1">
                </div>
                <div class="form-group">
                    <label>Resistência</label>
                    <input type="number" class="modal-input" id="char-resistencia" placeholder="1" min="1" value="1">
                </div>
            </div>
            <div class="modal-buttons">
                <button class="modal-button" onclick="closeModal()">Cancelar</button>
                <button class="modal-button primary" onclick="addCharacter()">Adicionar</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Focus first input and handle Enter key
    const nameInput = overlay.querySelector('#char-name');
    nameInput.focus();
    nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addCharacter();
        }
    });

    const fileInput = overlay.querySelector('#char-avatar-file');
    const urlInput = overlay.querySelector('#char-avatar');
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            urlInput.value = event.target.result;
        };
        reader.readAsDataURL(file);
    });
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    });
}

// Add a new character
function addCharacter() {
    const name = document.getElementById('char-name').value.trim();
    const avatar = document.getElementById('char-avatar').value.trim();
    const type = document.getElementById('char-type').value;
    const hiddenValues = document.getElementById('char-hidden-values').checked;
    const poder = parseInt(document.getElementById('char-poder').value) || 1;
    const habilidade = parseInt(document.getElementById('char-habilidade').value) || 1;
    const resistencia = parseInt(document.getElementById('char-resistencia').value) || 1;
    
    if (!name) {
        alert('Por favor, insira um nome para o personagem.');
        return;
    }
    
    // Generate new ID
    const newId = characters.length > 0 ? Math.max(...characters.map(c => c.id)) + 1 : 1;
    
    // Calculate initial values
    const maxVida = resistencia * 5;
    const maxMana = habilidade * 5;
    const maxAcao = poder;
    
    const newCharacter = {
        id: newId,
        name: name,
        avatar: avatar || DEFAULT_AVATAR,
        type: type,
        hiddenValues: hiddenValues,
        battlefieldSection: defaultBattlefieldSection,
        statuses: [],
        inventarioNivel: 0,
        poder: poder,
        habilidade: habilidade,
        resistencia: resistencia,
        pontosVida: maxVida,
        pontosMana: maxMana,
        pontosAcao: maxAcao
    };
    
    characters.push(newCharacter);
    saveCharacters();
    renderCharacters();
    closeModal();
}

function showEditCharacterModal(characterId) {
    const character = characters.find(c => c.id === characterId);
    if (!character) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    overlay.innerHTML = `
        <div class="modal" style="max-width: 500px;">
            <div class="modal-title">Editar Personagem</div>
            <div class="form-group">
                <label>Nome do Personagem</label>
                <input type="text" class="modal-input" id="edit-char-name" placeholder="Nome" value="${character.name}">
            </div>
            <div class="form-group">
                <label>Tipo de Personagem</label>
                <select class="modal-input" id="edit-char-type">
                    <option value="player" ${character.type === 'player' ? 'selected' : ''}>Jogador</option>
                    <option value="enemy" ${character.type === 'enemy' ? 'selected' : ''}>Inimigo NPC</option>
                    <option value="friendly" ${character.type === 'friendly' ? 'selected' : ''}>Aliado NPC</option>
                    <option value="neutral" ${character.type === 'neutral' ? 'selected' : ''}>NPC Neutro</option>
                </select>
            </div>
            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" id="edit-char-hidden-values" style="width: auto; cursor: pointer;" ${character.hiddenValues ? 'checked' : ''}>
                    <span>Ocultar Valores</span>
                </label>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Poder</label>
                    <input type="number" class="modal-input" id="edit-char-poder" placeholder="10" min="1" value="${character.poder}">
                </div>
                <div class="form-group">
                    <label>Habilidade</label>
                    <input type="number" class="modal-input" id="edit-char-habilidade" placeholder="8" min="1" value="${character.habilidade}">
                </div>
                <div class="form-group">
                    <label>Resistência</label>
                    <input type="number" class="modal-input" id="edit-char-resistencia" placeholder="12" min="1" value="${character.resistencia}">
                </div>
            </div>
            <div class="modal-hint">Dica: para alterar o avatar, dê duplo clique na foto.</div>
            <div class="modal-buttons">
                <button class="modal-button" onclick="closeModal()">Cancelar</button>
                <button class="modal-button primary" id="save-character">Salvar</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const saveBtn = overlay.querySelector('#save-character');
    saveBtn.addEventListener('click', () => {
        updateCharacter(characterId);
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    });
}

function updateCharacter(characterId) {
    const character = characters.find(c => c.id === characterId);
    if (!character) return;

    const name = document.getElementById('edit-char-name').value.trim();
    const type = document.getElementById('edit-char-type').value;
    const hiddenValues = document.getElementById('edit-char-hidden-values').checked;
    const poder = parseInt(document.getElementById('edit-char-poder').value, 10) || character.poder;
    const habilidade = parseInt(document.getElementById('edit-char-habilidade').value, 10) || character.habilidade;
    const resistencia = parseInt(document.getElementById('edit-char-resistencia').value, 10) || character.resistencia;

    if (!name) {
        alert('Por favor, insira um nome para o personagem.');
        return;
    }

    const oldMaxVida = character.resistencia * 5;
    const oldMaxMana = character.habilidade * 5;
    const oldMaxAcao = character.poder;

    const newMaxVida = resistencia * 5;
    const newMaxMana = habilidade * 5;
    const newMaxAcao = poder;

    const wasFullVida = character.pontosVida >= oldMaxVida;
    const wasFullMana = character.pontosMana >= oldMaxMana;
    const wasFullAcao = character.pontosAcao >= oldMaxAcao;

    character.name = name;
    character.type = type;
    character.hiddenValues = hiddenValues;
    character.poder = poder;
    character.habilidade = habilidade;
    character.resistencia = resistencia;

    if (character.pontosVida === undefined || character.pontosVida === null || wasFullVida) {
        character.pontosVida = newMaxVida;
    } else {
        character.pontosVida = Math.max(0, Math.min(character.pontosVida, newMaxVida));
    }

    if (character.pontosMana === undefined || character.pontosMana === null || wasFullMana) {
        character.pontosMana = newMaxMana;
    } else {
        character.pontosMana = Math.max(0, Math.min(character.pontosMana, newMaxMana));
    }

    if (character.pontosAcao === undefined || character.pontosAcao === null || wasFullAcao) {
        character.pontosAcao = newMaxAcao;
    } else {
        character.pontosAcao = Math.max(0, Math.min(character.pontosAcao, newMaxAcao));
    }

    saveCharacters();
    renderCharacters();
    closeModal();
}

function showStatusModal(characterId) {
    const character = characters.find(c => c.id === characterId);
    if (!character) return;

    const currentStatuses = new Set(normalizeStatusList(character.statuses));
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    const optionsHtml = STATUS_EFFECTS.map((effect) => `
        <label class="status-option">
            <input type="checkbox" class="status-option-input" name="status-option" value="${effect.key}" ${currentStatuses.has(effect.key) ? 'checked' : ''}>
            <div class="status-option-text">
                <div class="status-option-title">${effect.label}</div>
                <div class="status-option-desc">${effect.description}</div>
            </div>
        </label>
    `).join('');

    overlay.innerHTML = `
        <div class="modal status-modal">
            <div class="modal-title">Status de ${character.name}</div>
            <div class="modal-hint">Marque os efeitos ativos para este personagem.</div>
            <div class="status-options">
                ${optionsHtml}
            </div>
            <div class="modal-buttons">
                <button class="modal-button" onclick="closeModal()">Cancelar</button>
                <button class="modal-button primary" id="save-statuses">Salvar</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const saveBtn = overlay.querySelector('#save-statuses');
    saveBtn.addEventListener('click', () => {
        const selected = Array.from(overlay.querySelectorAll('input[name="status-option"]:checked')).map((input) => input.value);
        character.statuses = normalizeStatusList(selected);
        saveCharacters();
        renderCharacters();
        closeModal();
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    });
}

function showInventoryModal(characterId) {
    const character = characters.find(c => c.id === characterId);
    if (!character) return;

    ensureCharacterInventory(character);

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    const currentTier = normalizeInventoryTier(character.inventarioNivel);
    const optionsHtml = INVENTORY_TIER_PRESETS.map((preset) => `
        <button type="button"
                class="inventory-tier-button ${preset.level === currentTier ? 'selected' : ''}"
                data-tier="${preset.level}">
            <div class="inventory-tier-main">
                <div class="inventory-tier-title">${preset.label}</div>
            </div>
            <div class="inventory-tier-preview">
                ${renderInventoryTierPreview(preset.capacity)}
            </div>
        </button>
    `).join('');

    overlay.innerHTML = `
        <div class="modal inventory-modal">
            <div class="modal-title">Inventário de ${character.name}</div>
            <div class="modal-hint">Selecione o tier do Inventário.</div>
            <div class="inventory-tier-options">
                ${optionsHtml}
            </div>
            <div class="modal-buttons">
                <button class="modal-button" onclick="closeModal()">Cancelar</button>
                <button class="modal-button primary" data-save-inventory>Salvar</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const saveBtn = overlay.querySelector('[data-save-inventory]');
    saveBtn.addEventListener('click', () => saveInventoryTierFromModal(characterId, overlay));

    overlay.querySelectorAll('.inventory-tier-button').forEach((button) => {
        button.addEventListener('click', () => {
            overlay.querySelectorAll('.inventory-tier-button.selected').forEach((selected) => {
                selected.classList.remove('selected');
            });
            button.classList.add('selected');
        });
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    });
}

function renderInventoryTierPreview(capacity) {
    return INVENTORY_RARITIES.map((rarity) => {
        const total = capacity[rarity] ?? 0;
        if (!total) return '';
        let slots = '';
        for (let i = 0; i < total; i += 1) {
            slots += `<span class="inventory-slot ${rarity} filled preview" aria-hidden="true"></span>`;
        }
        return `
            <div class="inventory-tier-preview-group">
                <span class="inventory-tier-preview-label">${INVENTORY_LABELS[rarity]}</span>
                <div class="inventory-tier-preview-slots">${slots}</div>
            </div>
        `;
    }).join('');
}

function saveInventoryTierFromModal(characterId, overlay) {
    const character = characters.find(c => c.id === characterId);
    if (!character) return;

    const selected = overlay.querySelector('.inventory-tier-button.selected');
    const tier = normalizeInventoryTier(selected ? selected.dataset.tier : 0);
    const capacity = getInventoryCapacityForTier(tier);

    character.inventarioNivel = tier;
    character.inventarioCapacidade = capacity;
    character.inventario = { ...capacity };

    saveCharacters();
    renderCharacters();
    closeModal();
}

function showImportModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    overlay.innerHTML = `
        <div class="modal import-modal">
            <div class="modal-title">Importar Personagens</div>
            <div class="modal-hint">Selecione um arquivo JSON ou cole o conteúdo. A prévia mostra o impacto antes de substituir os dados atuais.</div>
            <div class="import-grid">
                <div>
                    <div class="form-group">
                        <label>Arquivo JSON</label>
                        <input type="file" class="modal-input" id="import-file" accept="application/json">
                    </div>
                    <div class="form-group">
                        <label>Ou cole o JSON</label>
                        <textarea class="modal-textarea" id="import-text" placeholder="Cole aqui o JSON exportado"></textarea>
                    </div>
                    <div class="import-mode">
                        <label>
                            <input type="radio" name="import-mode" value="replace" checked>
                            Substituir tudo
                        </label>
                        <label>
                            <input type="radio" name="import-mode" value="merge">
                            Mesclar (manter existentes)
                        </label>
                    </div>
                </div>
                <div>
                    <div class="import-preview" id="import-preview">
                        <h3>Prévia</h3>
                        <div class="preview-row"><span>Personagens atuais</span><strong>${characters.length}</strong></div>
                        <div class="preview-row"><span>Importados</span><strong>0</strong></div>
                        <div class="preview-row"><span>Ação</span><strong>—</strong></div>
                        <div class="modal-hint">Carregue um JSON para ver a prévia.</div>
                    </div>
                    <div class="import-warnings" id="import-warnings"></div>
                    <div class="import-error" id="import-error"></div>
                </div>
            </div>
            <div class="modal-buttons">
                <button class="modal-button" onclick="closeModal()">Cancelar</button>
                <button class="modal-button primary" id="confirm-import" disabled>Importar</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const fileInput = overlay.querySelector('#import-file');
    const textInput = overlay.querySelector('#import-text');
    const previewEl = overlay.querySelector('#import-preview');
    const warningsEl = overlay.querySelector('#import-warnings');
    const errorEl = overlay.querySelector('#import-error');
    const confirmBtn = overlay.querySelector('#confirm-import');
    const modeInputs = overlay.querySelectorAll('input[name="import-mode"]');

    let parsedData = null;

    const updatePreview = () => {
        const rawText = textInput.value.trim();
        const mode = overlay.querySelector('input[name="import-mode"]:checked').value;

        warningsEl.textContent = '';
        errorEl.textContent = '';
        confirmBtn.disabled = true;
        confirmBtn.textContent = mode === 'replace' ? 'Importar (Substituir)' : 'Importar (Mesclar)';

        if (!rawText) {
            previewEl.innerHTML = `
                <h3>Prévia</h3>
                <div class="preview-row"><span>Personagens atuais</span><strong>${characters.length}</strong></div>
                <div class="preview-row"><span>Importados</span><strong>0</strong></div>
                <div class="preview-row"><span>Ação</span><strong>—</strong></div>
                <div class="modal-hint">Carregue um JSON para ver a prévia.</div>
            `;
            parsedData = null;
            return;
        }

        const result = normalizeImportedCharacters(rawText);
        if (!result.ok) {
            parsedData = null;
            previewEl.innerHTML = `
                <h3>Prévia</h3>
                <div class="preview-row"><span>Personagens atuais</span><strong>${characters.length}</strong></div>
                <div class="preview-row"><span>Importados</span><strong>0</strong></div>
                <div class="preview-row"><span>Ação</span><strong>—</strong></div>
            `;
            errorEl.textContent = result.errors.slice(0, 3).join(' ');
            return;
        }

        parsedData = result.data;
        const summary = buildImportSummary(parsedData, mode);
        const sampleNames = parsedData.slice(0, 5).map((char) => char.name).filter(Boolean);
        const sampleList = sampleNames.length
            ? `<ul class="preview-list">${sampleNames.map((name) => `<li>${name}</li>`).join('')}</ul>`
            : '<div class="modal-hint">Sem nomes para mostrar.</div>';

        previewEl.innerHTML = `
            <h3>Prévia</h3>
            <div class="preview-row"><span>Personagens atuais</span><strong>${summary.current}</strong></div>
            <div class="preview-row"><span>Importados</span><strong>${summary.incoming}</strong></div>
            <div class="preview-row"><span>Ação</span><strong>${summary.actionLabel}</strong></div>
            ${summary.details.map((detail) => `<div class="preview-row"><span>${detail.label}</span><strong>${detail.value}</strong></div>`).join('')}
            ${sampleList}
        `;

        if (result.warnings.length) {
            warningsEl.textContent = result.warnings.slice(0, 2).join(' ');
        }

        confirmBtn.disabled = false;
    };

    confirmBtn.addEventListener('click', () => {
        if (!parsedData) return;
        const mode = overlay.querySelector('input[name="import-mode"]:checked').value;
        const message = mode === 'replace'
            ? `Isso vai substituir ${characters.length} personagens pelos ${parsedData.length} importados. Deseja continuar?`
            : `Isso vai mesclar ${parsedData.length} personagens, mantendo os atuais (${characters.length}). Deseja continuar?`;
        if (!confirm(message)) return;
        applyImportData(parsedData, mode);
        closeModal();
    });

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            textInput.value = e.target.result;
            updatePreview();
        };
        reader.readAsText(file);
    });

    textInput.addEventListener('input', updatePreview);
    modeInputs.forEach((input) => {
        input.addEventListener('change', updatePreview);
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    });
}

function normalizeImportedCharacters(rawText) {
    const errors = [];
    const warnings = [];
    let parsed;

    try {
        parsed = JSON.parse(rawText);
    } catch (error) {
        return { ok: false, data: [], errors: ['JSON inválido.'], warnings: [] };
    }

    if (!Array.isArray(parsed)) {
        return { ok: false, data: [], errors: ['O JSON precisa ser uma lista de personagens.'], warnings: [] };
    }

    const normalized = [];
    const existingIds = characters.map((char) => char.id).filter((id) => Number.isFinite(id));
    const usedIds = new Set(existingIds);
    let nextId = existingIds.length ? Math.max(...existingIds) + 1 : 1;

    parsed.forEach((item, index) => {
        if (!item || typeof item !== 'object') {
            errors.push(`Item ${index + 1}: não é um objeto válido.`);
            return;
        }

        const name = String(item.name || item.nome || '').trim();
        const poder = parseInt(item.poder, 10);
        const habilidade = parseInt(item.habilidade, 10);
        const resistencia = parseInt(item.resistencia, 10);

        if (!name) {
            errors.push(`Item ${index + 1}: nome ausente.`);
            return;
        }
        if (!Number.isFinite(poder) || poder <= 0) {
            errors.push(`Item ${index + 1}: poder inválido.`);
            return;
        }
        if (!Number.isFinite(habilidade) || habilidade <= 0) {
            errors.push(`Item ${index + 1}: habilidade inválida.`);
            return;
        }
        if (!Number.isFinite(resistencia) || resistencia <= 0) {
            errors.push(`Item ${index + 1}: resistência inválida.`);
            return;
        }

        let id = Number.isFinite(item.id) ? item.id : null;
        if (id !== null) {
            if (usedIds.has(id)) {
                warnings.push(`ID duplicado no item ${index + 1}; novo ID será aplicado.`);
                id = null;
            } else {
                usedIds.add(id);
            }
        }

        const type = ['player', 'enemy', 'friendly', 'neutral'].includes(item.type) ? item.type : 'player';
        const avatar = typeof item.avatar === 'string' && item.avatar.trim() ? item.avatar.trim() : DEFAULT_AVATAR;
        const hiddenValues = Boolean(item.hiddenValues);
        const statuses = normalizeStatusList(item.statuses);
        let battlefieldSection = Number.isFinite(item.battlefieldSection) ? item.battlefieldSection : defaultBattlefieldSection;
        if (battlefieldSection < 0 || battlefieldSection >= battlefieldSections) {
            battlefieldSection = defaultBattlefieldSection;
            warnings.push(`Item ${index + 1}: seção de batalha inválida; ajustada para padrão.`);
        }

        const maxVida = resistencia * 5;
        const maxMana = habilidade * 5;
        const maxAcao = poder;
        const hasPontosVida = Object.prototype.hasOwnProperty.call(item, 'pontosVida');
        const hasPontosMana = Object.prototype.hasOwnProperty.call(item, 'pontosMana');
        const hasPontosAcao = Object.prototype.hasOwnProperty.call(item, 'pontosAcao');

        const rawVida = parseInt(item.pontosVida, 10);
        const rawMana = parseInt(item.pontosMana, 10);
        const rawAcao = parseInt(item.pontosAcao, 10);
        const pontosVida = hasPontosVida && Number.isFinite(rawVida)
            ? Math.max(0, Math.min(rawVida, maxVida))
            : maxVida;
        const pontosMana = hasPontosMana && Number.isFinite(rawMana)
            ? Math.max(0, Math.min(rawMana, maxMana))
            : maxMana;
        const pontosAcao = hasPontosAcao && Number.isFinite(rawAcao)
            ? Math.max(0, Math.min(rawAcao, maxAcao))
            : maxAcao;

        const entry = {
            ...item,
            id,
            name,
            avatar,
            type,
            hiddenValues,
            statuses,
            battlefieldSection,
            poder,
            habilidade,
            resistencia,
            pontosVida,
            pontosMana,
            pontosAcao,
            __importProvided: {
                avatar: Object.prototype.hasOwnProperty.call(item, 'avatar'),
                type: Object.prototype.hasOwnProperty.call(item, 'type'),
                hiddenValues: Object.prototype.hasOwnProperty.call(item, 'hiddenValues'),
                battlefieldSection: Object.prototype.hasOwnProperty.call(item, 'battlefieldSection'),
                pontosVida: hasPontosVida,
                pontosMana: hasPontosMana,
                pontosAcao: hasPontosAcao,
                iniciativa: Object.prototype.hasOwnProperty.call(item, 'iniciativa'),
                iniciativaOriginal: Object.prototype.hasOwnProperty.call(item, 'iniciativaOriginal'),
                turnOrder: Object.prototype.hasOwnProperty.call(item, 'turnOrder')
            }
        };

        ensureCharacterInventory(entry);
        normalized.push(entry);
    });

    if (errors.length) {
        return { ok: false, data: [], errors, warnings };
    }

    normalized.forEach((entry) => {
        if (!Number.isFinite(entry.id)) {
            while (usedIds.has(nextId)) {
                nextId += 1;
            }
            entry.id = nextId;
            usedIds.add(nextId);
            nextId += 1;
        }
    });

    return { ok: true, data: normalized, errors: [], warnings };
}

function stripImportMeta(character) {
    const { __importProvided, ...rest } = character;
    return rest;
}

function buildImportSummary(incoming, mode) {
    if (mode === 'replace') {
        return {
            current: characters.length,
            incoming: incoming.length,
            actionLabel: 'Substituir tudo',
            details: [
                { label: 'Serão substituídos', value: characters.length },
                { label: 'Total após importação', value: incoming.length }
            ]
        };
    }

    const summary = getMergeSummary(incoming);
    return {
        current: characters.length,
        incoming: incoming.length,
        actionLabel: 'Mesclar mantendo existentes',
        details: [
            { label: 'Novos adicionados', value: summary.added },
            { label: 'Ignorados (já existem)', value: summary.skipped }
        ]
    };
}

function getMergeSummary(incoming) {
    const existingById = new Set();
    const existingByName = new Set();
    characters.forEach((char) => {
        if (Number.isFinite(char.id)) existingById.add(char.id);
        if (char.name) existingByName.add(char.name.toLowerCase());
    });

    let added = 0;
    let skipped = 0;
    incoming.forEach((item) => {
        const nameKey = item.name ? item.name.toLowerCase() : '';
        const matchesId = Number.isFinite(item.id) && existingById.has(item.id);
        const matchesName = !matchesId && nameKey && existingByName.has(nameKey);
        if (matchesId || matchesName) {
            skipped += 1;
        } else {
            added += 1;
        }
    });

    return { added, skipped };
}

function applyImportData(incoming, mode) {
    if (mode === 'replace') {
        characters = incoming.map(stripImportMeta);
    } else {
        const merged = mergeCharacters(incoming);
        characters = merged.map(stripImportMeta);
    }
    ensureBattlefieldPositions();
    saveCharacters();
    renderCharacters();
}

function mergeCharacters(incoming) {
    const existingById = new Set();
    const existingByName = new Set();
    characters.forEach((char) => {
        if (Number.isFinite(char.id)) existingById.add(char.id);
        if (char.name) existingByName.add(char.name.toLowerCase());
    });

    const merged = [...characters];
    incoming.forEach((item) => {
        const nameKey = item.name ? item.name.toLowerCase() : '';
        const matchesId = Number.isFinite(item.id) && existingById.has(item.id);
        const matchesName = !matchesId && nameKey && existingByName.has(nameKey);
        if (!matchesId && !matchesName) {
            merged.push(item);
        }
    });

    return merged;
}

function showRecoveryModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    const snapshots = getAutosaveSnapshots().sort((a, b) => b.timestamp - a.timestamp);
    let listHtml = '';

    if (!snapshots.length) {
        listHtml = `<div class="recovery-empty">Nenhum autosave encontrado.</div>`;
    } else {
        listHtml = `
            <div class="recovery-list">
                ${snapshots.map((snapshot, index) => {
                    const parsed = safeParseAutosave(snapshot.data);
                    const count = snapshot.count || (parsed ? parsed.length : 0);
                    const sampleNames = parsed ? parsed.slice(0, 3).map((char) => char.name).filter(Boolean) : [];
                    const sampleText = sampleNames.length ? sampleNames.join(', ') : 'Sem nomes para exibir.';
                    return `
                        <div class="recovery-item">
                            <div>
                                <div><strong>${formatTimestamp(snapshot.timestamp)}</strong></div>
                                <div class="recovery-meta">${count} personagens</div>
                                <div class="recovery-sample">${sampleText}</div>
                            </div>
                            <button class="modal-button primary" data-action="restore" data-index="${index}">Restaurar</button>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    overlay.innerHTML = `
        <div class="modal import-modal">
            <div class="modal-title">Recuperar Autosave</div>
            <div class="modal-hint">Selecione um autosave para substituir o estado atual.</div>
            ${listHtml}
            <div class="modal-buttons">
                <button class="modal-button" onclick="closeModal()">Fechar</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const restoreButtons = overlay.querySelectorAll('[data-action="restore"]');
    restoreButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const index = parseInt(button.dataset.index, 10);
            const snapshot = snapshots[index];
            if (!snapshot) return;
            const parsed = safeParseAutosave(snapshot.data);
            if (!parsed) {
                alert('Autosave inválido.');
                return;
            }
            const message = `Isso vai substituir ${characters.length} personagens pelos ${parsed.length} do autosave selecionado. Deseja continuar?`;
            if (!confirm(message)) return;
            characters = parsed;
            ensureBattlefieldPositions();
            saveCharacters();
            renderCharacters();
            closeModal();
        });
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    });
}

function safeParseAutosave(dataStr) {
    try {
        const parsed = JSON.parse(dataStr);
        if (!Array.isArray(parsed)) return null;
        return parsed;
    } catch (error) {
        return null;
    }
}

function showHistoryModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    const entries = resourceHistory.slice(0, 80);
    let listHtml = '';

    if (!entries.length) {
        listHtml = `<div class="history-empty">Nenhuma alteração registrada.</div>`;
    } else {
        listHtml = `
            <div class="history-list">
                ${entries.map((entry) => {
                    const resourceLabel = getResourceLabel(entry.type);
                    const actionLabel = getResourceActionLabel(entry.type, entry.delta);
                    const deltaLabel = `${entry.delta > 0 ? '+' : ''}${entry.delta}`;
                    const deltaClass = entry.delta > 0 ? 'positive' : 'negative';
                    const name = entry.characterName || `ID ${entry.characterId}`;
                    return `
                        <div class="history-item">
                            <div>
                                <div><strong>${name}</strong> — ${actionLabel}</div>
                                <div class="history-meta">${formatTimestamp(entry.timestamp)} • ${resourceLabel} ${entry.before} → ${entry.after}</div>
                            </div>
                            <div class="history-delta ${deltaClass}">${deltaLabel}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    overlay.innerHTML = `
        <div class="modal import-modal">
            <div class="modal-title">Histórico de Recursos</div>
            <div class="modal-hint">Registro das alterações de PV, PM, PA e Inventário.</div>
            ${listHtml}
            <div class="modal-buttons">
                <button class="modal-button" onclick="closeModal()">Fechar</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    });
}

// Export characters to JSON file (download)
function exportToJSON() {
    const dataStr = JSON.stringify(characters, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'characters.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Combat Mode Functions
function toggleCombatMode() {
    if (combatMode && !preparationPhase) {
        // If in active combat, exit combat mode
        combatMode = false;
        preparationPhase = false;
        roundNumber = 0;
        turnsThisRound = 0;
        // Clean up turn order (but keep original iniciativa)
        characters.forEach(char => {
            delete char.turnOrder;
        });
    } else if (combatMode && preparationPhase) {
        // If in preparation phase, exit to normal mode
        combatMode = false;
        preparationPhase = false;
        roundNumber = 0;
        turnsThisRound = 0;
        // Clean up turn order
        characters.forEach(char => {
            delete char.turnOrder;
            delete char.iniciativaOriginal;
        });
    } else {
        // Enter preparation phase
        combatMode = true;
        preparationPhase = true;
        roundNumber = 0;
        turnsThisRound = 0;
    }
    saveCharacters();
    updateCombatModeUI();
    renderCharacters();
}

function startCombat() {
    // End preparation phase and start actual combat
    preparationPhase = false;
    roundNumber = 1;
    turnsThisRound = 0;
    
    // Preserve original initiative values and initialize turn order
    characters.forEach(character => {
        if (character.iniciativaOriginal === undefined) {
            character.iniciativaOriginal = character.iniciativa || 0;
        }
        // Initialize turn order with current initiative for sorting
        character.turnOrder = character.iniciativa || 0;
    });
    
    saveCharacters();
    updateCombatModeUI();
    renderCharacters();
}

function updateCombatModeUI() {
    const combatBtn = document.getElementById('combat-toggle');
    const lutarBtn = document.getElementById('lutar-btn');
    const passarTurnoBtn = document.getElementById('passar-turno-btn');
    const battlefieldPanel = document.getElementById('battlefield-panel');
    
    if (combatMode && preparationPhase) {
        // Preparation phase
        combatBtn.classList.add('active');
        if (lutarBtn) lutarBtn.style.display = 'block';
        passarTurnoBtn.style.display = 'none';
        if (battlefieldPanel) {
            battlefieldPanel.classList.add('active');
        }
        document.body.classList.add('battlefield-active');
    } else if (combatMode && !preparationPhase) {
        // Active combat
        combatBtn.classList.add('active');
        if (lutarBtn) lutarBtn.style.display = 'none';
        passarTurnoBtn.style.display = 'block';
        if (battlefieldPanel) {
            battlefieldPanel.classList.add('active');
        }
        document.body.classList.add('battlefield-active');
    } else {
        // Normal mode
        combatBtn.classList.remove('active');
        if (lutarBtn) lutarBtn.style.display = 'none';
        passarTurnoBtn.style.display = 'none';
        if (battlefieldPanel) {
            battlefieldPanel.classList.remove('active');
        }
        document.body.classList.remove('battlefield-active');
    }
    updateRoundIndicator();
}

function updateInitiative(characterId, value) {
    const character = characters.find(c => c.id === characterId);
    if (character) {
        const newInitiative = parseInt(value) || 0;
        character.iniciativa = newInitiative;
        
        // If in active combat, also update turnOrder
        if (combatMode && !preparationPhase) {
            character.turnOrder = newInitiative;
        }
        
        saveCharacters();
        renderCharacters();
    }
}

function passarTurno() {
    if (!combatMode || preparationPhase) return;
    
    // Sort characters by turn order
    const sortedCharacters = [...characters].sort((a, b) => {
        const initA = a.turnOrder !== undefined ? a.turnOrder : (a.iniciativa || 0);
        const initB = b.turnOrder !== undefined ? b.turnOrder : (b.iniciativa || 0);
        return initB - initA;
    });
    
    if (sortedCharacters.length === 0) return;
    
    // Get the top character (highest turn order)
    const topCharacter = sortedCharacters[0];
    
    // Move top character to bottom by setting its turnOrder to lowest - 1
    // Preserve original iniciativa value
    const turnOrders = sortedCharacters.map(c => c.turnOrder !== undefined ? c.turnOrder : (c.iniciativa || 0));
    const minTurnOrder = Math.min(...turnOrders);
    topCharacter.turnOrder = minTurnOrder - 1;

    turnsThisRound += 1;
    if (turnsThisRound >= sortedCharacters.length) {
        roundNumber += 1;
        turnsThisRound = 0;
    }
    
    // Save first
    saveCharacters();
    updateRoundIndicator();
    
    // Animate the transition
    const container = document.getElementById('characters-container');
    const cards = Array.from(container.children);
    
    // Find the top card
    const topCard = cards.find(card => {
        const charId = parseInt(card.querySelector('.status-bar')?.dataset.characterId);
        return charId === topCharacter.id;
    });
    
    if (topCard && cards.length > 1) {
        // Add animation class to top card
        topCard.classList.add('moving-to-bottom');
        
        // Add smooth transition to other cards
        cards.forEach((card, index) => {
            if (card !== topCard) {
                card.style.transition = 'transform 0.5s ease, opacity 0.5s ease';
                card.style.transform = 'translateY(0)';
            }
        });
        
        // After animation, re-render
        setTimeout(() => {
            renderCharacters();
        }, 500); // Match animation duration
    } else {
        renderCharacters();
    }
}

// Dice Rolling System
function showDiceModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    
    // Build character options
    let characterOptions = '<option value="">Nenhum (rolar sem personagem)</option>';
    characters.forEach(char => {
        characterOptions += `<option value="${char.id}">${char.name} (P:${char.poder} H:${char.habilidade} R:${char.resistencia})</option>`;
    });
    
    overlay.innerHTML = `
        <div class="modal dice-modal">
            <div class="modal-title">🎲 Rolar Dados</div>
            <div class="form-group">
                <label>Personagem</label>
                <select class="modal-input" id="dice-character" onchange="updateDiceCharacterStats()">
                    ${characterOptions}
                </select>
            </div>
            <div class="form-row">
                <div id="dice-attribute-group" class="form-group" style="display: none; flex: 1;">
                    <label>Atributo</label>
                    <select class="modal-input" id="dice-attribute" onchange="updateDiceAttributeValue()">
                        <option value="poder">Poder</option>
                        <option value="habilidade">Habilidade</option>
                        <option value="resistencia">Resistência</option>
                    </select>
                </div>
                <div id="dice-manual-attribute-group" class="form-group" style="display: none; flex: 1;">
                    <label>Atributo</label>
                    <select class="modal-input" id="dice-manual-attribute">
                        <option value="poder">Poder</option>
                        <option value="habilidade">Habilidade</option>
                        <option value="resistencia">Resistência</option>
                    </select>
                </div>
                <div class="form-group" style="flex: 1;">
                    <label>Valor Atributo</label>
                    <input type="number" class="modal-input" id="dice-attribute-value" placeholder="Ex: 10" min="0" value="0" readonly>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group" style="flex: 1;">
                    <label>Qnt. Dados</label>
                    <select class="modal-input" id="dice-count">
                        <option value="1">1 dado</option>
                        <option value="2">2 dados</option>
                        <option value="3" selected>3 dados</option>
                    </select>
                </div>
                <div class="form-group" style="flex: 1;">
                    <label>Modificador</label>
                    <input type="number" class="modal-input" id="dice-modifier" placeholder="Ex: +2 ou -1" value="0">
                </div>
                <div class="form-group" style="flex: 1;">
                    <label>Meta</label>
                    <input type="number" class="modal-input" id="dice-meta" placeholder="Ex: 15" min="1" value="">
                </div>
            </div>
            <div class="modal-buttons">
                <button class="modal-button" onclick="closeModal()">Cancelar</button>
                <button class="modal-button primary" onclick="rollDice()">Rolar!</button>
            </div>
            <div id="dice-result-container" style="display: none; margin-top: 15px;">
                <div id="dice-result"></div>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Initialize the form state (no character selected by default)
    updateDiceCharacterStats();
    
    // Focus first input
    const characterInput = overlay.querySelector('#dice-character');
    characterInput.focus();
    
    // Add event listener for manual attribute change
    const manualAttributeSelect = overlay.querySelector('#dice-manual-attribute');
    if (manualAttributeSelect) {
        manualAttributeSelect.addEventListener('change', () => {
            // Just update display, value stays as user entered
        });
    }
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    });
}

function updateDiceCharacterStats() {
    const characterId = document.getElementById('dice-character').value;
    const attributeGroup = document.getElementById('dice-attribute-group');
    const manualAttributeGroup = document.getElementById('dice-manual-attribute-group');
    const attributeValueInput = document.getElementById('dice-attribute-value');
    
    if (!characterId) {
        // No character selected - show manual attribute selection
        attributeGroup.style.display = 'none';
        manualAttributeGroup.style.display = 'block';
        attributeValueInput.value = '0';
        attributeValueInput.readOnly = false;
        attributeValueInput.placeholder = 'Ex: 10';
        return;
    }
    
    // Character selected - show character attribute selection
    attributeGroup.style.display = 'block';
    manualAttributeGroup.style.display = 'none';
    attributeValueInput.readOnly = true;
    
    // Update attribute value based on selected character and attribute
    updateDiceAttributeValue();
}

function updateDiceAttributeValue() {
    const characterId = document.getElementById('dice-character').value;
    const attributeValueInput = document.getElementById('dice-attribute-value');
    
    if (!characterId) {
        // Manual mode - value is entered by user
        return;
    }
    
    const character = characters.find(c => c.id === parseInt(characterId));
    if (!character) return;
    
    const attributeSelect = document.getElementById('dice-attribute');
    const selectedAttribute = attributeSelect.value;
    
    let value = 0;
    if (selectedAttribute === 'poder') {
        value = character.poder || 0;
    } else if (selectedAttribute === 'habilidade') {
        value = character.habilidade || 0;
    } else if (selectedAttribute === 'resistencia') {
        value = character.resistencia || 0;
    }
    
    attributeValueInput.value = value;
}

function rollDice() {
    const diceCount = parseInt(document.getElementById('dice-count').value) || 3;
    const attributeValue = parseInt(document.getElementById('dice-attribute-value').value) || 0;
    const modifier = parseInt(document.getElementById('dice-modifier').value) || 0;
    const meta = parseInt(document.getElementById('dice-meta').value) || 0;
    
    // Get attribute name
    const characterId = document.getElementById('dice-character').value;
    let attributeName = '';
    if (characterId) {
        const attributeSelect = document.getElementById('dice-attribute');
        const selectedAttribute = attributeSelect.value;
        const attributeNames = {
            poder: 'Poder',
            habilidade: 'Habilidade',
            resistencia: 'Resistência'
        };
        attributeName = attributeNames[selectedAttribute] || 'Atributo';
    } else {
        const manualAttributeSelect = document.getElementById('dice-manual-attribute');
        const selectedAttribute = manualAttributeSelect.value;
        const attributeNames = {
            poder: 'Poder',
            habilidade: 'Habilidade',
            resistencia: 'Resistência'
        };
        attributeName = attributeNames[selectedAttribute] || 'Atributo';
    }
    
    // Check if attribute value is provided
    if (!Number.isFinite(attributeValue)) {
        alert('Por favor, selecione um personagem e atributo ou insira um valor válido para o atributo.');
        return;
    }
    
    // Calculate final attribute value (base + modifier)
    const finalAttributeValue = attributeValue + modifier;
    
    if (!Number.isFinite(finalAttributeValue)) {
        alert('O valor final do atributo (atributo + modificador) não é válido.');
        return;
    }
    
    // Roll dice
    const diceResults = [];
    for (let i = 0; i < diceCount; i++) {
        diceResults.push(Math.floor(Math.random() * 6) + 1);
    }
    
    // Calculate base result (sum of dice + attribute value)
    const diceSum = diceResults.reduce((sum, val) => sum + val, 0);
    const baseResult = diceSum + finalAttributeValue;
    
    // Count critical successes (6s) - each 6 adds the attribute value again
    const criticalCount = diceResults.filter(val => val === 6).length;
    const criticalBonus = criticalCount * finalAttributeValue;
    
    // Final result
    const finalResult = baseResult + criticalBonus;
    
    // Check for critical failure (all dice = 1)
    const isCriticalFailure = diceResults.length > 0 && diceResults.every(val => val === 1);
    
    // Determine success status
    let successStatus = '';
    let successClass = '';
    if (meta > 0) {
        if (isCriticalFailure) {
            successStatus = 'FALHA CRÍTICA';
            successClass = 'dice-result-critical-failure';
        } else if (finalResult >= meta * 2) {
            successStatus = 'SUCESSO PERFEITO';
            successClass = 'dice-result-perfect-success';
        } else if (finalResult >= meta) {
            successStatus = 'SUCESSO';
            successClass = 'dice-result-success';
        } else {
            successStatus = 'FALHA';
            successClass = 'dice-result-failure';
        }
    }
    
    // Display results
    const resultContainer = document.getElementById('dice-result-container');
    const resultDiv = document.getElementById('dice-result');
    
    let diceHTML = '<div class="dice-results">';
    diceHTML += `<div class="dice-roll-summary">`;
    diceHTML += `<div class="dice-roll-title">Resultado: <strong>${finalResult}</strong></div>`;
    
    if (meta > 0) {
        diceHTML += `<div class="dice-result-status ${successClass}">${successStatus}</div>`;
    }
    
    diceHTML += `</div>`;
    diceHTML += `<div class="dice-display">`;
    
    diceResults.forEach((result, index) => {
        const isCritical = result === 6;
        const isFailure = result === 1 && isCriticalFailure;
        let diceClass = 'dice';
        if (isCritical) diceClass += ' dice-critical';
        if (isFailure) diceClass += ' dice-failure';
        diceHTML += `<div class="${diceClass}" data-dice-value="${result}">${result}</div>`;
    });
    
    diceHTML += `</div>`;
    
    if (isCriticalFailure) {
        diceHTML += `<div class="dice-failure-message">💀 Falha Crítica!</div>`;
    }
    
    diceHTML += '</div>';
    
    resultDiv.innerHTML = diceHTML;
    resultContainer.style.display = 'block';
    
    // Trigger animation for critical dice
    setTimeout(() => {
        const criticalDice = resultDiv.querySelectorAll('.dice-critical');
        criticalDice.forEach(die => {
            die.classList.add('dice-critical-animate');
        });
        const failureDice = resultDiv.querySelectorAll('.dice-failure');
        failureDice.forEach(die => {
            die.classList.add('dice-failure-animate');
        });
    }, 100);
}

// Make functions globally available for onclick handlers
window.closeModal = closeModal;
window.applyValue = applyValue;
window.showImportModal = showImportModal;
window.exportToJSON = exportToJSON;
window.showRecoveryModal = showRecoveryModal;
window.showHistoryModal = showHistoryModal;
window.showStatusModal = showStatusModal;
window.showEditCharacterModal = showEditCharacterModal;
window.showAddCharacterModal = showAddCharacterModal;
window.addCharacter = addCharacter;
window.deleteCharacter = deleteCharacter;
window.showAvatarModal = showAvatarModal;
window.updateAvatar = updateAvatar;
window.removeAvatar = removeAvatar;
window.toggleCombatMode = toggleCombatMode;
window.startCombat = startCombat;
window.updateInitiative = updateInitiative;
window.passarTurno = passarTurno;
window.showDiceModal = showDiceModal;
window.rollDice = rollDice;
window.updateDiceCharacterStats = updateDiceCharacterStats;
window.updateDiceAttributeValue = updateDiceAttributeValue;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    resourceHistory = loadResourceHistory();
    loadCharacters();
    setupBattlefieldDragAndDrop();
    setupMoreMenu();
    updateRoundIndicator();
});
