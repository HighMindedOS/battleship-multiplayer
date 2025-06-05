// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Game State
const gameState = {
    currentScreen: 'lobby',
    playerName: '',
    playerId: null,
    lobbyId: null,
    lobbyRef: null,
    isHost: false,
    gamePhase: 'waiting', // waiting, placing, ready, playing, gameover
    currentTurn: null,
    
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
    
    // Cheats
    cheatsEnabled: false,
    probabilityMap: Array(10).fill(null).map(() => Array(10).fill(0))
};

// DOM Elements
const screens = {
    lobby: document.getElementById('lobbyScreen'),
    waiting: document.getElementById('waitingScreen'),
    placement: document.getElementById('placementScreen'),
    game: document.getElementById('gameScreen'),
    gameover: document.getElementById('gameOverScreen')
};

// Utility Functions
function generateLobbyCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function showScreen(screenName) {
    Object.keys(screens).forEach(name => {
        screens[name].classList.toggle('active', name === screenName);
    });
    gameState.currentScreen = screenName;
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
    
    if (connected) {
        statusDot.classList.add('connected');
        statusText.textContent = 'Verbunden';
    } else {
        statusDot.classList.remove('connected');
        statusText.textContent = 'Offline';
    }
}

// Grid Creation Functions
function createGrid(containerId, isEnemy = false) {
    const container = document.getElementById(containerId);
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
            showScreen('gameover');
        }
    });
    
    // Listen for turn changes
    gameState.lobbyRef.child('currentTurn').on('value', snapshot => {
        gameState.currentTurn = snapshot.val();
        updateTurnIndicator();
    });
    
    // Listen for enemy shots
    if (gameState.currentScreen === 'game') {
        const enemyId = getEnemyId();
        if (enemyId) {
            gameState.lobbyRef.child(`players/${enemyId}/shots`).on('child_added', snapshot => {
                const shot = snapshot.val();
                handleEnemyShot(shot);
            });
        }
    }
    
    // Handle disconnection
    gameState.lobbyRef.child(`players/${gameState.playerId}`).onDisconnect().remove();
}

function updatePlayersList(players) {
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = '';
    
    let index = 0;
    for (const [id, player] of Object.entries(players)) {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        playerItem.innerHTML = `
            <span class="player-icon">${id === gameState.playerId ? '👤' : '🎮'}</span>
            <span class="player-name">${player.name} ${id === gameState.playerId ? '(Du)' : ''}</span>
            ${player.ready ? '<span style="color: var(--secondary-color)">✅ Bereit</span>' : ''}
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
    placementGrid.addEventListener('mouseover', handlePlacementHover);
    placementGrid.addEventListener('mouseout', clearPlacementPreview);
    placementGrid.addEventListener('click', handlePlacementClick);
}

function renderAvailableShips() {
    const container = document.getElementById('availableShips');
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
        document.getElementById('readyBtn').disabled = false;
        showNotification('Alle Schiffe platziert! Klicke auf "Bereit"!', 'success');
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
    
    document.getElementById('readyBtn').disabled = true;
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
    
    // Setup enemy shot listener
    const enemyId = getEnemyId();
    if (enemyId) {
        gameState.lobbyRef.child(`players/${enemyId}/shots`).on('child_added', snapshot => {
            const shot = snapshot.val();
            handleEnemyShot(shot);
        });
    }
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
    if (gameState.currentTurn === gameState.playerId) {
        turnIndicator.textContent = 'Du bist dran!';
        turnIndicator.style.color = 'var(--secondary-color)';
        enableEnemyGrid(true);
    } else {
        turnIndicator.textContent = 'Gegner ist dran...';
        turnIndicator.style.color = 'var(--text-secondary)';
        enableEnemyGrid(false);
    }
}

function enableEnemyGrid(enabled) {
    const enemyCells = document.querySelectorAll('#enemyGrid .grid-cell:not(.grid-header)');
    enemyCells.forEach(cell => {
        cell.style.pointerEvents = enabled ? 'auto' : 'none';
        cell.style.opacity = enabled ? '1' : '0.7';
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
    
    // Make the shot
    const shotData = {
        row: row,
        col: col,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    
    gameState.lobbyRef.child(`players/${gameState.playerId}/shots`).push(shotData).then(() => {
        // Shot will be processed by the enemy
        gameState.shots++;
        updateStats();
    });
}

function handleEnemyShot(shot) {
    const { row, col } = shot;
    const cellContent = gameState.myBoard[row][col];
    
    const cell = document.querySelector(`#playerGrid .grid-cell[data-row="${row}"][data-col="${col}"]`);
    
    if (cellContent === 'ship') {
        // Hit
        gameState.myBoard[row][col] = 'hit';
        cell.classList.add('hit');
        
        // Check if ship is sunk
        checkShipSunk(row, col, true);
        
        // Send result back
        sendShotResult(shot, 'hit');
        
        addToGameLog(`Gegner trifft ${String.fromCharCode(65 + col)}${row + 1}!`, 'hit');
    } else {
        // Miss
        gameState.myBoard[row][col] = 'miss';
        cell.classList.add('miss');
        
        sendShotResult(shot, 'miss');
        
        addToGameLog(`Gegner verfehlt ${String.fromCharCode(65 + col)}${row + 1}`, 'miss');
    }
    
    // Switch turns
    switchTurn();
}

function sendShotResult(shot, result) {
    const enemyId = getEnemyId();
    gameState.lobbyRef.child(`shotResults/${enemyId}/${shot.timestamp}`).set({
        ...shot,
        result: result
    });
}

function getEnemyId() {
    // This will be implemented to get the enemy player ID
    return null; // Placeholder
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
    document.getElementById('shotCount').textContent = gameState.shots;
    document.getElementById('hitCount').textContent = gameState.hits;
    document.getElementById('sunkCount').textContent = gameState.sunkShips;
}

function updateShipStatus() {
    // Update player ships
    const playerShipsContainer = document.getElementById('playerShipsStatus');
    playerShipsContainer.innerHTML = '';
    
    gameState.placedShips.forEach(ship => {
        const shipElement = document.createElement('div');
        shipElement.className = `ship-status-item ${ship.sunk ? 'sunk' : ''}`;
        shipElement.innerHTML = `${ship.type} (${ship.size})`;
        playerShipsContainer.appendChild(shipElement);
    });
}

function checkShipSunk(row, col, isMyShip) {
    // Implementation for checking if a ship is sunk
}

function addToGameLog(message, type) {
    const log = document.getElementById('gameLog');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
}

// Cheats (Probability Map)
function toggleCheats() {
    gameState.cheatsEnabled = !gameState.cheatsEnabled;
    
    if (gameState.cheatsEnabled) {
        calculateProbabilityMap();
        showProbabilityMap();
    } else {
        hideProbabilityMap();
    }
    
    showNotification(`Cheats ${gameState.cheatsEnabled ? 'aktiviert' : 'deaktiviert'}`, 'warning');
}

function calculateProbabilityMap() {
    // Reset probability map
    gameState.probabilityMap = Array(10).fill(null).map(() => Array(10).fill(0));
    
    // Calculate probabilities based on remaining enemy ships
    // This is a simplified version - you can implement the full algorithm from the original
}

function showProbabilityMap() {
    // Display probability values on enemy grid
}

function hideProbabilityMap() {
    // Remove probability display
}

// Event Listeners
document.getElementById('createLobbyBtn').addEventListener('click', createLobby);
document.getElementById('joinLobbyBtn').addEventListener('click', joinLobby);
document.getElementById('leaveLobbyBtn').addEventListener('click', leaveLobby);
document.getElementById('copyCodeBtn').addEventListener('click', () => {
    const code = document.getElementById('lobbyCodeDisplay').textContent;
    navigator.clipboard.writeText(code).then(() => {
        showNotification('Code kopiert!', 'success');
    });
});

document.getElementById('randomPlaceBtn').addEventListener('click', randomPlacement);
document.getElementById('clearBoardBtn').addEventListener('click', clearBoard);
document.getElementById('rotateBtn').addEventListener('click', rotateShip);
document.getElementById('readyBtn').addEventListener('click', setPlayerReady);

document.getElementById('cheatsBtn').addEventListener('click', toggleCheats);
document.getElementById('newGameBtn').addEventListener('click', () => {
    leaveLobby();
    location.reload();
});

// Initialize
updateConnectionStatus(false);

// Check Firebase connection
database.ref('.info/connected').on('value', snapshot => {
    updateConnectionStatus(snapshot.val() === true);
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (gameState.lobbyRef && gameState.playerId) {
        gameState.lobbyRef.child(`players/${gameState.playerId}`).remove();
    }
});
    
