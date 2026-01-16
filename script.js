// Theme Management
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = themeToggle.querySelector('.theme-icon');

// Load theme from localStorage or default to light
const currentTheme = localStorage.getItem('theme') || 'light';
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
const battlefieldSections = 5;
const defaultBattlefieldSection = 2;

// Load characters from JSON file
async function loadCharacters() {
    try {
        const response = await fetch('characters.json');
        if (!response.ok) {
            throw new Error('Failed to load characters.json');
        }
        const jsonData = await response.json();
        // Merge with localStorage data if it exists (localStorage takes precedence for current values)
        const savedData = localStorage.getItem('rpg-characters');
        if (savedData) {
            try {
                const savedChars = JSON.parse(savedData);
                // Update JSON data with saved current values
                jsonData.forEach((char, index) => {
                    const saved = savedChars.find(c => c.id === char.id);
                    if (saved) {
                        jsonData[index].pontosVida = saved.pontosVida;
                        jsonData[index].pontosMana = saved.pontosMana;
                        jsonData[index].pontosAcao = saved.pontosAcao;
                    }
                });
            } catch (e) {
                console.error('Error merging localStorage data:', e);
            }
        }
        characters = jsonData;
        ensureBattlefieldPositions();
        saveCharacters(); // Sync to localStorage
        renderCharacters();
    } catch (error) {
        console.error('Error loading characters:', error);
        // Try loading from localStorage
        loadFromLocalStorage();
        if (characters.length === 0) {
            // Create default sample data if nothing exists
            characters = [
                {
                    id: 1,
                    name: "Personagem Exemplo",
                    avatar: "https://via.placeholder.com/120",
                    poder: 10,
                    habilidade: 8,
                    resistencia: 12,
                    pontosVida: 60,
                    pontosMana: 40,
                    pontosAcao: 10
                }
            ];
            saveCharacters();
            renderCharacters();
        }
    }
}

// Save characters to JSON (using localStorage as fallback since we can't write to files directly)
function saveCharacters() {
    localStorage.setItem('rpg-characters', JSON.stringify(characters));
    // Note: In a real scenario, you'd need a backend to save to JSON file
    // For now, we'll use localStorage as the primary storage
}

// Load from localStorage on page load
function loadFromLocalStorage() {
    const saved = localStorage.getItem('rpg-characters');
    if (saved) {
        try {
            characters = JSON.parse(saved);
            ensureBattlefieldPositions();
            renderCharacters();
        } catch (error) {
            console.error('Error loading from localStorage:', error);
        }
    }
}

// Render all characters
function renderCharacters() {
    const container = document.getElementById('characters-container');
    container.innerHTML = '';

    // Sort by initiative if in combat mode (highest first)
    let sortedCharacters = [...characters];
    if (combatMode) {
        sortedCharacters.sort((a, b) => {
            const initA = a.iniciativa || 0;
            const initB = b.iniciativa || 0;
            return initB - initA; // Highest first
        });
    }

    sortedCharacters.forEach((character, index) => {
        const isCurrentTurn = combatMode && index === 0; // First card is current turn
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
    
    // Calculate max values
    const maxVida = character.resistencia * 5;
    const maxMana = character.habilidade * 5;
    const maxAcao = character.poder;
    
    // Ensure current values don't exceed max
    character.pontosVida = Math.min(character.pontosVida || maxVida, maxVida);
    character.pontosMana = Math.min(character.pontosMana || maxMana, maxMana);
    character.pontosAcao = Math.min(character.pontosAcao || maxAcao, maxAcao);
    
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
    
    // Format values based on hidden flag
    const vidaDisplay = hiddenValues ? '?' : `${character.pontosVida} / ${maxVida}`;
    const manaDisplay = hiddenValues ? '?' : `${character.pontosMana} / ${maxMana}`;
    const acaoDisplay = hiddenValues ? '?' : `${character.pontosAcao} / ${maxAcao}`;
    const statsDisplay = hiddenValues ? 'P ? H ? R ?' : `P <span>${character.poder}</span> H <span>${character.habilidade}</span> R <span>${character.resistencia}</span>`;
    
    card.innerHTML = `
        <div class="character-header">
            <img src="${character.avatar || 'https://via.placeholder.com/120'}" 
                 alt="${character.name}" 
                 class="character-avatar"
                 data-character-id="${character.id}"
                 onerror="this.src='https://via.placeholder.com/120'">
            <div style="flex: 1;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div class="character-name">${character.name}</div>
                    <button class="delete-character-btn" onclick="deleteCharacter(${character.id})" title="Remover personagem">
                        🗑️
                    </button>
                </div>
                <div class="status-bars">
                    <div class="status-bar-container">
                        <div class="status-bar-label">
                            <span>Pontos de Vida</span>
                            <span>${vidaDisplay}</span>
                        </div>
                        <div class="status-bar" data-character-id="${character.id}" data-type="vida" data-max="${maxVida}">
                            <div class="status-bar-fill health" style="width: ${vidaPercent}%"></div>
                            ${hiddenValues ? '' : `<span class="status-bar-value">${character.pontosVida} / ${maxVida}</span>`}
                        </div>
                    </div>
                    <div class="status-bar-container">
                        <div class="status-bar-label">
                            <span>Pontos de Mana</span>
                            <span>${manaDisplay}</span>
                        </div>
                        <div class="status-bar" data-character-id="${character.id}" data-type="mana" data-max="${maxMana}">
                            <div class="status-bar-fill mana" style="width: ${manaPercent}%"></div>
                            ${hiddenValues ? '' : `<span class="status-bar-value">${character.pontosMana} / ${maxMana}</span>`}
                        </div>
                    </div>
                    <div class="status-bar-container">
                        <div class="status-bar-label">
                            <span>Pontos de Acao</span>
                            <span>${acaoDisplay}</span>
                        </div>
                        <div class="status-bar" data-character-id="${character.id}" data-type="acao" data-max="${maxAcao}">
                            <div class="status-bar-fill action" style="width: ${acaoPercent}%"></div>
                            ${hiddenValues ? '' : `<span class="status-bar-value">${character.pontosAcao} / ${maxAcao}</span>`}
                        </div>
                    </div>
                </div>
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
                   placeholder="0">
        </div>
        ` : ''}
        <div class="character-stats">
            ${statsDisplay}
        </div>
    `;
    
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

    ensureBattlefieldPositions();

    const sections = panel.querySelectorAll('.battlefield-section');
    sections.forEach((section) => {
        const dotsContainer = section.querySelector('.battlefield-dots');
        if (dotsContainer) {
            dotsContainer.innerHTML = '';
        }
    });

    const orderedCharacters = sortedCharacters && sortedCharacters.length ? sortedCharacters : [...characters];
    const currentTurnId = combatMode && orderedCharacters.length ? orderedCharacters[0].id : null;

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
        avatarImg.src = character.avatar || 'https://via.placeholder.com/120';
        avatarImg.alt = character.name;
        avatarImg.onerror = function() {
            this.src = 'https://via.placeholder.com/120';
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
        acao: 'Pontos de Acao'
    };
    
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    
    overlay.innerHTML = `
        <div class="modal">
            <div class="modal-title">Modificar ${typeNames[type]}</div>
            <div class="modal-hint">Digite +número para adicionar ou -número para subtrair (ex: +10, -5)</div>
            <input type="text" class="modal-input" id="value-input" placeholder="+10 ou -5" autofocus>
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
    
    // Validate input format
    const match = valueStr.match(/^([+-])(\d+)$/);
    if (!match) {
        alert('Formato inválido! Use +número ou -número (ex: +10, -5)');
        return;
    }
    
    const operator = match[1];
    const value = parseInt(match[2]);
    
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
    
    // Store old value to detect healing
    const oldValue = character[property];
    
    // Apply operation
    if (operator === '+') {
        character[property] = Math.min(character[property] + value, maxValue);
    } else {
        character[property] = Math.max(character[property] - value, 0);
    }
    
    // Check for different animation tris
    const wasHealed = type === 'vida' && operator === '+' && character[property] > oldValue;
    const healthLost = type === 'vida' && operator === '-' && character[property] < oldValue;
    const manaSpent = type === 'mana' && operator === '-' && character[property] < oldValue;
    const manaRecovered = type === 'mana' && operator === '+' && character[property] > oldValue;
    
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
        character.avatar = 'https://via.placeholder.com/120';
    }
    
    saveCharacters();
    renderCharacters();
    closeModal();
}

// Remove avatar (reset to default)
function removeAvatar(characterId) {
    const character = characters.find(c => c.id === characterId);
    if (!character) return;
    
    character.avatar = 'https://via.placeholder.com/80';
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
                <label>URL do Avatar</label>
                <input type="text" class="modal-input" id="char-avatar" placeholder="https://... ou deixe vazio para padrão">
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
                    <input type="number" class="modal-input" id="char-poder" placeholder="10" min="1" value="10">
                </div>
                <div class="form-group">
                    <label>Habilidade</label>
                    <input type="number" class="modal-input" id="char-habilidade" placeholder="8" min="1" value="8">
                </div>
                <div class="form-group">
                    <label>Resistência</label>
                    <input type="number" class="modal-input" id="char-resistencia" placeholder="12" min="1" value="12">
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
    const poder = parseInt(document.getElementById('char-poder').value) || 10;
    const habilidade = parseInt(document.getElementById('char-habilidade').value) || 8;
    const resistencia = parseInt(document.getElementById('char-resistencia').value) || 12;
    
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
        avatar: avatar || 'https://via.placeholder.com/120',
        type: type,
        hiddenValues: hiddenValues,
        battlefieldSection: defaultBattlefieldSection,
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
    combatMode = !combatMode;
    updateCombatModeUI();
    renderCharacters();
}

function updateCombatModeUI() {
    const combatBtn = document.getElementById('combat-toggle');
    const passarTurnoBtn = document.getElementById('passar-turno-btn');
    const battlefieldPanel = document.getElementById('battlefield-panel');
    
    if (combatMode) {
        combatBtn.classList.add('active');
        passarTurnoBtn.style.display = 'block';
        if (battlefieldPanel) {
            battlefieldPanel.classList.add('active');
        }
    } else {
        combatBtn.classList.remove('active');
        passarTurnoBtn.style.display = 'none';
        if (battlefieldPanel) {
            battlefieldPanel.classList.remove('active');
        }
    }
}

function updateInitiative(characterId, value) {
    const character = characters.find(c => c.id === characterId);
    if (character) {
        character.iniciativa = parseInt(value) || 0;
        saveCharacters();
        renderCharacters();
    }
}

function passarTurno() {
    if (!combatMode) return;
    
    // Sort characters by initiative
    const sortedCharacters = [...characters].sort((a, b) => {
        const initA = a.iniciativa || 0;
        const initB = b.iniciativa || 0;
        return initB - initA;
    });
    
    if (sortedCharacters.length === 0) return;
    
    // Get the top character (highest initiative)
    const topCharacter = sortedCharacters[0];
    
    // Move top character to bottom by setting its initiative to lowest - 1
    const initiatives = sortedCharacters.map(c => c.iniciativa || 0);
    const minInitiative = Math.min(...initiatives);
    topCharacter.iniciativa = minInitiative - 1;
    
    // Save first
    saveCharacters();
    
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

// Make functions globally available for onclick handlers
window.closeModal = closeModal;
window.applyValue = applyValue;
window.exportToJSON = exportToJSON;
window.showAddCharacterModal = showAddCharacterModal;
window.addCharacter = addCharacter;
window.deleteCharacter = deleteCharacter;
window.showAvatarModal = showAvatarModal;
window.updateAvatar = updateAvatar;
window.removeAvatar = removeAvatar;
window.toggleCombatMode = toggleCombatMode;
window.updateInitiative = updateInitiative;
window.passarTurno = passarTurno;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadCharacters();
    setupBattlefieldDragAndDrop();
});
