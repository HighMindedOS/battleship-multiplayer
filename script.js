    // Listen for game state changes using modular syntax
     const gameStateRef = child(gameState.lobbyRef, 'gameState'); // MODULAR: child()
    onValue(gameStateRef, snapshot => { // MODULAR: onValue()
        const state = snapshot.val();

        // Check if the game state is changing to 'playing'
        if (state === 'playing' && gameState.currentScreen !== 'game') {
            showScreen('game');
            initializeGame(); // Initialize game when state becomes 'playing'
        } else if (state === 'gameover' && gameState.currentScreen !== 'gameover') { // <-- Hier wurde die Bedingung vervollständigt
            showScreen('gameover');
             // You might want to fetch the winner here
             get(child(gameState.lobbyRef, 'winner')).then(winnerSnapshot => {
                 const winnerId = winnerSnapshot.val();
                 const winnerName = winnerId === gameState.playerId ? 'Du' : 'Gegner'; // Basic winner name display
                 const gameOverMessageElement = document.getElementById('gameOverMessage');
                 if (gameOverMessageElement) {
                     gameOverMessageElement.textContent = `${winnerName} hat gewonnen!`; // Assuming you have this element
                 } else {
                     console.warn("Game over message element not found.");
                 }
             });
        }
         // <-- HIER FEHLTE DIE SCHLIESSENDE KLAMMER für die Funktion, die onValue übergeben wird
    }); // <-- HIER FEHLTE DIE SCHLIESSENDE KLAMMER für onValue


    // Listen for turn changes using modular syntax
    const currentTurnRef = child(gameState.lobbyRef, 'currentTurn'); // MODULAR: child()
    onValue(currentTurnRef, snapshot => { // MODULAR: onValue()
        gameState.currentTurn = snapshot.val();
        updateTurnIndicator(); // <-- Diese Funktion muss existieren oder implementiert werden
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
                handleEnemyShot(shot); // <-- Diese Funktion muss existieren oder implementiert werden
             });
        }
    }
    */

    // Handle disconnection using modular syntax
    const currentPlayerRef = child(gameState.lobbyRef, `players/${gameState.playerId}`); // MODULAR: child()
    onDisconnect(currentPlayerRef).remove(); // MODULAR: onDisconnect().remove()

// <-- HIER FEHLTE DIE SCHLIESSENDE KLAMMER für die setupLobbyListeners Funktion
}

// --- NEU: FÜGEN SIE HIER DIE FUNKTIONEN HINZU, DIE NOCH FEHLEN ODER UNVOLLSTÄNDIG WAREN
// z.B.
function updatePlayersList(players) {
    const playersList = document.getElementById('playersList');
     if (!playersList) {
        console.warn("Players list element not found.");
        return;
     }
    // Hier kommt die Logik, um die Spielerliste anzuzeigen
    // Beispiel: playersList.innerHTML = Object.values(players).map(p => `<li>${p.name} ${p.ready ? '(Bereit)' : ''}</li>`).join('');
}

// Funktion, die aufgerufen wird, wenn der Benutzer angemeldet ist
function handleUserAuthenticated(user) {
    if (user) {
        // Benutzer ist angemeldet
        gameState.playerId = user.uid;
        console.log("Firebase User Authenticated. UID:", user.uid);
        showNotification(`Angemeldet als: ${user.uid.substring(0, 6)}...`, 'info'); // Kurze Info-Nachricht
        showScreen('lobby'); // Zeige jetzt den Lobby-Screen

        // --- NEU: Optional: OnDisconnect für den angemeldeten Benutzer einrichten
        // Dieser Listener sorgt dafür, dass der Benutzer aus der "onlineUsers" Liste entfernt wird, wenn er offline geht.
        // Sie müssen eine "onlineUsers" Liste in Ihrer Datenbank führen, falls Sie das wollen.
        /*
        const onlineUsersRef = ref(database, 'onlineUsers/' + user.uid);
        onDisconnect(onlineUsersRef).remove();
        set(onlineUsersRef, true); // Oder setzen Sie hier den Namen des Spielers
        */

    } else {
        // Benutzer ist abgemeldet (sollte bei anonymer Auth nicht passieren, außer der Token läuft ab)
        gameState.playerId = null;
        console.log("Firebase User is signed out.");
        showNotification('Abgemeldet. Bitte neu laden.', 'warning');
        // Optional: Zurück zum Ladescreen oder Fehlermeldung anzeigen
        showScreen('loading');
         showLoading(true);
    }
     // --- NEU: Ladeanzeige ausblenden, sobald der Auth-Status bekannt ist
     showLoading(false);
}

// Funktion, die das Spiel initialisiert (muss noch implementiert werden)
function initializeGame() {
    console.log("Spiel wird initialisiert...");
    // Hier kommt die Logik zur Einrichtung des Spielfelds etc.
    createGrid('myBoardContainer', false); // Eigene Tafel erstellen
    createGrid('enemyBoardContainer', true); // Gegnerische Tafel erstellen
    // updateTurnIndicator(); // Stellen Sie sicher, dass der Zugindikator korrekt gesetzt wird
    // Richten Sie jetzt den enemyShotsRef Listener ein, wenn der Gegner bekannt ist!
}

// Funktion, die den Zugindikator aktualisiert (muss noch implementiert werden)
function updateTurnIndicator() {
     console.log("Zugindikator wird aktualisiert. Aktueller Zug:", gameState.currentTurn);
     // Hier kommt die Logik, um anzuzeigen, wer am Zug ist
     const turnIndicatorElement = document.getElementById('turnIndicator'); // Element in Ihrer HTML
     if (turnIndicatorElement) {
         if (gameState.currentTurn === gameState.playerId) {
             turnIndicatorElement.textContent = 'Du bist am Zug!';
         } else if (gameState.currentTurn) {
             // Wenn der Gegner angemeldet ist, könnten Sie hier seinen Namen anzeigen
             // Dazu müssten Sie die Spielinformationen aus der Datenbank lesen
             turnIndicatorElement.textContent = 'Gegner ist am Zug!';
         } else {
             turnIndicatorElement.textContent = 'Warte auf den Zug...';
         }
     } else {
         console.warn("Turn indicator element not found.");
     }
}

// Funktion, die den Klick auf das gegnerische Feld verarbeitet (muss noch implementiert werden)
function handleEnemyCellClick(row, col) {
     console.log(`Gegnerisches Feld geklickt: ${row}, ${col}`);
     // Hier kommt die Logik, um einen Schuss abzugeben
     // Stellen Sie sicher, dass nur geschossen werden kann, wenn man am Zug ist
}

// Funktion, um die ID des gegnerischen Spielers zu bekommen (muss noch implementiert werden)
// Dies hängt von der genauen Struktur Ihrer players Daten in der Lobby ab
function getEnemyId(players) {
     if (!players || !gameState.playerId) return null;
     const playerIds = Object.keys(players);
     // Finden Sie die ID, die nicht die eigene ist
     return playerIds.find(id => id !== gameState.playerId);
}

// Funktion, um einen gegnerischen Schuss zu verarbeiten (muss noch implementiert werden)
function handleEnemyShot(shot) {
     console.log("Gegnerischer Schuss erhalten:", shot);
     // Hier kommt die Logik, um den Schuss auf dem eigenen Brett zu verarbeiten
     // Markieren Sie das Feld als getroffen oder verfehlt
     // Prüfen Sie, ob ein Schiff getroffen wurde oder versenkt ist
}


// Funktion, die die Schiffsplatzierung initialisiert (muss noch implementiert werden)
function initializePlacement() {
    console.log("Schiffsplatzierung wird initialisiert...");
    // Logik zum Anzeigen der eigenen Tafel, Schiffe etc.
    createGrid('myBoardContainer', false); // Eigene Tafel erstellen
    // Platzierungslogik hier...
    // showScreen('placement'); // Dieser Screen wird bereits in setupLobbyListeners gewechselt
}


// --- NEU: Starten des Authentifizierungsprozesses, wenn die Seite geladen ist
// Dies ist der erste Code, der nach der Initialisierung ausgeführt wird.
showLoading(true); // Ladeanzeige zeigen, während Auth läuft

onAuthStateChanged(auth, handleUserAuthenticated); // Listener einrichten

// --- Optional: Anonyme Anmeldung versuchen, falls der Nutzer nicht bereits angemeldet ist
// onAuthStateChanged wird auch bei bestehender Sitzung einmal getriggert
// Daher ist es sicherer, signInAnonymously nur aufzurufen, wenn onAuthStateChanged anzeigt,
// dass *kein* Nutzer angemeldet ist, ODER wenn Sie sicher sind, dass Sie immer eine neue anonyme Sitzung wollen.
// Für den Anfang können wir es hier aufrufen, es schadet normalerweise nicht, wenn onAuthStateChanged schon reagiert hat.
signInAnonymously(auth).catch((error) => {
    console.error("Anonyme Anmeldung fehlgeschlagen:", error);
    showNotification('Fehler bei der Anmeldung. Bitte neu laden.', 'error');
     showLoading(false); // Ladeanzeige ausblenden bei Fehler
    // Hier könnten Sie eine Fehlermeldung anzeigen oder den Benutzer bitten, es erneut zu versuchen.
});


// Fügen Sie hier eventuell Event Listener für Buttons hinzu (z.B. für createLobby, joinLobby)
// Diese Listener MÜSSEN außerhalb aller Funktionen liegen und nach der Funktionsdefinition kommen.
document.getElementById('createLobbyButton').addEventListener('click', createLobby);
document.getElementById('joinLobbyButton').addEventListener('click', joinLobby);

// Beispiel für andere Button-Listener (Platzierung, Schuss etc.)
// document.getElementById('placeShipButton').addEventListener('click', placeShip);
// document.getElementById('fireButton').addEventListener('click', handleEnemyCellClick); // Beispiel, muss angepasst werden

// --- NEU: Füge einen Event Listener für den Verbindungsstatus hinzu
const connectedRef = ref(database, ".info/connected");
onValue(connectedRef, (snap) => {
  if (snap.val() === true) {
    console.log("Verbunden mit der Firebase Realtime Database.");
    updateConnectionStatus(true);
  } else {
    console.log("Verbindung zur Firebase Realtime Database verloren.");
     updateConnectionStatus(false);
  }
});
