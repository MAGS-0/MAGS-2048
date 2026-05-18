import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Dimensions, PanResponder, Alert, TouchableOpacity, Animated } from 'react-native';
import { initializeGrid, moveGrid, isGameOver } from '../utils/gameLogic';
import { saveGameState, loadGameState, getHighScore, saveHighScore, saveUsername, getUsername, saveCoins, getCoins } from '../utils/storage';
import { submitGlobalScore } from '../utils/firebase';
import Tile from '../components/Tile';
import Confetti from '../components/Confetti';
import UsernameModal from '../components/UsernameModal';

// Safely display mock fallback layout if AdMob isn't natively bound
const BannerAdMock = ({ onFailed }) => (
  <View style={styles.adBanner}>
    <Text style={styles.adTag}>Ad Mock</Text>
    <Text style={styles.adBannerText}>Remove Ads — $2.99</Text>
    <TouchableOpacity style={styles.adCloseBtn} onPress={onFailed}>
      <Text style={styles.adCloseText}>×</Text>
    </TouchableOpacity>
  </View>
);

// Import our wrapper utilities to prevent crashes and stream low-latency audio
import { logGameEvent } from '../utils/analytics';
import { 
  preloadGameAudio, 
  playSwipeSound, 
  playMergeSound, 
  playPowerUpSound, 
  playGameStateSound 
} from '../utils/audioController';

const { width } = Dimensions.get('window');
const CELL_SIZE = (width - 40) / 4;

export default function GameScreen({ navigation }) {
  const [grid, setGrid] = useState(initializeGrid());
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [history, setHistory] = useState([]);
  const [username, setUsername] = useState(null);
  const [showNameModal, setShowNameModal] = useState(false);
  
  const [newTileCoord, setNewTileCoord] = useState(null);
  const [mergedCoords, setMergedCoords] = useState([]);
  const [showConfetti, setShowConfetti] = useState(false);

  // --- STATES FOR SETTINGS INTERFACE ---
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticEnabled, setHapticEnabled] = useState(true);

  // --- STATES FOR DELETE POWER-UP ---
  const [isDeleteMode, setIsDeleteMode] = useState(false);

  // --- UNIFIED COIN ECONOMY STATE ---
  const [coins, setCoins] = useState(0);

  // --- AD VISIBILITY TRACKER ---
  const [showAd, setShowAd] = useState(true);

  // --- NEW STATE FOR CUSTOM GAME OVER SCREEN ---
  const [showGameOverScreen, setShowGameOverScreen] = useState(false);

  const scoreBounce = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const init = async () => {
      // Preload the sound files into memory right away
      await preloadGameAudio();

      // Load or initialize our central wallet profile values
      const storedCoins = await getCoins();
      if (storedCoins === null) {
        // Brand new installation profile detected! Give welcome gift.
        setCoins(5);
        await saveCoins(5);
        Alert.alert(
          "🎁 Welcome Bonus!",
          "You have been awarded a complimentary Welcome Bonus of 5 Coins! Use them to activate Undo and Delete power-ups during your matches.",
          [{ text: "Awesome!", style: "default" }]
        );
      } else {
        // Load player's existing saved wallet total balance
        setCoins(storedCoins);
      }

      const saved = await loadGameState();
      if (saved && saved.grid) {
        setGrid(saved.grid);
        setScore(saved.score);
      } else {
        // Play the game start sound if no saved state exists
        playGameStateSound('start', soundEnabled, hapticEnabled);
      }
      const high = await getHighScore();
      setHighScore(high);
      
      const storedName = await getUsername();
      setUsername(storedName);

      logGameEvent('screen_view', {
        screen_name: 'GameScreen',
        purpose: 'active_gameplay'
      });
    };
    init();
  }, []);

  const triggerScoreAnimation = () => {
    Animated.sequence([
      Animated.timing(scoreBounce, { toValue: 1.2, duration: 100, useNativeDriver: true }),
      Animated.timing(scoreBounce, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const handleNameSave = async (name) => {
    await saveUsername(name);
    setUsername(name);
    setShowNameModal(false);
    await submitGlobalScore(name, score, '4x4');
  };

  const updateWalletCoins = async (newBalance) => {
    setCoins(newBalance);
    await saveCoins(newBalance);
  };

  const resetGame = () => {
    logGameEvent('game_restart', {
      current_score_at_reset: score,
      moves_made_before_reset: history.length
    });

    // Play start sound on game reset
    playGameStateSound('start', soundEnabled, hapticEnabled);

    setNewTileCoord(null);
    setMergedCoords([]);
    setShowConfetti(false);
    setIsDeleteMode(false);
    setShowGameOverScreen(false); // Close Game Over layout screen if open

    const newGrid = initializeGrid();
    setGrid(newGrid);
    setScore(0);
    setHistory([]);
    saveGameState(newGrid, 0);
  };

  const handleMove = async (direction) => {
    // Block swiping if player is selecting a tile to delete or if game is already over
    if (isDeleteMode || showGameOverScreen) return;

    const oldGrid = JSON.parse(JSON.stringify(grid));
    const result = moveGrid(grid, direction);
    
    if (result.changed) {
      setHistory(prev => [...prev, { grid: oldGrid, score }]);
      
      const nextScore = score + result.score;
      const nextGrid = result.grid;

      let newCoord = null;
      let merges = [];
      let milestoneReached = false;
      let topMergedValue = 0;

      // 1. Map out all values that already existed on the board before the move
      const preExistingTiles = [];
      oldGrid.forEach(row => row.forEach(cell => {
        if (cell > 0) preExistingTiles.push(cell);
      }));

      nextGrid.forEach((row, r) => {
        row.forEach((cell, c) => {
          if (oldGrid[r][c] === 0 && nextGrid[r][c] !== 0) {
            newCoord = `${r}-${c}`;
          }
          
          // 2. Strict Check: A true merge only occurs if the spot changed AND its new value 
          // did not just slide there from another position unchanged.
          if (nextGrid[r][c] > oldGrid[r][c] && oldGrid[r][c] !== 0) {
              
              // Find index of one matching pre-existing tile to account for it sliding
              const index = preExistingTiles.indexOf(nextGrid[r][c]);
              
              if (index === -1) {
                // If the new tile value wasn't just floating around previously, it's a real merge event!
                merges.push(`${r}-${c}`);
                if (nextGrid[r][c] > topMergedValue) {
                  topMergedValue = nextGrid[r][c];
                }
                if (nextGrid[r][c] >= 512) milestoneReached = true;
              } else {
                // Remove it from tracking pool so duplicates register correctly
                preExistingTiles.splice(index, 1);
              }
          }
        });
      });

      // Handle custom mechanical sound routing based on move types
      if (topMergedValue > 0) {
        playMergeSound(topMergedValue, soundEnabled, hapticEnabled);
      } else {
        playSwipeSound(direction, soundEnabled, hapticEnabled);
      }

      // --- IN-GAME ECONOMY REWARD MECHANIC ---
      // Reward the user with 1 coin automatically whenever they create a 2048 tile or higher!
      if (topMergedValue >= 2048) {
        const updatedCoins = coins + 1;
        await updateWalletCoins(updatedCoins);
        Alert.alert(
          "🪙 Milestone Earned!",
          `Amazing! You unlocked a ${topMergedValue} tile and earned +1 Coin! Keep it up.`,
          [{ text: "Sweet!", style: "default" }]
        );
      }

      if (topMergedValue >= 128) {
        logGameEvent('score_milestone', {
          tile_value: topMergedValue,
          current_total_score: nextScore
        });
      }

      if (milestoneReached) {
        setShowConfetti(false);
        setTimeout(() => setShowConfetti(true), 10);
        setTimeout(() => setShowConfetti(false), 2000);
      }

      setNewTileCoord(newCoord);
      setMergedCoords(merges);
      if (result.score > 0) triggerScoreAnimation();

      setGrid(nextGrid);
      setScore(nextScore);
      saveGameState(nextGrid, nextScore);

      if (nextScore > highScore) {
        setHighScore(nextScore);
        saveHighScore(nextScore);
      }

      if (isGameOver(nextGrid)) {
        logGameEvent('game_over', {
          final_score: nextScore,
          highest_score_record: Math.max(nextScore, highScore),
          total_moves_played: history.length + 1
        });

        // Trigger our beautiful descending game over audio track
        playGameStateSound('gameover', soundEnabled, hapticEnabled);

        if (username) {
          await submitGlobalScore(username, nextScore, '4x4');
        } else {
          setShowNameModal(true);
        }

        // Trigger our beautiful custom layout overlay screen instead of native popup alerts!
        setShowGameOverScreen(true);
      }
    }
  };

  const handleUndo = async () => {
    // Intercept if wallet doesn't contain enough balance
    if (coins < 1) {
      Alert.alert("Insufficient Coins", "An Undo action costs 1 Coin. Watch a rewarded video ad or earn higher tiles to get more!");
      return;
    }

    if (history.length > 0) {
      logGameEvent('powerup_used', {
        type: 'undo_move',
        score_at_time_of_use: score
      });

      // Play structural system reverse sound effect
      playPowerUpSound('undo', soundEnabled, hapticEnabled);

      const previousState = history[history.length - 1];
      setNewTileCoord(null);
      setMergedCoords([]);
      setIsDeleteMode(false);
      setShowGameOverScreen(false); // Safely reverse and hide game over layout
      setGrid(previousState.grid);
      setScore(previousState.score);
      setHistory(prev => prev.slice(0, -1));
      saveGameState(previousState.grid, previousState.score);

      // Deduct 1 coin from unified balance dynamically
      await updateWalletCoins(coins - 1);
    }
  };

  const handleTileSelect = async (r, c) => {
    if (!isDeleteMode) return;
    if (grid[r][c] === 0) return;

    let activeTileCount = 0;
    grid.forEach(row => row.forEach(cell => { if (cell !== 0) activeTileCount++; }));

    if (activeTileCount <= 1) {
      Alert.alert("Action Blocked", "You cannot delete a tile if it is the only one remaining on the board!");
      setIsDeleteMode(false);
      return;
    }

    logGameEvent('powerup_used', {
      type: 'delete_tile',
      deleted_tile_value: grid[r][c],
      score_at_time_of_use: score
    });

    // Play tile delete pop audio asset
    playPowerUpSound('delete', soundEnabled, hapticEnabled);

    const oldGrid = JSON.parse(JSON.stringify(grid));
    setHistory(prev => [...prev, { grid: oldGrid, score }]);

    const nextGrid = grid.map(row => [...row]);
    nextGrid[r][c] = 0;

    setNewTileCoord(null);
    setMergedCoords([]);
    setGrid(nextGrid);
    setIsDeleteMode(false);
    setShowGameOverScreen(false); // Hide overlay to let user play their newly opened square!
    saveGameState(nextGrid, score);

    // Deduct 2 coins from unified balance dynamically on completion
    await updateWalletCoins(coins - 2);
  };

  const toggleDeleteMode = () => {
    if (coins < 2 && !isDeleteMode) {
      Alert.alert("Insufficient Coins", "Deleting a tile costs 2 Coins. Watch a rewarded video ad or earn higher tiles to get more!");
      return;
    }
    setIsDeleteMode(!isDeleteMode);
  };

  const triggerGameOverDeleteMode = () => {
    if (coins < 2) {
      Alert.alert("Insufficient Coins", "Deleting a tile costs 2 Coins. Watch a rewarded video ad or earn higher tiles to get more!");
      return;
    }
    setShowGameOverScreen(false);
    setIsDeleteMode(true);
    Alert.alert("Power-Up Activated", "Select any numbered tile on the board to clear it and keep playing!");
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderRelease: (e, gestureState) => {
      const { dx, dy } = gestureState;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 30) handleMove('right');
        else if (dx < -30) handleMove('left');
      } else {
        if (dy > 30) handleMove('down');
        else if (dy < -30) handleMove('up');
      }
    },
  });

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {/* HEADER SECTION */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>2048</Text>
          <Text style={styles.subtitle}>Join tiles to win!</Text>
        </View>
        <View style={styles.scoreBoard}>
          <Animated.View style={[styles.scoreContainer, { transform: [{ scale: scoreBounce }] }]}>
            <Text style={styles.scoreLabel}>SCORE</Text>
            <Text style={styles.scoreValue}>{score}</Text>
          </Animated.View>
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreLabel}>BEST</Text>
            <Text style={styles.scoreValue}>{highScore}</Text>
          </View>
          {/* THE GAME SCREEN WALLET CONTAINER */}
          <View style={[styles.scoreContainer, styles.coinWalletContainer]}>
            <Text style={[styles.scoreLabel, styles.coinLabelText]}>COINS</Text>
            <Text style={styles.coinValueText}>🪙 {coins}</Text>
          </View>
        </View>
      </View>

      {/* AD CONTAINER SECTION */}
      <View style={styles.adWrapper}>
        {showAd && (
          <BannerAdMock onFailed={() => setShowAd(false)} />
        )}
      </View>

      {/* COMPACT BOARD MATRIX LAYER */}
      <View style={styles.grid}>
        <View style={styles.backgroundGrid}>
          {Array(16).fill(null).map((_, i) => (
            <View key={`bg-${i}`} style={styles.cellPlaceholder} />
          ))}
        </View>
        <View style={styles.tileContainer}>
          {grid.map((row, r) => row.map((cell, c) => (
            <TouchableOpacity 
              key={`tile-trigger-${r}-${c}`}
              activeOpacity={isDeleteMode ? 0.5 : 1}
              onPress={() => handleTileSelect(r, c)}
              disabled={!isDeleteMode}
              style={{ 
                position: 'absolute', 
                left: c * CELL_SIZE, 
                top: r * CELL_SIZE,
                width: CELL_SIZE,
                height: CELL_SIZE,
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              {cell !== 0 && (
                <Tile 
                  value={cell} 
                  cellSize={CELL_SIZE} 
                  isNew={newTileCoord === `${r}-${c}`} 
                  isMerged={mergedCoords.includes(`${r}-${c}`)}
                />
              )}
            </TouchableOpacity>
          )))}
        </View>
      </View>

      {/* BOTTOM INTERFACE GRID */}
      <View style={styles.powerUpsWrapper}>
        <Text style={styles.powerUpsTitle}>POWER-UPS</Text>
        
        <View style={styles.powerUpRow}>
          <TouchableOpacity 
            style={[
              styles.powerUpBtn, 
              styles.undoBtn, 
              (history.length === 0 || coins < 1) && styles.disabledBtn
            ]} 
            onPress={handleUndo}
            disabled={history.length === 0 || coins < 1}
          >
            <Text style={[styles.powerUpBtnText, (history.length === 0 || coins < 1) && styles.disabledBtnText]}>
              ↩ Undo  <Text style={styles.coinCostBadge}>1 🪙</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.powerUpBtn, 
              styles.deleteBtn, 
              isDeleteMode && styles.activeDeleteBtn,
              (coins < 2 && !isDeleteMode) && styles.disabledBtn
            ]} 
            onPress={toggleDeleteMode}
            disabled={coins < 2 && !isDeleteMode}
          >
            <Text style={[styles.powerUpBtnText, (coins < 2 && !isDeleteMode) && styles.disabledBtnText]}>
              {isDeleteMode ? "📭 Select Tile..." : "✕ Delete  "}
              {!isDeleteMode && <Text style={styles.coinCostBadge}>2 🪙</Text>}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.powerUpRow}>
          <TouchableOpacity 
            style={[styles.powerUpBtn, styles.homeBtn]} 
            onPress={() => {
              Alert.alert(
                "Start New Game?",
                "Are you sure you want to end this game? Your current progress will be lost.",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Start New", style: "destructive", onPress: () => resetGame() }
                ]
              );
            }}
          >
            <Text style={styles.powerUpBtnText}>🔄Restart</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.powerUpBtn, styles.settingsBtn]}
            onPress={() => setShowSettingsModal(true)}
          >
            <Text style={styles.powerUpBtnText}>⚙️ Settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* SETTINGS OVERLAY MODAL */}
      {showSettingsModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.settingsCard}>
            <Text style={styles.settingsTitle}>Settings</Text>
            
            {/* SOUND TOGGLE */}
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Sound Effects</Text>
              <TouchableOpacity 
                style={soundEnabled ? styles.toggleActive : styles.toggleInactive} 
                onPress={() => setSoundEnabled(!soundEnabled)}
              >
                <Text style={styles.toggleText}>{soundEnabled ? "ON" : "OFF"}</Text>
              </TouchableOpacity>
            </View>

            {/* HAPTIC TOGGLE */}
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Haptic Feedback</Text>
              <TouchableOpacity 
                style={hapticEnabled ? styles.toggleActive : styles.toggleInactive} 
                onPress={() => setHapticEnabled(!hapticEnabled)}
              >
                <Text style={styles.toggleText}>{hapticEnabled ? "ON" : "OFF"}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.menuItemBtn} onPress={() => Alert.alert("How to Play", "Slide matching number blocks into each other to add them up and reach the 2048 tile!")}>
              <Text style={styles.menuItemText}>📖 How to Play Tutorial</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeSettingsBtn} onPress={() => setShowSettingsModal(false)}>
              <Text style={styles.closeSettingsText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* --- BRAND NEW FULL SCREEN GAME OVER SCREEN OVERLAY --- */}
      {showGameOverScreen && (
        <View style={styles.modalOverlay}>
          <View style={styles.gameOverCard}>
            <Text style={styles.gameOverEmoji}>🎮</Text>
            <Text style={styles.gameOverTitle}>Game Over</Text>
            
            <View style={styles.finalScoreRow}>
              <View style={styles.finalScoreBox}>
                <Text style={styles.finalScoreLabel}>FINAL SCORE</Text>
                <Text style={styles.finalScoreValue}>{score}</Text>
              </View>
              {/* THE GAME OVER CARD WALLET CONTAINER */}
              <View style={[styles.finalScoreBox, styles.gameOverWalletBox]}>
                <Text style={styles.gameOverWalletLabel}>YOUR WALLET</Text>
                <Text style={styles.gameOverWalletValue}>🪙 {coins} Coins</Text>
              </View>
            </View>

            <Text style={styles.gameOverHelpText}>Spend coins to purchase a lifeline power-up or restart clean:</Text>

            {/* OPTIONS ROW 1: UNDO & DELETE */}
            <View style={styles.gameOverBtnRow}>
              <TouchableOpacity 
                style={[
                  styles.gameOverBtn, 
                  styles.undoBtn, 
                  (history.length === 0 || coins < 1) && styles.disabledBtn
                ]} 
                onPress={handleUndo}
                disabled={history.length === 0 || coins < 1}
              >
                <Text style={[styles.powerUpBtnText, (history.length === 0 || coins < 1) && styles.disabledBtnText]}>
                  ↩ Undo (1 🪙)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.gameOverBtn, 
                  styles.deleteBtn,
                  coins < 2 && styles.disabledBtn
                ]} 
                onPress={triggerGameOverDeleteMode}
                disabled={coins < 2}
              >
                <Text style={[styles.powerUpBtnText, coins < 2 && styles.disabledBtnText]}>
                  ✕ Delete (2 🪙)
                </Text>
              </TouchableOpacity>
            </View>

            {/* OPTIONS ROW 2: RESTART & HOME */}
            <View style={styles.gameOverBtnRow}>
              <TouchableOpacity style={[styles.gameOverBtn, styles.homeBtn]} onPress={resetGame}>
                <Text style={styles.powerUpBtnText}>🔄Restart</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.gameOverBtn, styles.settingsBtn]} onPress={() => { setShowGameOverScreen(false); navigation.navigate('Home'); }}>
                <Text style={styles.powerUpBtnText}>🏠 Home Menu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <Confetti active={showConfetti} />
      <UsernameModal visible={showNameModal} onSave={handleNameSave} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf8ef', alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  header: { flexDirection: 'row', width: width - 40, justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  titleContainer: { alignItems: 'flex-start' },
  title: { fontSize: 36, fontWeight: 'bold', color: '#776e65', lineHeight: 38 },
  subtitle: { color: '#776e65', fontSize: 13, fontWeight: '500', opacity: 0.8 },
  scoreBoard: { flexDirection: 'row' },
  scoreContainer: { backgroundColor: '#bbada0', padding: 8, borderRadius: 5, alignItems: 'center', minWidth: 62, marginLeft: 4 },
  scoreLabel: { color: '#eee4da', fontSize: 10, fontWeight: 'bold' },
  scoreValue: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  
  // Custom styled golden top bar element for your cash wallet balance
  coinWalletContainer: { backgroundColor: '#e1b024', borderItemWidth: 1, borderColor: '#cca01d', minWidth: 68 },
  coinLabelText: { color: '#ffffff', opacity: 0.95 },
  coinValueText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },

  adWrapper: { width: width - 40, minHeight: 50, marginVertical: 12, justifyContent: 'center', alignItems: 'center' },
  adBanner: { flexDirection: 'row', backgroundColor: '#7c5bc4', width: '100%', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'space-between' },
  adTag: { backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 10, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3, fontWeight: 'bold' },
  adBannerText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  adCloseBtn: { paddingHorizontal: 4 },
  adCloseText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', opacity: 0.7 },

  grid: { width: width - 40, height: width - 40, backgroundColor: '#bbada0', borderRadius: 6, position: 'relative', overflow: 'hidden' },
  backgroundGrid: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', flexWrap: 'wrap', padding: 5 },
  tileContainer: { ...StyleSheet.absoluteFillObject, padding: 5 },
  cellPlaceholder: { width: (width - 50) / 4 - 10, height: (width - 50) / 4 - 10, margin: 5, borderRadius: 5, backgroundColor: 'rgba(238, 228, 218, 0.35)' },

  powerUpsWrapper: { width: width - 40, marginTop: 20 },
  powerUpsTitle: { fontSize: 11, fontWeight: 'bold', color: '#bbada0', marginBottom: 6, letterSpacing: 0.5 },
  powerUpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  powerUpBtn: { paddingVertical: 14, borderRadius: 6, width: '48.5%', alignItems: 'center', justifyContent: 'center' },
  powerUpBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  coinCostBadge: { backgroundColor: 'rgba(0,0,0,0.18)', fontSize: 12, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, overflow: 'hidden', color: '#fff', fontWeight: 'bold' },
  
  undoBtn: { backgroundColor: '#f9945c' },
  deleteBtn: { backgroundColor: '#ff6b54' },
  activeDeleteBtn: { backgroundColor: '#c43d27' },
  homeBtn: { backgroundColor: '#8f7a66' }, 
  settingsBtn: { backgroundColor: '#bbada0' }, 
  
  disabledBtn: { backgroundColor: '#e4dbd2', opacity: 0.5 },
  disabledBtnText: { color: '#a69a8f', textDecorationLine: 'line-through' },

  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.55)', justifyContent: 'center', alignItems: 'center', zIndex: 2000 },
  settingsCard: { width: width * 0.8, backgroundColor: '#faf8ef', padding: 24, borderRadius: 10, alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
  settingsTitle: { fontSize: 26, fontWeight: 'bold', color: '#776e65', marginBottom: 20 },
  settingRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee4da' },
  settingLabel: { fontSize: 16, fontWeight: '600', color: '#776e65' },
  toggleActive: { backgroundColor: '#8f7a66', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 4 },
  toggleInactive: { backgroundColor: '#e4dbd2', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 4 },
  toggleText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  menuItemBtn: { width: '100%', paddingVertical: 14, backgroundColor: '#bbada0', borderRadius: 6, alignItems: 'center', marginTop: 16 },
  menuItemText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  closeSettingsBtn: { marginTop: 24, paddingVertical: 10, width: '100%', alignItems: 'center' },
  closeSettingsText: { color: '#776e65', fontSize: 15, fontWeight: 'bold', opacity: 0.8 },

  gameOverCard: { width: width * 0.85, backgroundColor: '#faf8ef', padding: 24, borderRadius: 12, alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
  gameOverEmoji: { fontSize: 42, marginBottom: 5 },
  gameOverTitle: { fontSize: 32, fontWeight: 'bold', color: '#776e65', marginBottom: 15 },
  finalScoreRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 15 },
  finalScoreBox: { backgroundColor: '#bbada0', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center', width: '48.5%' },
  finalScoreLabel: { color: '#eee4da', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  finalScoreValue: { color: '#ffffff', fontSize: 22, fontWeight: 'bold', marginTop: 2 },
  
  // Custom styled overlay container for wallet data during defeat states
  gameOverWalletBox: { backgroundColor: '#e1b024' },
  gameOverWalletLabel: { color: '#fffdf0', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  gameOverWalletValue: { color: '#ffffff', fontSize: 20, fontWeight: 'bold', marginTop: 2 },

  gameOverHelpText: { color: '#776e65', fontSize: 13, textAlign: 'center', marginBottom: 20, opacity: 0.8, paddingHorizontal: 10 },
  gameOverBtnRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 12 },
  gameOverBtn: { paddingVertical: 14, borderRadius: 6, width: '48.5%', alignItems: 'center', justifyContent: 'center' }
});