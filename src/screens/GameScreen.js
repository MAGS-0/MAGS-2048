import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Dimensions, PanResponder, Alert, TouchableOpacity, Animated } from 'react-native';
import { initializeGrid, moveGrid, isGameOver } from '../utils/gameLogic';
import { saveGameState, loadGameState, getHighScore, saveHighScore, saveUsername, getUsername } from '../utils/storage';
import { submitGlobalScore } from '../utils/firebase';
import Tile from '../components/Tile';
import Confetti from '../components/Confetti';
import UsernameModal from '../components/UsernameModal';

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

  // --- STATES FOR DELETE POWER-UP ---
  const [isDeleteMode, setIsDeleteMode] = useState(false);

  // --- AD VISIBILITY TRACKER ---
  const [showAd, setShowAd] = useState(true);

  const scoreBounce = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const init = async () => {
      const saved = await loadGameState();
      if (saved && saved.grid) {
        setGrid(saved.grid);
        setScore(saved.score);
      }
      const high = await getHighScore();
      setHighScore(high);
      
      const storedName = await getUsername();
      setUsername(storedName);
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

  const resetGame = () => {
    setNewTileCoord(null);
    setMergedCoords([]);
    setShowConfetti(false);
    setIsDeleteMode(false);
    const newGrid = initializeGrid();
    setGrid(newGrid);
    setScore(0);
    setHistory([]);
    saveGameState(newGrid, 0);
  };

  const handleMove = async (direction) => {
    if (isDeleteMode) return;

    const oldGrid = JSON.parse(JSON.stringify(grid));
    const result = moveGrid(grid, direction);
    
    if (result.changed) {
      setHistory(prev => [...prev, { grid: oldGrid, score }]);
      
      const nextScore = score + result.score;
      const nextGrid = result.grid;

      let newCoord = null;
      let merges = [];
      let milestoneReached = false;

      nextGrid.forEach((row, r) => {
        row.forEach((cell, c) => {
          if (oldGrid[r][c] === 0 && nextGrid[r][c] !== 0) {
            newCoord = `${r}-${c}`;
          }
          if (nextGrid[r][c] > oldGrid[r][c] && oldGrid[r][c] !== 0) {
              merges.push(`${r}-${c}`);
              if (nextGrid[r][c] >= 512) milestoneReached = true;
          }
        });
      });

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
        if (username) {
          await submitGlobalScore(username, nextScore, '4x4');
        } else {
          setShowNameModal(true);
        }

        Alert.alert("Game Over", `Your final score is ${nextScore}`, [
          { text: "Return Home", onPress: () => navigation.navigate('Home') },
          { text: "Try Again", onPress: () => resetGame() } 
        ]);
      }
    }
  };

  const handleUndo = () => {
    if (history.length > 0) {
      const previousState = history[history.length - 1];
      setNewTileCoord(null);
      setMergedCoords([]);
      setIsDeleteMode(false);
      setGrid(previousState.grid);
      setScore(previousState.score);
      setHistory(prev => prev.slice(0, -1));
      saveGameState(previousState.grid, previousState.score);
    }
  };

  const handleTileSelect = (r, c) => {
    if (!isDeleteMode) return;
    if (grid[r][c] === 0) return;

    let activeTileCount = 0;
    grid.forEach(row => row.forEach(cell => { if (cell !== 0) activeTileCount++; }));

    if (activeTileCount <= 1) {
      Alert.alert("Action Blocked", "You cannot delete a tile if it is the only one remaining on the board!");
      setIsDeleteMode(false);
      return;
    }

    const oldGrid = JSON.parse(JSON.stringify(grid));
    setHistory(prev => [...prev, { grid: oldGrid, score }]);

    const nextGrid = grid.map(row => [...row]);
    nextGrid[r][c] = 0;

    setNewTileCoord(null);
    setMergedCoords([]);
    setGrid(nextGrid);
    setIsDeleteMode(false);
    saveGameState(nextGrid, score);
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
        </View>
      </View>

      {/* AD CONTAINER SECTION */}
      <View style={styles.adWrapper}>
        {showAd && (
          <View style={styles.adBanner}>
            <Text style={styles.adTag}>Ad Mock</Text>
            <Text style={styles.adBannerText}>Remove Ads — $2.99</Text>
            <TouchableOpacity style={styles.adCloseBtn} onPress={() => setShowAd(false)}>
              <Text style={styles.adCloseText}>×</Text>
            </TouchableOpacity>
          </View>
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
            style={[styles.powerUpBtn, styles.undoBtn, history.length === 0 && styles.disabledBtn]} 
            onPress={handleUndo}
            disabled={history.length === 0}
          >
            <Text style={[styles.powerUpBtnText, history.length === 0 && styles.disabledBtnText]}>
              ↩ Undo  <Text style={styles.badge}>3</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.powerUpBtn, styles.deleteBtn, isDeleteMode && styles.activeDeleteBtn]} 
            onPress={() => setIsDeleteMode(!isDeleteMode)}
          >
            <Text style={styles.powerUpBtnText}>
              {isDeleteMode ? "📭 Select Tile..." : "✕ Delete Tile  "}
              {!isDeleteMode && <Text style={styles.badge}>2</Text>}
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
            
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Sound Effects</Text>
              <TouchableOpacity style={styles.toggleActive} onPress={() => Alert.alert("Sound Toggle", "Functionality coming soon!")}>
                <Text style={styles.toggleText}>ON</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Haptic Feedback</Text>
              <TouchableOpacity style={styles.toggleActive} onPress={() => Alert.alert("Haptics Toggle", "Functionality coming soon!")}>
                <Text style={styles.toggleText}>ON</Text>
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
  scoreContainer: { backgroundColor: '#bbada0', padding: 8, borderRadius: 5, alignItems: 'center', minWidth: 72, marginLeft: 6 },
  scoreLabel: { color: '#eee4da', fontSize: 10, fontWeight: 'bold' },
  scoreValue: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  
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
  badge: { backgroundColor: 'rgba(0,0,0,0.15)', fontSize: 11, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, overflow: 'hidden' },
  
  undoBtn: { backgroundColor: '#f9945c' },
  deleteBtn: { backgroundColor: '#ff6b54' },
  activeDeleteBtn: { backgroundColor: '#c43d27' },
  homeBtn: { backgroundColor: '#8f7a66' }, 
  settingsBtn: { backgroundColor: '#bbada0' }, 
  
  disabledBtn: { backgroundColor: '#e4dbd2', opacity: 0.7 },
  disabledBtnText: { color: '#a69a8f' },

  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  settingsCard: { width: width * 0.8, backgroundColor: '#faf8ef', padding: 24, borderRadius: 10, alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
  settingsTitle: { fontSize: 26, fontWeight: 'bold', color: '#776e65', marginBottom: 20 },
  settingRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee4da' },
  settingLabel: { fontSize: 16, fontWeight: '600', color: '#776e65' },
  toggleActive: { backgroundColor: '#8f7a66', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 4 },
  toggleText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  menuItemBtn: { width: '100%', paddingVertical: 14, backgroundColor: '#bbada0', borderRadius: 6, alignItems: 'center', marginTop: 16 },
  menuItemText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  closeSettingsBtn: { marginTop: 24, paddingVertical: 10, width: '100%', alignItems: 'center' },
  closeSettingsText: { color: '#776e65', fontSize: 15, fontWeight: 'bold', opacity: 0.8 }
});