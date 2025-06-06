// ===================
// Konfiguration
// ===================
const firebaseConfig = {
  apiKey: "AIzaSyC2Vz48b_VROP3g3JaaMZI4CcEl8neeMuM",
  authDomain: "realtime-database-aktivieren.firebaseapp.com",
  databaseURL: "https://realtime-database-aktivieren-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "realtime-database-aktivieren",
  storageBucket: "realtime-database-aktivieren.appspot.com",
  messagingSenderId: "921607081725",
  appId: "1:921607081725:web:7630f400a518ab9507f894",
  measurementId: "G-TKN9TP77G3"
};

// ===================
// Initialisierung
// ===================
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

console.log('Firebase initialized:', !!firebase.apps.length);

database.ref('.info/connected').on('value', (snapshot) => {
  updateConnectionStatus(snapshot.val() === true);
});

// ===================
// Spielstatus
// ===================
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

  shipTypes: [
    { name: 'Träger', size: 5, count: 1, icon: '🚢' },
    { name: 'Schlachtschiff', size: 4, count: 1, icon: '⚓' },
    { name: 'Kreuzer', size: 3, count: 1, icon: '🛥️' },
    { name: 'U-Boot', size: 3, count: 1, icon: '🚤' },
    { name: 'Zerstörer', size: 2, count: 1, icon: '⛵' }
  ],

  myBoard: Array(10).fill(null).map(() => Array(10).fill('water')),
  enemyBoard: Array(10).fill(null).map(() => Array(10).fill('unknown')),
  myShips: [],
  enemyShips: [],
  selectedShip: null,
  shipOrientation: 'horizontal',
  placedShips: [],
  shots: 0,
  hits: 0,
  sunkShips: 0,
  enemySunkShips: {},
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

// ===================
// DOM-Elemente
// ===================
const screens = {
  lobby: document.getElementById('lobbyScreen'),
  waiting: document.getElementById('waitingScreen'),
  placement: document.getElementById('placementScreen'),
  game: document.getElementById('gameScreen'),
  gameover: document.getElementById('gameOverScreen')
};

// ===================
// Audio
// ===================
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

// ===================
// Hilfsfunktionen
// ===================
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
function updatePlayersList(players) {
  const list = document.getElementById('playersList');
  if (!list) return;
  list.innerHTML = '';
  Object.values(players).forEach(player => {
    const li = document.createElement('li');
    li.textContent = `${player.name}${player.ready ? " (bereit)" : ""}`;
    list.appendChild(li);
  });
}
function initializePlacement() {
  // Dummy: Stelle sicher, dass das Placement-UI erscheint
  // Du kannst hier deine eigene Logik für das Schiffsetzen einbauen!
  showNotification('Platziere deine Schiffe!', 'info');
}
function initializeGame() {
  showNotification('Das Spiel beginnt!', 'info');
}
function handleGameOver() {
  showScreen('gameover');
  showNotification('Spiel vorbei!', 'info');
}
function updateTurnIndicator() {
  const indicator = document.getElementById('turnIndicator');
  if (!indicator) return;
  if (gameState.currentTurn === gameState.playerId) {
    indicator.textContent = 'Du bist dran!';
    playSound('turn');
  } else {
    indicator.textContent = 'Gegner ist dran...';
  }
}

// ===================
// LOBBY-Funktionen
// ===================
function createLobby() {
  const playerName = document.getElementById('playerName')?.value.trim();
  if (!playerName) {
    showNotification('Bitte gib einen Namen ein!', 'error');
    return;
  }

  gameState.playerName = playerName;
  gameState.playerId = Date.now().toString();
  gameState.lobbyId = generateLobbyCode();
  gameState.isHost = true;

  // Firebase Lobby anlegen
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
    showNotification('Lobby erstellt! Teile den Code.', 'success');
  }).catch(error => {
    showNotification('Fehler beim Erstellen der Lobby: ' + error.message, 'error');
  });
}

function joinLobby() {
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

  // Lobby suchen
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
    // Beitreten
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

function leaveLobby() {
  if (gameState.lobbyRef && gameState.playerId) {
    gameState.lobbyRef.child(`players/${gameState.playerId}`).remove();
  }
  gameState.lobbyRef = null;
  gameState.playerId = null;
  gameState.lobbyId = null;
  gameState.isHost = false;
  showScreen('lobby');
  showNotification('Lobby verlassen!', 'info');
}

// ===================
// Lobby Listener
// ===================
function setupLobbyListeners() {
  // Player-Änderungen
  gameState.lobbyRef.child('players').on('value', snapshot => {
    const players = snapshot.val() || {};
    updatePlayersList(players);
    // Wenn beide Spieler da sind
    if (Object.keys(players).length === 2 && gameState.currentScreen === 'waiting') {
      setTimeout(() => {
        showScreen('placement');
        initializePlacement();
      }, 1000);
    }
  });
  // Game-State-Änderungen
  gameState.lobbyRef.child('gameState').on('value', snapshot => {
    const state = snapshot.val();
    if (state === 'playing' && gameState.currentScreen !== 'game') {
      showScreen('game');
      initializeGame();
    } else if (state === 'gameover' && gameState.currentScreen !== 'gameover') {
      handleGameOver();
    }
  });
  // Turn-Änderungen
  gameState.lobbyRef.child('currentTurn').on('value', snapshot => {
    gameState.currentTurn = snapshot.val();
    updateTurnIndicator();
  });
  // Disconnect
  gameState.lobbyRef.child(`players/${gameState.playerId}`).onDisconnect().remove();
}

// ===================
// Platzhalter für weitere Spielfunktionen
// ===================

// Hier kannst du z.B. randomPlacement, clearBoard, rotateShip, setPlayerReady, surrenderGame usw. nachbauen.
// Beispiel:
function randomPlacement() { showNotification('Schiffe zufällig platziert!', 'info'); }
function clearBoard() { showNotification('Spielfeld geleert!', 'info'); }
function rotateShip() { showNotification('Schiff gedreht!', 'info'); }
function setPlayerReady() { showNotification('Bereit!', 'info'); }
function surrenderGame() { showNotification('Aufgegeben!', 'info'); }

// ===================
// Event-Listener
// ===================
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('createLobbyBtn')?.addEventListener('click', createLobby);
  document.getElementById('joinLobbyBtn')?.addEventListener('click', joinLobby);
  document.getElementById('leaveLobbyBtn')?.addEventListener('click', leaveLobby);

  document.getElementById('copyLobbyCode')?.addEventListener('click', () => {
    const code = document.getElementById('lobbyCodeDisplay').textContent;
    navigator.clipboard.writeText(code).then(() => {
      showNotification('Code kopiert!', 'success');
    }).catch(() => {
      showNotification('Kopieren fehlgeschlagen', 'error');
    });
  });

  document.getElementById('randomPlaceBtn')?.addEventListener('click', randomPlacement);
  document.getElementById('clearBoardBtn')?.addEventListener('click', clearBoard);
  document.getElementById('rotateBtn')?.addEventListener('click', rotateShip);
  document.getElementById('readyBtn')?.addEventListener('click', setPlayerReady);

  document.getElementById('surrenderBtn')?.addEventListener('click', surrenderGame);
  document.getElementById('newGameBtn')?.addEventListener('click', () => {
    leaveLobby();
    location.reload();
  });

  document.getElementById('volumeSlider')?.addEventListener('input', (e) => {
    updateVolume(e.target.value);
  });

  initializeAudio();
  updateConnectionStatus(false);

  window.addEventListener('beforeunload', () => {
    if (gameState.lobbyRef && gameState.playerId) {
      gameState.lobbyRef.child(`players/${gameState.playerId}`).remove();
    }
  });
});
