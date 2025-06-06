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

// Debug Firebase connection
console.log('Firebase initialized:', firebase.apps.length > 0);

// Test database connection immediately
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

database.ref('.info/connected').on('value', (snapshot) => {
    console.log('Firebase connection status:', snapshot.val());
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
    isFirstTurn: true, // Track first turn for sound

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
        hit: new Audio('hit.mp3'),
        miss: new Audio('miss.mp3'),
        sunk: new Audio('sunk.mp3'),
        turn: new Audio('turn.mp3')
    }
};

// DOM Elements
const screens = {
    lobby: document.getElementById('lobbyScreen'),
    waiting: document.getElementById('waitingScreen'),
    placement: document.getElementById('placementScreen'),
    game: document.getElementById('gameScreen'),
    gameover: document.getElementById('gameOverScreen')
};

// Audio Helper Functions
function initializeAudio() {
    Object.values(gameState.sounds).forEach(sound => {
        sound.volume = gameState.volume;
    });
}

function playSound(soundName) {
    const sound = gameState.sounds[soundName];
    if (sound) {
        sound.currentTime = 0;
        sound.volume = gameState.volume;
        sound.play().catch(e => console.log('Sound play failed:', e));
    }
}

function updateVolume(value) {
    gameState.volume = value / 100;
    Object.values(gameState.sounds).forEach(sound => {
        sound.volume = gameState.volume;
    });
}

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
    if (!notifications) return;
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notifications.appendChild(notification);
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Die restlichen Spielfunktionen (createGrid, Lobby, Placement, Game, usw.)
// --- AB HIER DEIN BISHERIGER CODE, OHNE EIN WEITERES gameState-Objekt! ---

// Beispiel: createLobby (und so weiter)
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
    
    function joinLobby() {
    // Minimal-Implementierung, die du nach Bedarf anpassen solltest
    const playerName = document.getElementById('joinPlayerName')?.value.trim();
    const lobbyCode = document.getElementById('lobbyCode')?.value.trim().toUpperCase();

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
    gameState.lobbyRef.set(lobbyData).then(() => {
        setupLobbyListeners();
        showScreen('waiting');
        document.getElementById('lobbyCodeDisplay').textContent = gameState.lobbyId;
        showNotification('Lobby erstellt! Teile den Code mit deinem Gegner.', 'success');
    }).catch(error => {
        showNotification('Fehler beim Erstellen der Lobby: ' + error.message, 'error');
    });
}

// ... Füge alle weiteren Funktionen deines Spiels hier ein ...
ffunction joinLobby() {
    const playerName = document.getElementById('joinPlayerName')?.value.trim();
    const lobbyCode = document.getElementById('lobbyCode')?.value.trim().toUpperCase();

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

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Lobby buttons
    document.getElementById('createLobbyBtn')?.addEventListener('click', createLobby);
    document.getElementById('joinLobbyBtn')?.addEventListener('click', joinLobby);
    document.getElementById('leaveLobbyBtn')?.addEventListener('click', leaveLobby);

    // Copy lobby code
    document.getElementById('copyLobbyCode')?.addEventListener('click', () => {
        const code = document.getElementById('lobbyCodeDisplay').textContent;
        navigator.clipboard.writeText(code).then(() => {
            showNotification('Code kopiert!', 'success');
        }).catch(() => {
            showNotification('Kopieren fehlgeschlagen', 'error');
        });
    });

    // Placement buttons
    document.getElementById('randomPlaceBtn')?.addEventListener('click', randomPlacement);
    document.getElementById('clearBoardBtn')?.addEventListener('click', clearBoard);
    document.getElementById('rotateBtn')?.addEventListener('click', rotateShip);
    document.getElementById('readyBtn')?.addEventListener('click', setPlayerReady);

    // Game buttons
    document.getElementById('surrenderBtn')?.addEventListener('click', surrenderGame);
    document.getElementById('newGameBtn')?.addEventListener('click', () => {
        leaveLobby();
        location.reload();
    });

    // Volume control
    document.getElementById('volumeSlider')?.addEventListener('input', (e) => {
        updateVolume(e.target.value);
    });

    // Initialize audio
    initializeAudio();

    // Initialize connection status
    updateConnectionStatus(false);

    // Handle page unload
    window.addEventListener('beforeunload', () => {
        if (gameState.lobbyRef && gameState.playerId) {
            gameState.lobbyRef.child(`players/${gameState.playerId}`).remove();
        }
    });
});
