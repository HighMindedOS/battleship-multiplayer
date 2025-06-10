// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyC2Vz48b_VROP3g3JaaMZI4CcEl8neeMuM",
    authDomain: "realtime-database-aktivieren.firebaseapp.com",
    databaseURL: "https://realtime-database-aktivieren-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "realtime-database-aktivieren",
    storageBucket: "realtime-database-aktivieren.firebasestorage.app",
    messagingSenderId: "921607081725",
    appId: "1:921607081725:web:7630f400a518ab9507f894",
    measurementId: "G-TKN9TP77G3"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Test database connection
database.ref('.info/connected').on('value', (snapshot) => {
    updateConnectionStatus(snapshot.val() === true);
});

// Game State
const gameState = {
    currentScreen: 'lobby',
    playerName: '',
    playerId: null,
    lobbyId: null,
    lobbyRef: null,
    isHost: false,
    gamePhase: 'waiting',
    currentTurn: null,
    isMyTurn: false,
    hasShot: false,
    waitingForExtraShot: false,
    currentBoardView: 'enemy', // 'enemy' or 'player'
    
    // Ship Configuration
    shipTypes: [
        { name: 'Träger', size: 5, count: 1, icon: '🚢' },
        { name: 'Schlachtschiff', size: 4, count: 1, icon: '⚓' },
        { name: 'Kreuzer', size: 3, count: 1, icon: '🛥️' },
        { name: 'U-Boot', size: 3, count: 1, icon: '🚤' },
        { name: 'Zerstörer', size: 2, count: 1, icon: '⛵' }
    ],
    
    // Game Data
    myBoard: Array(10).fill(null).map(() => Array(10).fill('water')),
    enemyBoard: Array(10).fill(null).map(() => Array(10).fill('unknown')),
    myShips: [],
    enemyShips: [],
    enemyId: null,
    
    // Placement Data
    selectedShip: null,
    shipOrientation: 'horizontal',
    placedShips: [],
    
    // Energy System
    energy: 0,
    maxEnergy: 10,
    
    // Powerup State
    activePowerup: null,
    powerupMode: null,
    torpedoDirection: 'top',
    
    // Mine and Radar tracking
    myMines: [],
    enemyMines: [],
    radarScans: [],
    triggeredMines: [],
    
    // Stats
    shots: 0,
    hits: 0,
    sunkShips: 0,
    minesPlaced: 0,
    minesHit: 0,
    powerupsUsed: 0,
    
    // Track enemy sunk ships
    enemySunkShips: {},
    
    // Audio
    volume: 0.5,
    sounds: {
        hit: new Audio('sounds/hit.mp3'),
        miss: new Audio('sounds/miss.mp3'),
        sunk: new Audio('sounds/sunk.mp3'),
        turn: new Audio('sounds/turn.mp3')
    }
};

// Initialize sounds with error handling
function initializeSounds() {
    const soundFiles = {
        hit: 'sounds/hit.mp3',
        miss: 'sounds/miss.mp3',
        sunk: 'sounds/sunk.mp3',
        turn: 'sounds/turn.mp3'
    };
    
    gameState.sounds = {};
    
    for (const [key, path] of Object.entries(soundFiles)) {
        const audio = new Audio(path);
        audio.volume = gameState.volume;
        
        audio.onerror = () => {
            console.warn(`Sound file not found: ${path}`);
            gameState.sounds[key] = new Audio();
        };
        
        gameState.sounds[key] = audio;
    }
}

// Preload all sounds
function preloadSounds() {
    Object.values(gameState.sounds).forEach(sound => {
        if (sound.src) {
            sound.load();
        }
    });
}

// DOM Elements
const screens = {
    lobby: document.getElementById('lobbyScreen'),
    waiting: document.getElementById('waitingScreen'),
    placement: document.getElementById('placementScreen'),
    game: document.getElementById('gameScreen'),
    gameover: document.getElementById('gameOverScreen')
};

// Audio Helper Functions
function playSound(soundName) {
    const sound = gameState.sounds[soundName];
    if (sound && sound.readyState >= 2) {
        sound.currentTime = 0;
        sound.volume = gameState.volume;
        
        const clone = sound.cloneNode();
        clone.volume = gameState.volume;
        clone.play().catch(e => console.log('Sound play failed:', e));
    }
}

function updateVolume(value) {
    gameState.volume = value / 100;
    Object.values(gameState.sounds).forEach(sound => {
        if (sound) {
            sound.volume = gameState.volume;
        }
    });
    
    const volumeValue = document.getElementById('volumeValue');
    if (volumeValue) {
        volumeValue.textContent = value + '%';
    }
}

// Utility Functions
function generateLobbyCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function showScreen(screenName) {
    Object.keys(screens).forEach(name => {
        if (screens[name]) {
            screens[name].classList.toggle('active', name === screenName);
        }
    });
    gameState.currentScreen = screenName;
    
    if (screenName === 'game') {
        document.body.classList.add('in-game');
    } else {
        document.body.classList.remove('in-game', 'player-turn', 'enemy-turn', 'victory');
    }
}

function showNotification(message, type = 'info') {
    const notifications = document.getElementById('notifications');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    notifications.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function updateConnectionStatus(connected) {
    const statusDots = document.querySelectorAll('.status-dot');
    const statusTexts = document.querySelectorAll('.status-text');
    
    statusDots.forEach(dot => {
        if (connected) {
            dot.classList.add('connected');
        } else {
            dot.classList.remove('connected');
        }
    });
    
    statusTexts.forEach(text => {
        text.textContent = connected ? 'Verbunden' : 'Offline';
    });
}

// Settings Popup
function showSettingsPopup() {
    const popup = document.getElementById('settingsPopup');
    if (popup) {
        popup.classList.add('active');
    }
}

function hideSettingsPopup() {
    const popup = document.getElementById('settingsPopup');
    if (popup) {
        popup.classList.remove('active');
    }
}

// Board View Toggle Functions
function toggleBoardView() {
    if (gameState.currentBoardView === 'enemy') {
        showPlayerBoard();
    } else {
        showEnemyBoard();
    }
}

function showEnemyBoard() {
    gameState.currentBoardView = 'enemy';
    document.getElementById('enemyBoardSection').style.display = 'flex';
    document.getElementById('playerBoardSection').style.display = 'none';
}

function showPlayerBoard() {
    gameState.currentBoardView = 'player';
    document.getElementById('playerBoardSection').style.display = 'flex';
    document.getElementById('enemyBoardSection').style.display = 'none';
}

// Grid Creation Functions
function createGrid(containerId, isEnemy = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    // Create header row
    container.appendChild(createGridCell('', true));
    for (let i = 0; i < 10; i++) {
        container.appendChild(createGridCell(String.fromCharCode(65 + i), true));
    }
    
    // Create grid cells
    for (let row = 0; row < 10; row++) {
        container.appendChild(createGridCell((row + 1).toString(), true));
        
        for (let col = 0; col < 10; col++) {
            const cell = createGridCell('', false);
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            if (isEnemy) {
                cell.classList.add('enemy-cell');
                cell.addEventListener('click', () => handleEnemyCellClick(row, col));
            }
            
            container.appendChild(cell);
        }
    }
}

function createGridCell(content, isHeader) {
    const cell = document.createElement('div');
    cell.className = isHeader ? 'grid-cell grid-header' : 'grid-cell';
    cell.textContent = content;
    return cell;
}

// Energy System
function updateEnergy(amount) {
    gameState.energy = Math.max(0, Math.min(gameState.maxEnergy, gameState.energy + amount));
    updateEnergyDisplay();
    updatePowerupButtons();
}

function updateEnergyDisplay() {
    const energyText = document.getElementById('energyText');
    if (energyText) {
        energyText.textContent = `${gameState.energy}/${gameState.maxEnergy}`;
    }
}

function updatePowerupButtons() {
    const powerupButtons = document.querySelectorAll('.powerup-btn');
    powerupButtons.forEach(btn => {
        const cost = parseInt(btn.dataset.cost);
        btn.disabled = gameState.energy < cost || !gameState.isMyTurn;
        
        if (gameState.activePowerup === btn.id) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// Powerup Functions
function activatePowerup(powerupType) {
    const costs = {
        mine: 2,
        radar: 3,
        cannon: 5,
        torpedo: 9
    };
    
    if (gameState.energy < costs[powerupType]) {
        showNotification('Nicht genug Energie!', 'error');
        return;
    }
    
    // Deactivate if clicking same powerup
    if (gameState.powerupMode === powerupType) {
        deactivatePowerup();
        return;
    }
    
    gameState.powerupMode = powerupType;
    gameState.activePowerup = `${powerupType}Btn`;
    updatePowerupButtons();
    
    // Clear any existing previews
    clearAllPreviews();
    
    // Add appropriate event listeners based on powerup
    if (powerupType === 'mine') {
        // Switch to player board for mine placement
        showPlayerBoard();
        addMinePlacementListeners();
        showNotification('Platziere eine Mine auf deinem Spielfeld', 'info');
    } else if (powerupType === 'torpedo') {
        showNotification('Nutze Pfeiltasten für Richtung', 'info');
        addTorpedoListeners();
    }
}

function deactivatePowerup() {
    gameState.powerupMode = null;
    gameState.activePowerup = null;
    updatePowerupButtons();
    clearAllPreviews();
    removePowerupListeners();
    
    // Return to appropriate board view
    if (gameState.isMyTurn) {
        showEnemyBoard();
    } else {
        showPlayerBoard();
    }
}

function addMinePlacementListeners() {
    const playerGrid = document.getElementById('playerGrid');
    if (playerGrid) {
        playerGrid.addEventListener('mouseover', handleMinePlacementHover);
        playerGrid.addEventListener('click', handleMinePlacement);
    }
}

function removePowerupListeners() {
    const playerGrid = document.getElementById('playerGrid');
    if (playerGrid) {
        playerGrid.removeEventListener('mouseover', handleMinePlacementHover);
        playerGrid.removeEventListener('click', handleMinePlacement);
    }
    
    document.removeEventListener('keydown', handleTorpedoDirection);
}

function handleMinePlacementHover(e) {
    if (!e.target.classList.contains('grid-cell') || e.target.classList.contains('grid-header')) {
        return;
    }
    
    clearAllPreviews();
    
    const row = parseInt(e.target.dataset.row);
    const col = parseInt(e.target.dataset.col);
    
    if (canPlaceMine(row, col)) {
        e.target.classList.add('preview');
    } else {
        e.target.classList.add('invalid');
    }
}

function handleMinePlacement(e) {
    if (!e.target.classList.contains('grid-cell') || e.target.classList.contains('grid-header')) {
        return;
    }
    
    const row = parseInt(e.target.dataset.row);
    const col = parseInt(e.target.dataset.col);
    
    if (!canPlaceMine(row, col)) {
        showNotification('Hier kann keine Mine platziert werden!', 'error');
        return;
    }
    
    placeMine(row, col);
}

function canPlaceMine(row, col) {
    // Can't place on ships or existing mines
    return gameState.myBoard[row][col] === 'water' && 
           !gameState.myMines.some(mine => mine.row === row && mine.col === col) &&
           !gameState.triggeredMines.some(mine => mine.row === row && mine.col === col);
}

function placeMine(row, col) {
    // Deduct energy
    updateEnergy(-2);
    
    // Add mine to tracking
    gameState.myMines.push({ row, col });
    gameState.minesPlaced++;
    
    // Update visual
    const cell = document.querySelector(`#playerGrid .grid-cell[data-row="${row}"][data-col="${col}"]`);
    if (cell) {
        cell.classList.add('mine');
    }
    
    // Update Firebase
    if (gameState.lobbyRef) {
        gameState.lobbyRef.child(`players/${gameState.playerId}/mines`).set(gameState.myMines);
        
        // Notify enemy to update their radar scans
        gameState.lobbyRef.child('mineUpdate').set({
            playerId: gameState.playerId,
            timestamp: Date.now()
        });
    }
    
    // Update stats
    updateStats();
    
    // Deactivate powerup
    deactivatePowerup();
    showNotification('Mine platziert!', 'success');
    
    // Increment powerups used
    gameState.powerupsUsed++;
}

// Add torpedo direction handling
function addTorpedoListeners() {
    document.addEventListener('keydown', handleTorpedoDirection);
}

function handleTorpedoDirection(e) {
    if (gameState.powerupMode !== 'torpedo') return;
    
    const directions = {
        'ArrowUp': 'top',
        'ArrowDown': 'bottom',
        'ArrowLeft': 'left',
        'ArrowRight': 'right'
    };
    
    if (directions[e.key]) {
        e.preventDefault();
        gameState.torpedoDirection = directions[e.key];
        showNotification(`Torpedo-Richtung: ${getDirectionName(gameState.torpedoDirection)}`, 'info');
        updateTorpedoPreview();
    }
}

function getDirectionName(direction) {
    const names = {
        'top': 'Von oben',
        'bottom': 'Von unten',
        'left': 'Von links',
        'right': 'Von rechts'
    };
    return names[direction];
}

function updateTorpedoPreview() {
    const enemyGrid = document.getElementById('enemyGrid');
    if (!enemyGrid) return;
    
    clearAllPreviews();
    
    const hoverCell = enemyGrid.querySelector('.grid-cell:hover');
    if (hoverCell && !hoverCell.classList.contains('grid-header')) {
        const row = parseInt(hoverCell.dataset.row);
        const col = parseInt(hoverCell.dataset.col);
        showTorpedoPreview(row, col);
    }
}

function showTorpedoPreview(targetRow, targetCol) {
    const cells = getTorpedoPath(targetRow, targetCol);
    cells.forEach(({row, col}) => {
        const cell = document.querySelector(`#enemyGrid .grid-cell[data-row="${row}"][data-col="${col}"]`);
        if (cell) {
            cell.classList.add('torpedo-preview');
        }
    });
}

function getTorpedoPath(targetRow, targetCol) {
    const path = [];
    
    switch (gameState.torpedoDirection) {
        case 'top':
            for (let row = 0; row <= targetRow; row++) {
                path.push({row, col: targetCol});
            }
            break;
        case 'bottom':
            for (let row = 9; row >= targetRow; row--) {
                path.push({row, col: targetCol});
            }
            break;
        case 'left':
            for (let col = 0; col <= targetCol; col++) {
                path.push({row: targetRow, col});
            }
            break;
        case 'right':
            for (let col = 9; col >= targetCol; col--) {
                path.push({row: targetRow, col});
            }
            break;
    }
    
    return path;
}

// Clear all preview highlights
function clearAllPreviews() {
    document.querySelectorAll('.preview, .invalid, .cannon-preview, .torpedo-preview').forEach(cell => {
        cell.classList.remove('preview', 'invalid', 'cannon-preview', 'torpedo-preview');
    });
}

// Lobby Functions
function createLobby() {
    const playerName = document.getElementById('playerName').value.trim();
    
    if (!playerName) {
        showNotification('Bitte gib einen Namen ein!', 'error');
        return;
    }
    
    gameState.playerName = playerName;
    gameState.playerId = Date.now().toString();
    gameState.lobbyId = generateLobbyCode();
    gameState.isHost = true;
    
    // Create lobby in Firebase
    gameState.lobbyRef = database.ref(`lobbies/${gameState.lobbyId}`);
    
    const lobbyData = {
        created: firebase.database.ServerValue.TIMESTAMP,
        host: gameState.playerId,
        players: {
            [gameState.playerId]: {
                name: playerName,
                ready: false,
                board: null,
                ships: [],
                mines: [],
                energy: 0,
                shots: []
            }
        },
        gameState: 'waiting',
        currentTurn: null,
        winner: null,
        radarScans: []
    };
    
    gameState.lobbyRef.set(lobbyData).then(() => {
        setupLobbyListeners();
        showScreen('waiting');
        document.getElementById('lobbyCodeDisplay').textContent = gameState.lobbyId;
        showNotification('Lobby erstellt! Teile den Code mit deinem Gegner.', 'success');
    }).catch(error => {
        showNotification('Fehler beim Erstellen der Lobby: ' + error.message, 'error');
    });
}

function joinLobby() {
    const playerName = document.getElementById('joinPlayerName').value.trim();
    const lobbyCode = document.getElementById('lobbyCode').value.trim().toUpperCase();
    
    if (!playerName || !lobbyCode) {
        showNotification('Bitte fülle alle Felder aus!', 'error');
        return;
    }
    
    gameState.playerName = playerName;
    gameState.playerId = Date.now().toString();
    gameState.lobbyId = lobbyCode;
    gameState.isHost = false;
    
    // Check if lobby exists
    gameState.lobbyRef = database.ref(`lobbies/${gameState.lobbyId}`);
    
    gameState.lobbyRef.once('value').then(snapshot => {
        if (!snapshot.exists()) {
            showNotification('Lobby nicht gefunden!', 'error');
            return;
        }
        
        const lobbyData = snapshot.val();
        const playerCount = Object.keys(lobbyData.players).length;
        
        if (playerCount >= 2) {
            showNotification('Lobby ist voll!', 'error');
            return;
        }
        
        // Join lobby
        gameState.lobbyRef.child(`players/${gameState.playerId}`).set({
            name: playerName,
            ready: false,
            board: null,
            ships: [],
            mines: [],
            energy: 0,
            shots: []
        }).then(() => {
            setupLobbyListeners();
            showScreen('waiting');
            document.getElementById('lobbyCodeDisplay').textContent = gameState.lobbyId;
            showNotification('Lobby beigetreten!', 'success');
        });
    }).catch(error => {
        showNotification('Fehler beim Beitreten: ' + error.message, 'error');
    });
}

function setupLobbyListeners() {
    // Listen for player changes
    gameState.lobbyRef.child('players').on('value', snapshot => {
        const players = snapshot.val() || {};
        updatePlayersList(players);
        
        // Store enemy name and ID for later use
        const playerIds = Object.keys(players);
        const enemyId = playerIds.find(id => id !== gameState.playerId);
        if (enemyId && players[enemyId]) {
            gameState.enemyName = players[enemyId].name;
            gameState.enemyId = enemyId;
        }
        
        // Check if both players are present
        if (Object.keys(players).length === 2 && gameState.currentScreen === 'waiting') {
            setTimeout(() => {
                showScreen('placement');
                initializePlacement();
            }, 1000);
        }
    });
    
    // Listen for game state changes
    gameState.lobbyRef.child('gameState').on('value', snapshot => {
        const state = snapshot.val();
        
        if (state === 'playing' && gameState.currentScreen !== 'game') {
            showScreen('game');
            initializeGame();
        } else if (state === 'gameover' && gameState.currentScreen !== 'gameover') {
            handleGameOver();
        }
    });
    
    // Listen for turn changes
    gameState.lobbyRef.child('currentTurn').on('value', snapshot => {
        gameState.currentTurn = snapshot.val();
        gameState.isMyTurn = gameState.currentTurn === gameState.playerId;
        updateTurnIndicator();
    });
    
    // Listen for radar scans
    gameState.lobbyRef.child('radarScans').on('child_added', snapshot => {
        const scan = snapshot.val();
        if (scan && gameState.currentScreen === 'game') {
            handleRadarScan(scan);
        }
    });
    
    // Listen for mine updates
    gameState.lobbyRef.child('mineUpdate').on('value', snapshot => {
        const update = snapshot.val();
        if (update && update.playerId !== gameState.playerId && gameState.currentScreen === 'game') {
            updateRadarScansAfterMineChange();
        }
    });
    
    // Handle disconnection
    gameState.lobbyRef.child(`players/${gameState.playerId}`).onDisconnect().remove();
}

function updatePlayersList(players) {
    const playersList = document.getElementById('playersList');
    if (!playersList) return;
    
    playersList.innerHTML = '';
    
    let index = 0;
    for (const [id, player] of Object.entries(players)) {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        playerItem.innerHTML = `
            <span class="player-icon">${id === gameState.playerId ? '👤' : '🎮'}</span>
            <span class="player-name">${player.name} ${id === gameState.playerId ? '(Du)' : ''}</span>
            ${player.ready ? '<span style="color: var(--orange-color)">✅ Bereit</span>' : ''}
        `;
        playersList.appendChild(playerItem);
        index++;
    }
    
    // Add empty slots
    for (let i = index; i < 2; i++) {
        const emptyItem = document.createElement('div');
        emptyItem.className = 'player-item';
        emptyItem.innerHTML = `
            <span class="player-icon">👤</span>
            <span class="player-name">Warte auf Spieler ${i + 1}...</span>
        `;
        playersList.appendChild(emptyItem);
    }
}

function leaveLobby() {
    if (gameState.lobbyRef && gameState.playerId) {
        gameState.lobbyRef.child(`players/${gameState.playerId}`).remove();
        
        // If host leaves, delete the entire lobby
        if (gameState.isHost) {
            gameState.lobbyRef.remove();
        }
    }
    
    // Reset game state
    gameState.lobbyId = null;
    gameState.lobbyRef = null;
    gameState.playerId = null;
    gameState.isHost = false;
    
    showScreen('lobby');
    showNotification('Lobby verlassen', 'info');
}

// Ship Placement Functions
function initializePlacement() {
    createGrid('placementGrid');
    renderAvailableShips();
    
    // Add keyboard listener for rotation
    document.addEventListener('keydown', handleKeyPress);
    
    // Setup placement grid listeners
    const placementGrid = document.getElementById('placementGrid');
    if (placementGrid) {
        placementGrid.addEventListener('mouseover', handlePlacementHover);
        placementGrid.addEventListener('mouseout', clearPlacementPreview);
        placementGrid.addEventListener('click', handlePlacementClick);
    }
}

function renderAvailableShips() {
    const container = document.getElementById('availableShips');
    if (!container) return;
    
    container.innerHTML = '';
    
    gameState.shipTypes.forEach((shipType, index) => {
        const shipItem = document.createElement('div');
        const isPlaced = gameState.placedShips.some(ship => ship.type === shipType.name);
        
        shipItem.className = `ship-item ${isPlaced ? 'placed' : ''} ${gameState.selectedShip === index ? 'selected' : ''}`;
        shipItem.innerHTML = `
            <div>
                <span>${shipType.icon}</span>
                <span>${shipType.name} (${shipType.size})</span>
            </div>
            <div class="ship-preview">
                ${Array(shipType.size).fill('<div class="ship-cell"></div>').join('')}
            </div>
        `;
        
        if (!isPlaced) {
            shipItem.addEventListener('click', () => selectShip(index));
        }
        
        container.appendChild(shipItem);
    });
}

function selectShip(index) {
    gameState.selectedShip = index;
    renderAvailableShips();
}

function handleKeyPress(e) {
    if (e.key.toLowerCase() === 'r' && gameState.currentScreen === 'placement') {
        rotateShip();
    }
}

function rotateShip() {
    gameState.shipOrientation = gameState.shipOrientation === 'horizontal' ? 'vertical' : 'horizontal';
    showNotification(`Ausrichtung: ${gameState.shipOrientation === 'horizontal' ? 'Horizontal' : 'Vertikal'}`, 'info');
}

function handlePlacementHover(e) {
    if (!e.target.classList.contains('grid-cell') || e.target.classList.contains('grid-header')) {
        return;
    }
    
    if (gameState.selectedShip === null) return;
    
    const row = parseInt(e.target.dataset.row);
    const col = parseInt(e.target.dataset.col);
    
    showPlacementPreview(row, col);
}

function showPlacementPreview(row, col) {
    clearPlacementPreview();
    
    const ship = gameState.shipTypes[gameState.selectedShip];
    const positions = getShipPositions(row, col, ship.size, gameState.shipOrientation);
    const isValid = canPlaceShip(positions);
    
    positions.forEach(pos => {
        const cell = document.querySelector(`#placementGrid .grid-cell[data-row="${pos.row}"][data-col="${pos.col}"]`);
        if (cell) {
            cell.classList.add(isValid ? 'preview' : 'invalid');
        }
    });
}

function clearPlacementPreview() {
    document.querySelectorAll('.preview, .invalid').forEach(cell => {
        cell.classList.remove('preview', 'invalid');
    });
}

function handlePlacementClick(e) {
    if (!e.target.classList.contains('grid-cell') || e.target.classList.contains('grid-header')) {
        return;
    }
    
    if (gameState.selectedShip === null) {
        showNotification('Wähle zuerst ein Schiff aus!', 'warning');
        return;
    }
    
    const row = parseInt(e.target.dataset.row);
    const col = parseInt(e.target.dataset.col);
    
    placeShip(row, col);
}

function placeShip(row, col) {
    const ship = gameState.shipTypes[gameState.selectedShip];
    const positions = getShipPositions(row, col, ship.size, gameState.shipOrientation);
    
    if (!canPlaceShip(positions)) {
        showNotification('Hier kann kein Schiff platziert werden!', 'error');
        return;
    }
    
    // Place ship on board
    positions.forEach(pos => {
        gameState.myBoard[pos.row][pos.col] = 'ship';
        const cell = document.querySelector(`#placementGrid .grid-cell[data-row="${pos.row}"][data-col="${pos.col}"]`);
        if (cell) {
            cell.classList.add('ship');
        }
    });
    
    // Add to placed ships
    gameState.placedShips.push({
        type: ship.name,
        size: ship.size,
        positions: positions,
        hits: 0,
        sunk: false
    });
    
    // Reset selection
    gameState.selectedShip = null;
    renderAvailableShips();
    
    // Check if all ships are placed
    if (gameState.placedShips.length === gameState.shipTypes.length) {
        const readyBtn = document.getElementById('readyBtn');
        if (readyBtn) {
            readyBtn.disabled = false;
        }
        showNotification('Alle Schiffe platziert! Klicke auf "Ready"!', 'success');
    }
}

function getShipPositions(row, col, size, orientation) {
    const positions = [];
    
    for (let i = 0; i < size; i++) {
        if (orientation === 'horizontal') {
            positions.push({ row: row, col: col + i });
        } else {
            positions.push({ row: row + i, col: col });
        }
    }
    
    return positions;
}

function canPlaceShip(positions) {
    for (const pos of positions) {
        // Check bounds
        if (pos.row < 0 || pos.row >= 10 || pos.col < 0 || pos.col >= 10) {
            return false;
        }
        
        // Check if cell is already occupied
        if (gameState.myBoard[pos.row][pos.col] !== 'water') {
            return false;
        }
        
        // Check adjacent cells (ships can't touch)
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const adjRow = pos.row + dr;
                const adjCol = pos.col + dc;
                
                if (adjRow >= 0 && adjRow < 10 && adjCol >= 0 && adjCol < 10) {
                    if (gameState.myBoard[adjRow][adjCol] === 'ship') {
                        const isPartOfCurrentShip = positions.some(p => p.row === adjRow && p.col === adjCol);
                        if (!isPartOfCurrentShip) {
                            return false;
                        }
                    }
                }
            }
        }
    }
    
    return true;
}

function randomPlacement() {
    clearBoard();
    gameState.placedShips = [];
    
    for (let i = 0; i < gameState.shipTypes.length; i++) {
        const ship = gameState.shipTypes[i];
        let placed = false;
        let attempts = 0;
        
        while (!placed && attempts < 1000) {
            const row = Math.floor(Math.random() * 10);
            const col = Math.floor(Math.random() * 10);
            const orientation = Math.random() < 0.5 ? 'horizontal' : 'vertical';
            
            gameState.shipOrientation = orientation;
            gameState.selectedShip = i;
            
            const positions = getShipPositions(row, col, ship.size, orientation);
            
            if (canPlaceShip(positions)) {
                placeShip(row, col);
                placed = true;
            }
            
            attempts++;
        }
    }
    
    gameState.selectedShip = null;
    showNotification('Schiffe zufällig platziert!', 'success');
}

function clearBoard() {
    gameState.myBoard = Array(10).fill(null).map(() => Array(10).fill('water'));
    gameState.placedShips = [];
    
    document.querySelectorAll('#placementGrid .grid-cell.ship').forEach(cell => {
        cell.classList.remove('ship');
    });
    
    const readyBtn = document.getElementById('readyBtn');
    if (readyBtn) {
        readyBtn.disabled = true;
    }
    renderAvailableShips();
}

function setPlayerReady() {
    if (gameState.placedShips.length !== gameState.shipTypes.length) {
        showNotification('Platziere zuerst alle Schiffe!', 'error');
        return;
    }
    
    // Save board to Firebase
    gameState.lobbyRef.child(`players/${gameState.playerId}`).update({
        ready: true,
        board: gameState.myBoard,
        ships: gameState.placedShips
    }).then(() => {
        showNotification('Bereit! Warte auf Gegner...', 'success');
        checkBothPlayersReady();
    });
}

function checkBothPlayersReady() {
    gameState.lobbyRef.child('players').once('value').then(snapshot => {
        const players = snapshot.val();
        const allReady = Object.values(players).every(player => player.ready);
        
        if (allReady && gameState.isHost) {
            // Start the game with coin flip
            const playerIds = Object.keys(players);
            const firstPlayer = playerIds[Math.floor(Math.random() * 2)];
            
            gameState.lobbyRef.update({
                gameState: 'playing',
                currentTurn: firstPlayer
            });
        }
    });
}

// Game Functions
function initializeGame() {
    createGrid('playerGrid');
    createGrid('enemyGrid', true);
    
    // Update player's board
    updatePlayerBoard();
    
    // Initialize ship status displays
    updateShipStatus();
    
    // Setup shot listeners
    setupShotListeners();
    
    // Initialize pending shots listener
    initializePendingShotsListener();
    
    // Update enemy name
    const enemyNameEl = document.getElementById('enemyName');
    if (enemyNameEl && gameState.enemyName) {
        enemyNameEl.textContent = gameState.enemyName;
    }
    
    // Setup enemy grid hover for powerups
    const enemyGrid = document.getElementById('enemyGrid');
    if (enemyGrid) {
        enemyGrid.addEventListener('mouseover', handleEnemyGridHover);
        enemyGrid.addEventListener('mouseout', clearAllPreviews);
    }
    
    // Restore mines from Firebase
    restoreMinesFromFirebase();
    
    // Setup radar listener
    setupRadarListener();
}

function restoreMinesFromFirebase() {
    gameState.lobbyRef.child(`players/${gameState.playerId}/mines`).once('value').then(snapshot => {
        const mines = snapshot.val();
        if (mines) {
            gameState.myMines = mines;
            // Restore visual representation
            mines.forEach(mine => {
                const cell = document.querySelector(`#playerGrid .grid-cell[data-row="${mine.row}"][data-col="${mine.col}"]`);
                if (cell) {
                    cell.classList.add('mine');
                }
            });
        }
    });
}

function handleEnemyGridHover(e) {
    if (!e.target.classList.contains('grid-cell') || e.target.classList.contains('grid-header')) {
        return;
    }
    
    if (!gameState.isMyTurn || !gameState.powerupMode) return;
    
    const row = parseInt(e.target.dataset.row);
    const col = parseInt(e.target.dataset.col);
    
    clearAllPreviews();
    
    switch (gameState.powerupMode) {
        case 'radar':
            showRadarPreview(row, col);
            break;
        case 'cannon':
            showCannonPreview(row, col);
            break;
        case 'torpedo':
            showTorpedoPreview(row, col);
            break;
    }
}

function showRadarPreview(centerRow, centerCol) {
    // Can only place on miss cells (not unknown or hit)
    if (gameState.enemyBoard[centerRow][centerCol] !== 'miss') {
        const cell = document.querySelector(`#enemyGrid .grid-cell[data-row="${centerRow}"][data-col="${centerCol}"]`);
        if (cell) cell.classList.add('invalid');
        return;
    }
    
    // Show 3x3 preview
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const r = centerRow + dr;
            const c = centerCol + dc;
            if (r >= 0 && r < 10 && c >= 0 && c < 10) {
                const cell = document.querySelector(`#enemyGrid .grid-cell[data-row="${r}"][data-col="${c}"]`);
                if (cell) {
                    cell.classList.add('preview');
                }
            }
        }
    }
}

function showCannonPreview(row, col) {
    // Show 2x2 preview
    for (let dr = 0; dr <= 1; dr++) {
        for (let dc = 0; dc <= 1; dc++) {
            const r = row + dr;
            const c = col + dc;
            if (r >= 0 && r < 10 && c >= 0 && c < 10) {
                const cell = document.querySelector(`#enemyGrid .grid-cell[data-row="${r}"][data-col="${c}"]`);
                if (cell) {
                    cell.classList.add('cannon-preview');
                }
            }
        }
    }
}

function setupShotListeners() {
    // Listen for shot results
    gameState.lobbyRef.child(`shotResults/${gameState.playerId}`).on('child_added', snapshot => {
        const result = snapshot.val();
        handleShotResult(result);
    });
}

function initializePendingShotsListener() {
    gameState.lobbyRef.child(`pendingShots/${gameState.playerId}`).on('child_added', snapshot => {
        const shot = snapshot.val();
        handleIncomingShot(shot);
        
        // Remove processed shot
        snapshot.ref.remove();
    });
}

function updatePlayerBoard() {
    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
            const cell = document.querySelector(`#playerGrid .grid-cell[data-row="${row}"][data-col="${col}"]`);
            if (cell && gameState.myBoard[row][col] === 'ship') {
                cell.classList.add('ship');
            }
        }
    }
}

function updateTurnIndicator() {
    const enemyGrid = document.getElementById('enemyGrid');
    const endTurnBtn = document.getElementById('endTurnBtn');
    
    if (!enemyGrid || !endTurnBtn) return;
    
    if (gameState.isMyTurn) {
        // Show enemy board when it's our turn
        showEnemyBoard();
        
        enemyGrid.classList.add('active');
        enemyGrid.classList.remove('disabled');
        enableEnemyGrid(true);
        
        // Add energy at turn start
        if (gameState.energy < gameState.maxEnergy && !gameState.waitingForExtraShot) {
            updateEnergy(1);
            showNotification('+1 Energie (Zugbeginn)', 'info');
        }
        
        // Reset shot status
        gameState.hasShot = false;
        gameState.waitingForExtraShot = false;
        endTurnBtn.disabled = true;
        
        // Update body border for player turn
        document.body.classList.add('player-turn');
        document.body.classList.remove('enemy-turn');
        
        // Play turn sound
        playSound('turn');
    } else {
        // Show player board when it's enemy's turn
        showPlayerBoard();
        
        enemyGrid.classList.remove('active');
        enemyGrid.classList.add('disabled');
        enableEnemyGrid(false);
        endTurnBtn.disabled = true;
        
        // Update body border for enemy turn
        document.body.classList.add('enemy-turn');
        document.body.classList.remove('player-turn');
    }
    
    updatePowerupButtons();
}

function enableEnemyGrid(enabled) {
    const enemyCells = document.querySelectorAll('#enemyGrid .grid-cell:not(.grid-header)');
    enemyCells.forEach(cell => {
        cell.style.pointerEvents = enabled ? 'auto' : 'none';
    });
}

function handleEnemyCellClick(row, col) {
    if (!gameState.isMyTurn) {
        showNotification('Nicht dein Zug!', 'warning');
        return;
    }
    
    // Handle powerup clicks
    if (gameState.powerupMode) {
        handlePowerupClick(row, col);
        return;
    }
    
    // Normal shot
    if (gameState.hasShot) {
        showNotification('Du hast bereits geschossen! Nutze Powerups oder beende deinen Zug.', 'warning');
        return;
    }
    
    if (gameState.enemyBoard[row][col] !== 'unknown') {
        showNotification('Bereits beschossen!', 'warning');
        return;
    }
    
    makeShot(row, col);
}

function handlePowerupClick(row, col) {
    switch (gameState.powerupMode) {
        case 'radar':
            placeRadar(row, col);
            break;
        case 'cannon':
            fireCannon(row, col);
            break;
        case 'torpedo':
            fireTorpedo(row, col);
            break;
    }
}

function makeShot(row, col) {
    // Disable grid while processing
    enableEnemyGrid(false);
    
    // Mark as shot
    gameState.hasShot = true;
    
    // Make the shot
    const shotId = Date.now().toString();
    const shotData = {
        row: row,
        col: col,
        shotId: shotId,
        shooterId: gameState.playerId,
        type: 'normal'
    };
    
    // Send shot to enemy
    gameState.lobbyRef.child(`pendingShots/${gameState.enemyId}/${shotId}`).set(shotData).then(() => {
        gameState.shots++;
        updateStats();
    });
}

function placeRadar(centerRow, centerCol) {
    if (gameState.enemyBoard[centerRow][centerCol] !== 'miss') {
        showNotification('Radar kann nur auf Fehlschüssen platziert werden!', 'error');
        return;
    }
    
    // Deduct energy
    updateEnergy(-3);
    gameState.powerupsUsed++;
    
    // Calculate scan value
    const positions = [];
    
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const r = centerRow + dr;
            const c = centerCol + dc;
            if (r >= 0 && r < 10 && c >= 0 && c < 10) {
                positions.push({row: r, col: c});
            }
        }
    }
    
    // Send radar request
    const radarData = {
        centerRow,
        centerCol,
        positions,
        playerId: gameState.playerId,
        timestamp: Date.now()
    };
    
    gameState.lobbyRef.child('radarScans').push(radarData);
    
    deactivatePowerup();
    showNotification('Radar-Scan gestartet...', 'info');
}

function handleRadarScan(scan) {
    if (scan.playerId === gameState.playerId) {
        // Our radar scan - wait for result
        return;
    }
    
    // Enemy radar scan on our board
    let count = 0;
    
    scan.positions.forEach(pos => {
        if (gameState.myBoard[pos.row][pos.col] === 'ship') {
            count++;
        }
        if (gameState.myMines.some(mine => mine.row === pos.row && mine.col === pos.col)) {
            count++;
        }
    });
    
    // Send result back
    gameState.lobbyRef.child(`radarResults/${scan.playerId}/${scan.timestamp}`).set({
        centerRow: scan.centerRow,
        centerCol: scan.centerCol,
        count: count,
        positions: scan.positions
    });
}

function updateRadarScansAfterMineChange() {
    // Re-calculate all radar scan values
    gameState.radarScans.forEach(scan => {
        // Request updated count from enemy
        const radarData = {
            centerRow: scan.centerRow,
            centerCol: scan.centerCol,
            positions: scan.positions,
            playerId: gameState.playerId,
            timestamp: Date.now(),
            isUpdate: true
        };
        
        gameState.lobbyRef.child('radarScans').push(radarData);
    });
}

function fireCannon(row, col) {
    // Check if all 2x2 cells are valid
    const targets = [];
    for (let dr = 0; dr <= 1; dr++) {
        for (let dc = 0; dc <= 1; dc++) {
            const r = row + dr;
            const c = col + dc;
            if (r >= 0 && r < 10 && c >= 0 && c < 10) {
                targets.push({row: r, col: c});
            }
        }
    }
    
    if (targets.length < 4) {
        showNotification('Geschütz muss vollständig auf dem Spielfeld sein!', 'error');
        return;
    }
    
    // Deduct energy
    updateEnergy(-5);
    gameState.powerupsUsed++;
    
    // Fire at each target sequentially
    fireCannonSequence(targets, 0);
    
    deactivatePowerup();
}

function fireCannonSequence(targets, index) {
    if (index >= targets.length) {
        // All shots fired
        updatePowerupButtons();
        return;
    }
    
    const target = targets[index];
    
    // Skip if already shot
    if (gameState.enemyBoard[target.row][target.col] !== 'unknown') {
        fireCannonSequence(targets, index + 1);
        return;
    }
    
    // Make shot
    const shotId = Date.now().toString() + '_' + index;
    const shotData = {
        row: target.row,
        col: target.col,
        shotId: shotId,
        shooterId: gameState.playerId,
        type: 'cannon'
    };
    
    gameState.lobbyRef.child(`pendingShots/${gameState.enemyId}/${shotId}`).set(shotData).then(() => {
        gameState.shots++;
        updateStats();
        
        // Wait before next shot
        setTimeout(() => {
            fireCannonSequence(targets, index + 1);
        }, 400);
    });
}

function fireTorpedo(row, col) {
    const path = getTorpedoPath(row, col);
    
    // Deduct energy
    updateEnergy(-9);
    gameState.powerupsUsed++;
    
    // Fire torpedo
    fireTorpedoSequence(path, 0);
    
    deactivatePowerup();
}

function fireTorpedoSequence(path, index) {
    if (index >= path.length) {
        // Torpedo finished
        updatePowerupButtons();
        return;
    }
    
    const target = path[index];
    
    // Check if we should stop (hit unshot mine or ship)
    if (gameState.enemyBoard[target.row][target.col] === 'unknown') {
        // Make shot
        const shotId = Date.now().toString() + '_torpedo_' + index;
        const shotData = {
            row: target.row,
            col: target.col,
            shotId: shotId,
            shooterId: gameState.playerId,
            type: 'torpedo',
            torpedoIndex: index,
            torpedoPath: path,
            torpedoDirection: gameState.torpedoDirection
        };
        
        gameState.lobbyRef.child(`pendingShots/${gameState.enemyId}/${shotId}`).set(shotData).then(() => {
            gameState.shots++;
            updateStats();
            
            // Create wave animation
            createTorpedoWave(target.row, target.col, gameState.torpedoDirection);
            
            // Continue after delay
            setTimeout(() => {
                // Check if we hit something that stops torpedo
                if (gameState.enemyBoard[target.row][target.col] === 'hit') {
                    // Stop torpedo
                    updatePowerupButtons();
                } else {
                    // Continue
                    fireTorpedoSequence(path, index + 1);
                }
            }, 400);
        });
    } else {
        // Skip already shot cells
        fireTorpedoSequence(path, index + 1);
    }
}

function createTorpedoWave(row, col, direction) {
    // Create wave effect on adjacent cells to the edge
    if (direction === 'top' || direction === 'bottom') {
        // Horizontal waves - from target to edges
        // Left side
        for (let c = col - 1; c >= 0; c--) {
            const cell = document.querySelector(`#enemyGrid .grid-cell[data-row="${row}"][data-col="${c}"]`);
            if (cell) {
                setTimeout(() => {
                    cell.classList.add('torpedo-wave');
                    setTimeout(() => {
                        cell.classList.remove('torpedo-wave');
                    }, 400);
                }, (col - c) * 50);
            }
        }
        // Right side
        for (let c = col + 1; c < 10; c++) {
            const cell = document.querySelector(`#enemyGrid .grid-cell[data-row="${row}"][data-col="${c}"]`);
            if (cell) {
                setTimeout(() => {
                    cell.classList.add('torpedo-wave');
                    setTimeout(() => {
                        cell.classList.remove('torpedo-wave');
                    }, 400);
                }, (c - col) * 50);
            }
        }
    } else {
        // Vertical waves - from target to edges
        // Top side
        for (let r = row - 1; r >= 0; r--) {
            const cell = document.querySelector(`#enemyGrid .grid-cell[data-row="${r}"][data-col="${col}"]`);
            if (cell) {
                setTimeout(() => {
                    cell.classList.add('torpedo-wave');
                    setTimeout(() => {
                        cell.classList.remove('torpedo-wave');
                    }, 400);
                }, (row - r) * 50);
            }
        }
        // Bottom side
        for (let r = row + 1; r < 10; r++) {
            const cell = document.querySelector(`#enemyGrid .grid-cell[data-row="${r}"][data-col="${col}"]`);
            if (cell) {
                setTimeout(() => {
                    cell.classList.add('torpedo-wave');
                    setTimeout(() => {
                        cell.classList.remove('torpedo-wave');
                    }, 400);
                }, (r - row) * 50);
            }
        }
    }
}

function handleShotResult(result) {
    const { row, col, isHit, isSunk, shipType, isMineTrigger, mineShots, type, isMineRetaliation } = result;
    
    // Update enemy board
    gameState.enemyBoard[row][col] = isHit ? 'hit' : 'miss';
    
    const cell = document.querySelector(`#enemyGrid .grid-cell[data-row="${row}"][data-col="${col}"]`);
    if (cell) {
        cell.classList.add(isHit ? 'hit' : 'miss');
        
        if (!isHit) {
            // Miss animation - show on attacker's view
            cell.classList.add('wave-animation');
            setTimeout(() => {
                cell.classList.remove('wave-animation');
            }, 800);
        }
    }
    
    if (isHit) {
        gameState.hits++;
        
        // Add energy for hit
        updateEnergy(1);
        showNotification('+1 Energie (Treffer!)', 'success');
        
        // Flash green border on hit
        document.body.classList.add('flash-success');
        setTimeout(() => document.body.classList.remove('flash-success'), 1000);
        
        if (isSunk) {
            gameState.sunkShips++;
            markShipAsSunk(result.shipPositions, true);
            
            // Track which enemy ship was sunk
            if (!gameState.enemySunkShips[shipType]) {
                gameState.enemySunkShips[shipType] = true;
            }
            
            updateShipStatus();
            
            // Play sounds in sequence
            playSound('hit');
            setTimeout(() => playSound('sunk'), 500);
            
            // Check for victory
            checkVictory();
        } else {
            playSound('hit');
        }
        
        // Handle extra shot for normal shots only (not for mine retaliation)
        if (type === 'normal' && !isMineRetaliation) {
            gameState.hasShot = false;
            gameState.waitingForExtraShot = true;
            enableEnemyGrid(true);
            showNotification('Treffer! Du darfst nochmal schießen!', 'success');
        } else {
            // Enable end turn button after powerup hit
            const endTurnBtn = document.getElementById('endTurnBtn');
            if (endTurnBtn && !isMineRetaliation) {
                endTurnBtn.disabled = false;
            }
        }
    } else {
        playSound('miss');
        
        // Enable end turn button after miss (not for mine retaliation)
        const endTurnBtn = document.getElementById('endTurnBtn');
        if (endTurnBtn && !isMineRetaliation) {
            endTurnBtn.disabled = false;
        }
    }
    
    // Handle mine trigger
    if (isMineTrigger) {
        showNotification('Mine ausgelöst!', 'warning');
        gameState.minesHit++;
        
        // Mark mine as triggered (keep it visible)
        const mineCell = document.querySelector(`#enemyGrid .grid-cell[data-row="${row}"][data-col="${col}"]`);
        if (mineCell) {
            mineCell.classList.add('mine-triggered');
        }
    }
    
    updateStats();
}

function processMineShots(mineShots) {
    let index = 0;
    
    function fireNext() {
        if (index >= mineShots.length) return;
        
        const shot = mineShots[index];
        const cell = document.querySelector(`#enemyGrid .grid-cell[data-row="${shot.row}"][data-col="${shot.col}"]`);
        
        if (cell) {
            gameState.enemyBoard[shot.row][shot.col] = shot.isHit ? 'hit' : 'miss';
            cell.classList.add(shot.isHit ? 'hit' : 'miss');
            
            if (shot.isHit) {
                gameState.hits++;
                playSound('hit');
            } else {
                playSound('miss');
                cell.classList.add('wave-animation');
                setTimeout(() => {
                    cell.classList.remove('wave-animation');
                }, 800);
            }
        }
        
        gameState.shots++;
        updateStats();
        
        index++;
        setTimeout(fireNext, 400); // Delayed shots
    }
    
    fireNext();
}

function handleIncomingShot(shot) {
    const { row, col, shotId, shooterId, type, torpedoDirection } = shot;
    const cellContent = gameState.myBoard[row][col];
    
    const cell = document.querySelector(`#playerGrid .grid-cell[data-row="${row}"][data-col="${col}"]`);
    
    let result = {
        row: row,
        col: col,
        isHit: false,
        isSunk: false,
        shipType: null,
        shipPositions: [],
        isMineTrigger: false,
        mineShots: [],
        type: type
    };
    
    // Check for mine hit
    const mineIndex = gameState.myMines.findIndex(mine => mine.row === row && mine.col === col);
    if (mineIndex !== -1) {
        // Mine triggered
        result.isMineTrigger = true;
        
        // Remove mine from active mines
        gameState.myMines.splice(mineIndex, 1);
        
        // Add to triggered mines to keep it visible
        gameState.triggeredMines.push({row, col});
        
        // Update visual - keep it purple with bomb
        if (cell) {
            cell.classList.add('mine-triggered');
            cell.classList.add('miss');
        }
        
        // Generate random shots
        result.mineShots = generateMineShots();
        
        playSound('miss');
        
        // Update Firebase mines
        gameState.lobbyRef.child(`players/${gameState.playerId}/mines`).set(gameState.myMines);
        
        // Notify about mine update
        gameState.lobbyRef.child('mineUpdate').set({
            playerId: gameState.playerId,
            timestamp: Date.now()
        });
    } else if (cellContent === 'ship') {
        // Hit
        gameState.myBoard[row][col] = 'hit';
        if (cell) {
            cell.classList.add('hit');
            
            // Hit animation on adjacent cells
            animateHitAdjacent(row, col);
        }
        result.isHit = true;
        
        // Flash red border when hit
        document.body.classList.add('flash-hit');
        setTimeout(() => document.body.classList.remove('flash-hit'), 1000);
        
        // Check if ship is sunk
        const sunkShip = checkShipSunk(row, col);
        if (sunkShip) {
            result.isSunk = true;
            result.shipType = sunkShip.type;
            result.shipPositions = sunkShip.positions;
            
            // Play sounds in sequence
            playSound('hit');
            setTimeout(() => playSound('sunk'), 500);
        } else {
            playSound('hit');
        }
    } else {
        // Miss
        gameState.myBoard[row][col] = 'miss';
        if (cell) {
            cell.classList.add('miss');
            cell.classList.add('wave-animation');
            setTimeout(() => {
                cell.classList.remove('wave-animation');
            }, 800);
        }
        
        playSound('miss');
    }
    
    // Create torpedo wave on defender's view
    if (type === 'torpedo' && torpedoDirection) {
        createTorpedoWaveDefender(row, col, torpedoDirection);
    }
    
    // Send result back
    gameState.lobbyRef.child(`shotResults/${shooterId}/${shotId}`).set(result);
}

function createTorpedoWaveDefender(row, col, direction) {
    // Same as attacker but on playerGrid
    if (direction === 'top' || direction === 'bottom') {
        // Horizontal waves
        for (let c = col - 1; c >= 0; c--) {
            const cell = document.querySelector(`#playerGrid .grid-cell[data-row="${row}"][data-col="${c}"]`);
            if (cell) {
                setTimeout(() => {
                    cell.classList.add('torpedo-wave');
                    setTimeout(() => {
                        cell.classList.remove('torpedo-wave');
                    }, 400);
                }, (col - c) * 50);
            }
        }
        for (let c = col + 1; c < 10; c++) {
            const cell = document.querySelector(`#playerGrid .grid-cell[data-row="${row}"][data-col="${c}"]`);
            if (cell) {
                setTimeout(() => {
                    cell.classList.add('torpedo-wave');
                    setTimeout(() => {
                        cell.classList.remove('torpedo-wave');
                    }, 400);
                }, (c - col) * 50);
            }
        }
    } else {
        // Vertical waves
        for (let r = row - 1; r >= 0; r--) {
            const cell = document.querySelector(`#playerGrid .grid-cell[data-row="${r}"][data-col="${col}"]`);
            if (cell) {
                setTimeout(() => {
                    cell.classList.add('torpedo-wave');
                    setTimeout(() => {
                        cell.classList.remove('torpedo-wave');
                    }, 400);
                }, (row - r) * 50);
            }
        }
        for (let r = row + 1; r < 10; r++) {
            const cell = document.querySelector(`#playerGrid .grid-cell[data-row="${r}"][data-col="${col}"]`);
            if (cell) {
                setTimeout(() => {
                    cell.classList.add('torpedo-wave');
                    setTimeout(() => {
                        cell.classList.remove('torpedo-wave');
                    }, 400);
                }, (r - row) * 50);
            }
        }
    }
}

function animateHitAdjacent(row, col) {
    // Animate cells within radius 1
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            
            const r = row + dr;
            const c = col + dc;
            
            if (r >= 0 && r < 10 && c >= 0 && c < 10) {
                const cell = document.querySelector(`#playerGrid .grid-cell[data-row="${r}"][data-col="${c}"]`);
                if (cell) {
                    cell.classList.add('hit-flash');
                    setTimeout(() => {
                        cell.classList.remove('hit-flash');
                    }, 1000);
                }
            }
        }
    }
}

function generateMineShots() {
    const shots = [];
    
    // Get all unknown cells
    const unknownCells = [];
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
            if (gameState.enemyBoard[r][c] === 'unknown') {
                unknownCells.push({row: r, col: c});
            }
        }
    }
    
    // Pick 2 random cells
    for (let i = 0; i < 2 && unknownCells.length > 0; i++) {
        const index = Math.floor(Math.random() * unknownCells.length);
        const target = unknownCells.splice(index, 1)[0];
        
        // Check actual hit/miss on enemy board
        // This will be processed properly when sent back
        shots.push({
            row: target.row,
            col: target.col,
            isHit: false // Will be updated when processed
        });
    }
    
    return shots;
}

function checkShipSunk(row, col) {
    // Find which ship was hit
    for (const ship of gameState.placedShips) {
        const hitPosition = ship.positions.find(pos => pos.row === row && pos.col === col);
        
        if (hitPosition) {
            ship.hits++;
            
            if (ship.hits === ship.size && !ship.sunk) {
                ship.sunk = true;
                
                // Mark all ship cells as sunk
                ship.positions.forEach(pos => {
                    const cell = document.querySelector(`#playerGrid .grid-cell[data-row="${pos.row}"][data-col="${pos.col}"]`);
                    if (cell) {
                        cell.classList.add('sunk');
                    }
                });
                
                // Draw ship outline
                drawShipOutline(ship.positions, false);
                
                updateShipStatus();
                return ship;
            }
        }
    }
    
    return null;
}

function markShipAsSunk(positions, isEnemy) {
    const gridId = isEnemy ? 'enemyGrid' : 'playerGrid';
    
    positions.forEach(pos => {
        const cell = document.querySelector(`#${gridId} .grid-cell[data-row="${pos.row}"][data-col="${pos.col}"]`);
        if (cell) {
            cell.classList.add('sunk');
        }
    });
    
    // Draw ship outline
    drawShipOutline(positions, isEnemy);
}

function drawShipOutline(positions, isEnemy) {
    const gridId = isEnemy ? 'enemyGrid' : 'playerGrid';
    const grid = document.getElementById(gridId);
    if (!grid) return;
    
    // Calculate bounding box
    let minRow = 10, maxRow = -1, minCol = 10, maxCol = -1;
    positions.forEach(pos => {
        minRow = Math.min(minRow, pos.row);
        maxRow = Math.max(maxRow, pos.row);
        minCol = Math.min(minCol, pos.col);
        maxCol = Math.max(maxCol, pos.col);
    });
    
    // Create outline element
    const outline = document.createElement('div');
    outline.className = 'ship-outline';
    
    // Get first cell to calculate position
    const firstCell = grid.querySelector('.grid-cell[data-row="0"][data-col="0"]');
    const headerCell = grid.querySelector('.grid-header');
    if (!firstCell || !headerCell) return;
    
    // Calculate cell dimensions and grid offset
    const cellRect = firstCell.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();
    const cellSize = cellRect.width;
    const gap = 2; // Gap between cells
    
    // Calculate position relative to grid
    const headerSize = headerCell.getBoundingClientRect().width;
    const left = headerSize + (minCol * (cellSize + gap)) + 10; // 10px grid padding
    const top = headerSize + (minRow * (cellSize + gap)) + 10;
    const width = (maxCol - minCol + 1) * (cellSize + gap) - gap;
    const height = (maxRow - minRow + 1) * (cellSize + gap) - gap;
    
    outline.style.left = `${left}px`;
    outline.style.top = `${top}px`;
    outline.style.width = `${width}px`;
    outline.style.height = `${height}px`;
    
    grid.appendChild(outline);
}

function endTurn() {
    // Switch turns
    switchTurn();
    
    // Reset powerup usage counter for next turn
    gameState.powerupsUsed = 0;
}

function switchTurn() {
    gameState.lobbyRef.child('players').once('value').then(snapshot => {
        const players = Object.keys(snapshot.val());
        const currentIndex = players.indexOf(gameState.currentTurn);
        const nextPlayer = players[(currentIndex + 1) % 2];
        
        gameState.lobbyRef.update({
            currentTurn: nextPlayer
        });
    });
}

function updateStats() {
    const shotCountEl = document.getElementById('shotCount');
    const hitCountEl = document.getElementById('hitCount');
    const sunkCountEl = document.getElementById('sunkCount');
    const mineCountEl = document.getElementById('mineCount');
    
    if (shotCountEl) shotCountEl.textContent = gameState.shots;
    if (hitCountEl) hitCountEl.textContent = gameState.hits;
    if (sunkCountEl) sunkCountEl.textContent = gameState.sunkShips;
    if (mineCountEl) mineCountEl.textContent = gameState.minesPlaced;
}

function updateShipStatus() {
    // Update player ships in left sidebar
    const playerShipsContainer = document.getElementById('playerShipsStatus');
    if (playerShipsContainer) {
        playerShipsContainer.innerHTML = '';
        
        gameState.placedShips.forEach(ship => {
            const shipElement = document.createElement('div');
            shipElement.className = `ship-display-item ${ship.sunk ? 'sunk' : ''}`;
            
            const shipInfo = document.createElement('div');
            const shipType = gameState.shipTypes.find(t => t.name === ship.type);
            shipInfo.innerHTML = `
                <span>${shipType.icon}</span>
                <span>${ship.type} (${ship.size})</span>
            `;
            
            const shipPreview = document.createElement('div');
            shipPreview.className = 'ship-display-preview';
            for (let i = 0; i < ship.size; i++) {
                const cell = document.createElement('div');
                cell.className = 'ship-display-cell';
                shipPreview.appendChild(cell);
            }
            
            shipElement.appendChild(shipInfo);
            shipElement.appendChild(shipPreview);
            playerShipsContainer.appendChild(shipElement);
        });
    }
    
    // Update enemy ships in right sidebar
    const enemyShipsContainer = document.getElementById('enemyShipsStatus');
    if (enemyShipsContainer) {
        enemyShipsContainer.innerHTML = '';
        
        gameState.shipTypes.forEach((shipType) => {
            const shipElement = document.createElement('div');
            const isSunk = gameState.enemySunkShips[shipType.name] || false;
            shipElement.className = `ship-display-item enemy ${isSunk ? 'sunk' : ''}`;
            
            const shipInfo = document.createElement('div');
            shipInfo.innerHTML = `
                <span>${shipType.icon}</span>
                <span>${shipType.name} (${shipType.size})</span>
            `;
            
            const shipPreview = document.createElement('div');
            shipPreview.className = 'ship-display-preview';
            for (let i = 0; i < shipType.size; i++) {
                const cell = document.createElement('div');
                cell.className = 'ship-display-cell';
                shipPreview.appendChild(cell);
            }
            
            shipElement.appendChild(shipInfo);
            shipElement.appendChild(shipPreview);
            enemyShipsContainer.appendChild(shipElement);
        });
    }
}

function checkVictory() {
    // Check if all enemy ships are sunk
    if (gameState.sunkShips === gameState.shipTypes.length) {
        // Player wins
        gameState.lobbyRef.update({
            gameState: 'gameover',
            winner: gameState.playerId
        });
    }
}

function handleGameOver() {
    gameState.lobbyRef.child('winner').once('value').then(snapshot => {
        const winnerId = snapshot.val();
        const isWinner = winnerId === gameState.playerId;
        
        // Update body border for victory
        document.body.classList.remove('player-turn', 'enemy-turn');
        document.body.classList.add('victory');
        
        const winnerIcon = document.getElementById('winnerIcon');
        const winnerText = document.getElementById('winnerText');
        
        if (winnerIcon) winnerIcon.textContent = isWinner ? '🏆' : '😢';
        if (winnerText) winnerText.textContent = isWinner ? 'Du hast gewonnen!' : 'Du hast verloren!';
        
        // Show final stats
        const finalStats = document.getElementById('finalStats');
        if (finalStats) {
            finalStats.innerHTML = `
                <p>Schüsse abgegeben: ${gameState.shots}</p>
                <p>Treffer: ${gameState.hits}</p>
                <p>Trefferquote: ${gameState.shots > 0 ? Math.round((gameState.hits / gameState.shots) * 100) : 0}%</p>
                <p>Versenkte Schiffe: ${gameState.sunkShips}</p>
                <p>Minen platziert: ${gameState.minesPlaced}</p>
                <p>Powerups genutzt: ${gameState.powerupsUsed}</p>
            `;
        }
        
        showScreen('gameover');
    });
}

function surrenderGame() {
    if (confirm('Willst du wirklich aufgeben?')) {
        // Set enemy as winner
        gameState.lobbyRef.update({
            gameState: 'gameover',
            winner: gameState.enemyId
        });
        
        showNotification('Du hast aufgegeben!', 'warning');
    }
}

// Radar result listener
function setupRadarListener() {
    gameState.lobbyRef.child(`radarResults/${gameState.playerId}`).on('child_added', snapshot => {
        const result = snapshot.val();
        displayRadarResult(result);
    });
}

function displayRadarResult(result) {
    const { centerRow, centerCol, count, positions } = result;
    
    // Update visual
    positions.forEach(pos => {
        const cell = document.querySelector(`#enemyGrid .grid-cell[data-row="${pos.row}"][data-col="${pos.col}"]`);
        if (cell) {
            cell.classList.add('radar-area');
        }
    });
    
    // Update center cell with count
    const centerCell = document.querySelector(`#enemyGrid .grid-cell[data-row="${centerRow}"][data-col="${centerCol}"]`);
    if (centerCell) {
        centerCell.classList.add('radar-center');
        centerCell.dataset.radarCount = count;
        centerCell.textContent = count;
    }
    
    // Store radar scan
    gameState.radarScans.push({ centerRow, centerCol, count, positions });
    
    showNotification(`Radar-Scan: ${count} Objekte entdeckt!`, 'info');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize sounds
    initializeSounds();
    preloadSounds();
    
    // Settings popup
    const settingsIcon = document.getElementById('settingsIcon');
    const closeSettings = document.getElementById('closeSettings');
    
    if (settingsIcon) settingsIcon.addEventListener('click', showSettingsPopup);
    if (closeSettings) closeSettings.addEventListener('click', hideSettingsPopup);
    
    // Volume control
    const volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            updateVolume(e.target.value);
        });
    }
    
    // Lobby buttons
    const createLobbyBtn = document.getElementById('createLobbyBtn');
    const joinLobbyBtn = document.getElementById('joinLobbyBtn');
    const leaveLobbyBtn = document.getElementById('leaveLobbyBtn');
    
    if (createLobbyBtn) createLobbyBtn.addEventListener('click', createLobby);
    if (joinLobbyBtn) joinLobbyBtn.addEventListener('click', joinLobby);
    if (leaveLobbyBtn) leaveLobbyBtn.addEventListener('click', leaveLobby);
    
    // Copy lobby code
    const copyLobbyCode = document.getElementById('copyLobbyCode');
    if (copyLobbyCode) {
        copyLobbyCode.addEventListener('click', () => {
            const code = document.getElementById('lobbyCodeDisplay').textContent;
            navigator.clipboard.writeText(code).then(() => {
                showNotification('Code kopiert!', 'success');
            }).catch(() => {
                showNotification('Kopieren fehlgeschlagen', 'error');
            });
        });
    }
    
    // Placement buttons
    const randomPlaceBtn = document.getElementById('randomPlaceBtn');
    const clearBoardBtn = document.getElementById('clearBoardBtn');
    const rotateBtn = document.getElementById('rotateBtn');
    const readyBtn = document.getElementById('readyBtn');
    
    if (randomPlaceBtn) randomPlaceBtn.addEventListener('click', randomPlacement);
    if (clearBoardBtn) clearBoardBtn.addEventListener('click', clearBoard);
    if (rotateBtn) rotateBtn.addEventListener('click', rotateShip);
    if (readyBtn) readyBtn.addEventListener('click', setPlayerReady);
    
    // Powerup buttons
    const mineBtn = document.getElementById('mineBtn');
    const radarBtn = document.getElementById('radarBtn');
    const cannonBtn = document.getElementById('cannonBtn');
    const torpedoBtn = document.getElementById('torpedoBtn');
    
    if (mineBtn) mineBtn.addEventListener('click', () => activatePowerup('mine'));
    if (radarBtn) radarBtn.addEventListener('click', () => activatePowerup('radar'));
    if (cannonBtn) cannonBtn.addEventListener('click', () => activatePowerup('cannon'));
    if (torpedoBtn) torpedoBtn.addEventListener('click', () => activatePowerup('torpedo'));
    
    // Game buttons
    const toggleBoardBtn = document.getElementById('toggleBoardBtn');
    const endTurnBtn = document.getElementById('endTurnBtn');
    const surrenderBtn = document.getElementById('surrenderBtn');
    
    if (toggleBoardBtn) toggleBoardBtn.addEventListener('click', toggleBoardView);
    if (endTurnBtn) endTurnBtn.addEventListener('click', endTurn);
    if (surrenderBtn) surrenderBtn.addEventListener('click', surrenderGame);
    
    const newGameBtn = document.getElementById('newGameBtn');
    if (newGameBtn) newGameBtn.addEventListener('click', () => {
        leaveLobby();
        location.reload();
    });
    
    // Initialize connection status
    updateConnectionStatus(false);
    
    // Handle page unload
    window.addEventListener('beforeunload', () => {
        if (gameState.lobbyRef && gameState.playerId) {
            gameState.lobbyRef.child(`players/${gameState.playerId}`).remove();
        }
    });
});
