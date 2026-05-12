import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Dimensions, PanResponder, Alert, TouchableOpacity } from 'react-native';
import { initializeGrid, moveGrid, isGameOver } from '../utils/gameLogic';
import { saveGameState, loadGameState, getHighScore, saveHighScore, saveToLeaderboard } from '../utils/storage';

const { width } = Dimensions.get('window');
const CELL_SIZE = (width - 40) / 4;

export default function GameScreen({ navigation }) {
  const [grid, setGrid] = useState(initializeGrid());
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const init = async () => {
      const saved = await loadGameState();
      if (saved && saved.grid) {
        setGrid(saved.grid);
        setScore(saved.score);
      }
      const high = await getHighScore();
      setHighScore(high);
    };
    init();
  }, []);

  const resetGame = () => {
    const newGrid = initializeGrid();
    setGrid(newGrid);
    setScore(0);
    setHistory([]);
    saveGameState(newGrid, 0);
  };

  const handleMove = async (direction) => {
    const result = moveGrid(grid, direction);
    
    if (result.changed) {
      // Save for Undo
      setHistory(prev => [...prev, { grid: JSON.parse(JSON.stringify(grid)), score }]);
      
      const nextScore = score + result.score;
      const nextGrid = result.grid;

      setGrid(nextGrid);
      setScore(nextScore);
      
      saveGameState(nextGrid, nextScore);

      if (nextScore > highScore) {
        setHighScore(nextScore);
        saveHighScore(nextScore);
      }

      // Check for Game Over
      if (isGameOver(nextGrid)) {
        await saveToLeaderboard(nextScore);
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
      setGrid(previousState.grid);
      setScore(previousState.score);
      setHistory(prev => prev.slice(0, -1));
      saveGameState(previousState.grid, previousState.score);
    } else {
      Alert.alert("No moves to undo!");
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

  const getTileStyle = (value) => {
    const colors = {
      2: '#eee4da', 4: '#ede0c8', 8: '#f2b179', 16: '#f59563',
      32: '#f67c5f', 64: '#f65e3b', 128: '#edcf72', 256: '#edcc61',
      512: '#edc850', 1024: '#edc53f', 2048: '#edc22e'
    };
    return { backgroundColor: colors[value] || '#3c3a32' };
  };

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <View style={styles.header}>
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreLabel}>SCORE</Text>
          <Text style={styles.scoreValue}>{score}</Text>
        </View>
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreLabel}>BEST</Text>
          <Text style={styles.scoreValue}>{highScore}</Text>
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
        {grid.map((row, r) => row.map((cell, c) => (
          <View key={`${r}-${c}`} style={[styles.cell, getTileStyle(cell)]}>
            <Text style={[styles.cellText, { color: cell <= 4 ? '#776e65' : '#f9f6f2' }]}>
              {cell !== 0 ? cell : ''}
            </Text>
          </View>
        )))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf8ef', alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', marginBottom: 10, width: width - 40, justifyContent: 'space-between' },
  scoreContainer: { backgroundColor: '#bbada0', padding: 10, borderRadius: 5, alignItems: 'center', minWidth: 80 },
  scoreLabel: { color: '#eee4da', fontSize: 12, fontWeight: 'bold' },
  scoreValue: { color: '#ffffff', fontSize: 20, fontWeight: 'bold' },
  controls: { flexDirection: 'row', marginBottom: 20, width: width - 40, justifyContent: 'space-between' },
  undoButton: { backgroundColor: '#8f7a66', padding: 10, borderRadius: 5, width: '45%', alignItems: 'center' },
  homeButton: { backgroundColor: '#bbada0', padding: 10, borderRadius: 5, width: '45%', alignItems: 'center' },
  undoButtonText: { color: '#ffffff', fontWeight: 'bold' },
  grid: { width: width - 20, height: width - 20, backgroundColor: '#bbada0', padding: 5, borderRadius: 5, flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: CELL_SIZE - 10, height: CELL_SIZE - 10, margin: 5, borderRadius: 5, justifyContent: 'center', alignItems: 'center' },
  cellText: { fontSize: 24, fontWeight: 'bold' }
});