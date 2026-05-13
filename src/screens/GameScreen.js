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
    // After saving name, submit the score that triggered the modal
    await submitGlobalScore(name, score, '4x4');
  };

  const resetGame = () => {
    Alert.alert("New Game", "Are you sure you want to start a new game?", [
      { text: "Cancel", style: "cancel" },
      { text: "Yes", onPress: () => {
          setNewTileCoord(null);
          setMergedCoords([]);
          setShowConfetti(false);
          const newGrid = initializeGrid();
          setGrid(newGrid);
          setScore(0);
          setHistory([]);
          saveGameState(newGrid, 0);
      }}
    ]);
  };

  const handleMove = async (direction) => {
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
        // Handle global submission logic
        if (username) {
          await submitGlobalScore(username, nextScore, '4x4');
        } else {
          setShowNameModal(true);
        }

        Alert.alert("Game Over", `Your final score is ${nextScore}`, [
          { text: "Return Home", onPress: () => navigation.navigate('Home') },
          { text: "Try Again", onPress: () => {
              const newGrid = initializeGrid();
              setGrid(newGrid);
              setScore(0);
              setHistory([]);
              saveGameState(newGrid, 0);
          }} 
        ]);
      }
    }
  };

  const handleUndo = () => {
    if (history.length > 0) {
      const previousState = history[history.length - 1];
      setNewTileCoord(null);
      setMergedCoords([]);
      setGrid(previousState.grid);
      setScore(previousState.score);
      setHistory(prev => prev.slice(0, -1));
      saveGameState(previousState.grid, previousState.score);
    }
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
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>2048</Text>
          <TouchableOpacity style={styles.resetButton} onPress={resetGame}>
            <Text style={styles.resetButtonText}>NEW GAME</Text>
          </TouchableOpacity>
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

      <View style={styles.controls}>
        <TouchableOpacity style={styles.undoButton} onPress={handleUndo}>
          <Text style={styles.undoButtonText}>UNDO</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.homeButton} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.undoButtonText}>HOME</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.grid}>
        <View style={styles.backgroundGrid}>
          {Array(16).fill(null).map((_, i) => (
            <View key={`bg-${i}`} style={styles.cellPlaceholder} />
          ))}
        </View>
        <View style={styles.tileContainer}>
          {grid.map((row, r) => row.map((cell, c) => (
            cell !== 0 && (
              <View key={`tile-${r}-${c}`} style={{ 
                position: 'absolute', 
                left: c * CELL_SIZE, 
                top: r * CELL_SIZE,
                width: CELL_SIZE,
                height: CELL_SIZE,
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <Tile 
                  value={cell} 
                  cellSize={CELL_SIZE} 
                  isNew={newTileCoord === `${r}-${c}`} 
                  isMerged={mergedCoords.includes(`${r}-${c}`)}
                />
              </View>
            )
          )))}
        </View>
      </View>
      <Confetti active={showConfetti} />
      <UsernameModal visible={showNameModal} onSave={handleNameSave} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf8ef', alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', marginBottom: 10, width: width - 40, justifyContent: 'space-between', alignItems: 'center' },
  titleContainer: { alignItems: 'flex-start' },
  title: { fontSize: 36, fontWeight: 'bold', color: '#776e65' },
  resetButton: { backgroundColor: '#8f7a66', padding: 8, borderRadius: 5, marginTop: 5 },
  resetButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 12 },
  scoreBoard: { flexDirection: 'row' },
  scoreContainer: { backgroundColor: '#bbada0', padding: 10, borderRadius: 5, alignItems: 'center', minWidth: 70, marginLeft: 5 },
  scoreLabel: { color: '#eee4da', fontSize: 10, fontWeight: 'bold' },
  scoreValue: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  controls: { flexDirection: 'row', marginBottom: 20, width: width - 40, justifyContent: 'space-between' },
  undoButton: { backgroundColor: '#8f7a66', padding: 10, borderRadius: 5, width: '45%', alignItems: 'center' },
  homeButton: { backgroundColor: '#bbada0', padding: 10, borderRadius: 5, width: '45%', alignItems: 'center' },
  undoButtonText: { color: '#ffffff', fontWeight: 'bold' },
  grid: { width: width - 20, height: width - 20, backgroundColor: '#bbada0', borderRadius: 6, position: 'relative', overflow: 'hidden' },
  backgroundGrid: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', flexWrap: 'wrap', padding: 5 },
  tileContainer: { ...StyleSheet.absoluteFillObject, padding: 5 },
  cellPlaceholder: { width: CELL_SIZE - 10, height: CELL_SIZE - 10, margin: 5, borderRadius: 5, backgroundColor: 'rgba(238, 228, 218, 0.35)' },
});