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
    canShootAgain: false,
    isFirstTurn: true,
    
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
    
    // Placement Data
    selectedShip: null,
    shipOrientation: 'horizontal',
    placedShips: [],
    
    // Stats
    shots: 0,
    hits: 0,
    sunkShips: 0,
    
    // Track enemy sunk ships
    enemySunkShips: {},
    
    // Cheats - Always Active
    probabilityMap: Array(10).fill(null).map(() => Array(10).fill(0)),
    bestShot: null,
    
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
        
        // Error handling for missing files
        audio.onerror = () => {
            console.warn(`Sound file not found: ${path}`);
            // Create silent audio as fallback
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
        
        // Clone for overlapping sounds
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
    
    // Add in-game class to body when in game screen
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
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    
    if (statusDot && statusText) {
        if (connected) {
            statusDot.classList.add('connected');
            statusText.textContent = 'Verbunden';
        } else {
            statusDot.classList.remove('connected');
            statusText.textContent = 'Offline';
        }
    }
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
                shots: []
            }
        },
        gameState: 'waiting',
        currentTurn: null,
        winner: null
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
        updateTurnIndicator();
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
            ${player.ready ? '<span style="color: var(--primary-color)">✅ Bereit</span>' : ''}
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
    if (e.key.toLowerCase() === 'r') {
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
                        // Check if this adjacent ship cell is part of the current ship being placed
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
    
    // Initialize auto-cheat system
    updateRecommendation();
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
    const turnIndicator = document.getElementById('currentPlayer');
    const enemyGrid = document.getElementById('enemyGrid');
    
    if (!turnIndicator || !enemyGrid) return;
    
    if (gameState.currentTurn === gameState.playerId) {
        turnIndicator.textContent = 'Du bist dran!';
        turnIndicator.style.color = 'var(--primary-color)';
        enemyGrid.classList.add('active');
        enemyGrid.classList.remove('disabled');
        enableEnemyGrid(true);
        updateRecommendation();
        
        // Update body border for player turn
        document.body.classList.add('player-turn');
        document.body.classList.remove('enemy-turn');
        
        // Play turn sound only on first turn of the round
        if (gameState.isFirstTurn) {
            playSound('turn');
            gameState.isFirstTurn = false;
        }
    } else {
        turnIndicator.textContent = 'Gegner ist dran...';
        turnIndicator.style.color = 'var(--text-secondary)';
        enemyGrid.classList.remove('active');
        enemyGrid.classList.add('disabled');
        enableEnemyGrid(false);
        
        // Update body border for enemy turn
        document.body.classList.add('enemy-turn');
        document.body.classList.remove('player-turn');
        
        // Reset first turn flag for next player turn
        gameState.isFirstTurn = true;
    }
}

function enableEnemyGrid(enabled) {
    const enemyCells = document.querySelectorAll('#enemyGrid .grid-cell:not(.grid-header)');
    enemyCells.forEach(cell => {
        cell.style.pointerEvents = enabled ? 'auto' : 'none';
    });
}

function handleEnemyCellClick(row, col) {
    if (gameState.currentTurn !== gameState.playerId) {
        showNotification('Nicht dein Zug!', 'warning');
        return;
    }
    
    if (gameState.enemyBoard[row][col] !== 'unknown') {
        showNotification('Bereits beschossen!', 'warning');
        return;
    }
    
    // Disable grid while processing
    enableEnemyGrid(false);
    
    // Make the shot
    const shotId = Date.now().toString();
    const shotData = {
        row: row,
        col: col,
        shotId: shotId,
        shooterId: gameState.playerId
    };
    
    // Send shot to enemy
    const enemyId = getEnemyId();
    gameState.lobbyRef.child(`pendingShots/${enemyId}/${shotId}`).set(shotData).then(() => {
        // Wait for result
        gameState.shots++;
        updateStats();
    });
}

function getEnemyId() {
    let enemyId = null;
    
    // Get enemy ID synchronously from cached data
    gameState.lobbyRef.child('players').once('value', snapshot => {
        const players = snapshot.val();
        const playerIds = Object.keys(players);
        enemyId = playerIds.find(id => id !== gameState.playerId);
    });
    
    return enemyId;
}

function handleShotResult(result) {
    const { row, col, isHit, isSunk, shipType } = result;
    
    // Update enemy board
    gameState.enemyBoard[row][col] = isHit ? 'hit' : 'miss';
    
    const cell = document.querySelector(`#enemyGrid .grid-cell[data-row="${row}"][data-col="${col}"]`);
    if (cell) {
        cell.classList.add(isHit ? 'hit' : 'miss');
    }
    
    if (isHit) {
        gameState.hits++;
        
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
            
            // Play sunk sound (not hit sound)
            playSound('sunk');
            
            // Check for victory
            checkVictory();
        } else {
            // Play hit sound only if not sunk
            playSound('hit');
        }
        
        // IMPORTANT: Player gets another turn after a hit!
        gameState.canShootAgain = true;
        enableEnemyGrid(true);
        showNotification('Treffer! Du darfst nochmal schießen!', 'success');
        updateRecommendation();
    } else {
        playSound('miss');
        gameState.canShootAgain = false;
        // Switch turns only on miss
        switchTurn();
    }
    
    updateStats();
}

function handleIncomingShot(shot) {
    const { row, col, shotId, shooterId } = shot;
    const cellContent = gameState.myBoard[row][col];
    
    const cell = document.querySelector(`#playerGrid .grid-cell[data-row="${row}"][data-col="${col}"]`);
    
    let result = {
        row: row,
        col: col,
        isHit: false,
        isSunk: false,
        shipType: null,
        shipPositions: []
    };
    
    if (cellContent === 'ship') {
        // Hit
        gameState.myBoard[row][col] = 'hit';
        if (cell) {
            cell.classList.add('hit');
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
        }
    } else {
        // Miss
        gameState.myBoard[row][col] = 'miss';
        if (cell) {
            cell.classList.add('miss');
        }
    }
    
    // Send result back
    gameState.lobbyRef.child(`shotResults/${shooterId}/${shotId}`).set(result);
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
    
    if (shotCountEl) shotCountEl.textContent = gameState.shots;
    if (hitCountEl) hitCountEl.textContent = gameState.hits;
    if (sunkCountEl) sunkCountEl.textContent = gameState.sunkShips;
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
            `;
        }
        
        showScreen('gameover');
    });
}

function surrenderGame() {
    if (confirm('Willst du wirklich aufgeben?')) {
        // Get enemy ID
        const enemyId = getEnemyId();
        
        // Set enemy as winner
        gameState.lobbyRef.update({
            gameState: 'gameover',
            winner: enemyId
        });
        
        showNotification('Du hast aufgegeben!', 'warning');
    }
}

// Auto-Recommendation System (Always Active)
function updateRecommendation() {
    const cheatDisplay = document.getElementById('cheatDisplay');
    const recommendedShot = document.getElementById('recommendedShot');
    
    if (!cheatDisplay || !recommendedShot) return;
    
    if (gameState.currentTurn !== gameState.playerId) {
        recommendedShot.textContent = '-';
        cheatDisplay.style.display = 'none';
        return;
    }
    
    // Show recommendation when it's player's turn
    cheatDisplay.style.display = 'block';
    
    calculateProbabilityMap();
    const bestShot = findBestShot();
    
    if (bestShot) {
        const coord = `${String.fromCharCode(65 + bestShot.col)}${bestShot.row + 1}`;
        recommendedShot.textContent = coord;
        
        // Highlight the recommended cell
        document.querySelectorAll('.recommended').forEach(cell => {
            cell.classList.remove('recommended');
        });
        
        const cell = document.querySelector(`#enemyGrid .grid-cell[data-row="${bestShot.row}"][data-col="${bestShot.col}"]`);
        if (cell) {
            cell.classList.add('recommended');
        }
    } else {
        recommendedShot.textContent = '-';
    }
}

function calculateProbabilityMap() {
    // Reset probability map
    gameState.probabilityMap = Array(10).fill(null).map(() => Array(10).fill(0));
    
    // For each remaining ship type
    const remainingShips = gameState.shipTypes.filter((_, index) => {
        return index >= gameState.sunkShips;
    });
    
    remainingShips.forEach(ship => {
        // Try all possible positions
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 10; col++) {
                // Try horizontal
                if (canPlaceShipOnEnemyBoard(row, col, ship.size, 'horizontal')) {
                    for (let i = 0; i < ship.size; i++) {
                        gameState.probabilityMap[row][col + i]++;
                    }
                }
                
                // Try vertical
                if (canPlaceShipOnEnemyBoard(row, col, ship.size, 'vertical')) {
                    for (let i = 0; i < ship.size; i++) {
                        gameState.probabilityMap[row + i][col]++;
                    }
                }
            }
        }
    });
    
    // Increase probability near hits
    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
            if (gameState.enemyBoard[row][col] === 'hit') {
                // Check adjacent cells
                const adjacents = [
                    { r: row - 1, c: col },
                    { r: row + 1, c: col },
                    { r: row, c: col - 1 },
                    { r: row, c: col + 1 }
                ];
                
                adjacents.forEach(adj => {
                    if (adj.r >= 0 && adj.r < 10 && adj.c >= 0 && adj.c < 10) {
                        if (gameState.enemyBoard[adj.r][adj.c] === 'unknown') {
                            gameState.probabilityMap[adj.r][adj.c] += 50;
                        }
                    }
                });
            }
        }
    }
}

function canPlaceShipOnEnemyBoard(row, col, size, orientation) {
    for (let i = 0; i < size; i++) {
        let checkRow = row;
        let checkCol = col;
        
        if (orientation === 'horizontal') {
            checkCol = col + i;
        } else {
            checkRow = row + i;
        }
        
        // Check bounds
        if (checkRow < 0 || checkRow >= 10 || checkCol < 0 || checkCol >= 10) {
            return false;
        }
        
        // Check if already shot
        if (gameState.enemyBoard[checkRow][checkCol] !== 'unknown') {
            return false;
        }
    }
    
    return true;
}

function findBestShot() {
    let maxProbability = 0;
    let bestShot = null;
    
    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
            if (gameState.enemyBoard[row][col] === 'unknown' && gameState.probabilityMap[row][col] > maxProbability) {
                maxProbability = gameState.probabilityMap[row][col];
                bestShot = { row, col };
            }
        }
    }
    
    return bestShot;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize sounds
    initializeSounds();
    preloadSounds();
    
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
    
    // Game buttons
    const surrenderBtn = document.getElementById('surrenderBtn');
    if (surrenderBtn) surrenderBtn.addEventListener('click', surrenderGame);
    
    const newGameBtn = document.getElementById('newGameBtn');
    if (newGameBtn) newGameBtn.addEventListener('click', () => {
        leaveLobby();
        location.reload();
    });
    
    // Volume control
    const volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            updateVolume(e.target.value);
        });
    }
    
    // Initialize connection status
    updateConnectionStatus(false);
    
    // Handle page unload
    window.addEventListener('beforeunload', () => {
        if (gameState.lobbyRef && gameState.playerId) {
            gameState.lobbyRef.child(`players/${gameState.playerId}`).remove();
        }
    });
});
