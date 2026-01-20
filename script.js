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
                            <span>Pontos de Ação</span>
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
                   placeholder="0"
                   ${preparationPhase ? '' : 'readonly'}>
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
    if (combatMode && !preparationPhase) {
        // If in active combat, exit combat mode
        combatMode = false;
        preparationPhase = false;
        // Clean up turn order (but keep original iniciativa)
        characters.forEach(char => {
            delete char.turnOrder;
        });
    } else if (combatMode && preparationPhase) {
        // If in preparation phase, exit to normal mode
        combatMode = false;
        preparationPhase = false;
        // Clean up turn order
        characters.forEach(char => {
            delete char.turnOrder;
            delete char.iniciativaOriginal;
        });
    } else {
        // Enter preparation phase
        combatMode = true;
        preparationPhase = true;
    }
    saveCharacters();
    updateCombatModeUI();
    renderCharacters();
}

function startCombat() {
    // End preparation phase and start actual combat
    preparationPhase = false;
    
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
    if (attributeValue <= 0) {
        alert('Por favor, selecione um personagem e atributo ou insira um valor válido para o atributo.');
        return;
    }
    
    // Calculate final attribute value (base + modifier)
    const finalAttributeValue = attributeValue + modifier;
    
    if (finalAttributeValue <= 0) {
        alert('O valor final do atributo (atributo + modificador) deve ser maior que zero.');
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
window.exportToJSON = exportToJSON;
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
    loadCharacters();
    setupBattlefieldDragAndDrop();
});
