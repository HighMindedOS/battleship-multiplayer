// Test
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

// Importiere die benötigten Funktionen aus dem modularen Firebase Realtime Database SDK
// Achte darauf, alle benötigten Funktionen zu importieren, die du im Code verwendest
import { getDatabase, ref, set, onValue, push, remove, update, child, serverTimestamp, onDisconnect, get, onChildAdded } from "firebase/database";


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

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Analytics (optional, but good to keep if you use it)
//const analytics = getAnalytics(app); // Deaktiviert, da analytics nicht im Code verwendet wird

// Initialize Realtime Database using the modular approach
const database = getDatabase(app); // Hol die Datenbank-Instanz von deiner initialisierten App

// Game State
const gameState = {
    currentScreen: 'lobby',
    playerName: '',
    playerId: null,
    lobbyId: null,
    lobbyRef: null, // Diese Variable wird nun eine modulare Datenbank-Referenz halten
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

    // Create lobby in Firebase using modular syntax
    gameState.lobbyRef = ref(database, `lobbies/${gameState.lobbyId}`); // MODULAR: ref()

    const lobbyData = {
        created: serverTimestamp(), // MODULAR: serverTimestamp()
        host: gameState.playerId,
        players: {
            [gameState.playerId]: {
                name: playerName,
                ready: false,
                board: null,
                ships: null, // Initially null
                shots: []
            }
        },
        gameState: 'waiting',
        currentTurn: null,
        winner: null
    };

    set(gameState.lobbyRef, lobbyData) // MODULAR: set()
        .then(() => {
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

    // Check if lobby exists using modular syntax
    const lobbyToCheckRef = ref(database, `lobbies/${gameState.lobbyId}`); // MODULAR: ref()

    get(lobbyToCheckRef) // MODULAR: get() for single read
        .then(snapshot => {
            if (!snapshot.exists()) {
                showNotification('Lobby nicht gefunden!', 'error');
                return;
            }

            const lobbyData = snapshot.val();
            const playerCount = lobbyData.players ? Object.keys(lobbyData.players).length : 0; // Handle case with no players yet

            if (playerCount >= 2) {
                showNotification('Lobby ist voll!', 'error');
                return;
            }

            // Join lobby using modular syntax
            gameState.lobbyRef = lobbyToCheckRef; // Store the reference
            const newPlayerRef = child(gameState.lobbyRef, `players/${gameState.playerId}`); // MODULAR: child()

            set(newPlayerRef, { // MODULAR: set()
                name: playerName,
                ready: false,
                board: null,
                ships: null, // Initially null
                shots: []
            }).then(() => {
                setupLobbyListeners();
                showScreen('waiting');
                showNotification('Lobby beigetreten!', 'success');
            }).catch(error => {
                 showNotification('Fehler beim Beitreten (Spieler hinzufügen): ' + error.message, 'error');
            });
    }).catch(error => {
        showNotification('Fehler beim Beitreten (Lobby prüfen): ' + error.message, 'error');
    });
}

function setupLobbyListeners() {
    if (!gameState.lobbyRef) {
        console.error("Lobby reference is not set.");
        return;
    }

    // Listen for player changes using modular syntax
    const playersRef = child(gameState.lobbyRef, 'players'); // MODULAR: child()
    onValue(playersRef, snapshot => { // MODULAR: onValue()
        const players = snapshot.val() || {};
        updatePlayersList(players);

        // Check if both players are present
        if (Object.keys(players).length === 2 && gameState.currentScreen === 'waiting') {
            // Optional: Add a small delay to ensure UI updates
            setTimeout(() => {
                showScreen('placement');
                initializePlacement();
            }, 500); // Reduced delay slightly
        }
    });

    // Listen for game state changes using modular syntax
     const gameStateRef = child(gameState.lobbyRef, 'gameState'); // MODULAR: child()
    onValue(gameStateRef, snapshot => { // MODULAR: onValue()
        const state = snapshot.val();

        // Check if the game state is changing to 'playing'
        if (state === 'playing' && gameState.currentScreen !== 'game') {
            showScreen('game');
            initializeGame(); // Initialize game when state becomes 'playing'
        } else if (state === 'gameover' && gameState.currentScreen !== 'gameover') {
            showScreen('gameover');
             // You might want to fetch the winner here
             get(child(gameState.lobbyRef, 'winner')).then(winnerSnapshot => {
                 const winnerId = winnerSnapshot.val();
                 const winnerName = winnerId === gameState.playerId ? 'Du' : 'Gegner'; // Basic winner name display
                 document.getElementById('gameOverMessage').textContent = `${winnerName} hat gewonnen!`; // Assuming you have this element
             });
        }
    });


    // Listen for turn changes using modular syntax
    const currentTurnRef = child(gameState.lobbyRef, 'currentTurn'); // MODULAR: child()
    onValue(currentTurnRef, snapshot => { // MODULAR: onValue()
        gameState.currentTurn = snapshot.val();
        updateTurnIndicator();
    });

     // IMPORTANT: Set up listener for enemy shots ONLY when the game starts and the enemy ID is known
     // This listener should ideally be set up within initializeGame() or after the enemyId is determined.
     // Leaving this comment here for now, as getEnemyId() is still a placeholder.
     /*
    if (gameState.currentScreen === 'game') {
        const enemyId = getEnemyId(); // Need actual implementation for getEnemyId()
        if (enemyId) {
            const enemyShotsRef = child(gameState.lobbyRef, `players/${enemyId}/shots`);
             onChildAdded(enemyShotsRef, snapshot => { // MODULAR: onChildAdded()
                const shot = snapshot.val();
                handleEnemyShot(shot);
             });
        }
    }
    */

    // Handle disconnection using modular syntax
    const currentPlayerRef = child(gameState.lobbyRef, `players/${gameState.playerId}`); // MODULAR: child()
    onDisconnect(currentPlayerRef).remove(); // MODULAR: onDisconnect().remove()
}

function updatePlayersList(players) {
    const playersList = document.getElementById('playersList');
}
