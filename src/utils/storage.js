import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';

const STORAGE_KEYS = {
  GRID: 'MAGS_2048_GRID',
  SCORE: 'MAGS_2048_SCORE',
  HIGH_SCORE: 'MAGS_2048_HIGH_SCORE',
  LEADERBOARD: 'MAGS_2048_LEADERBOARD',
};

export const saveGameState = async (grid, score) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.GRID, JSON.stringify(grid));
    await AsyncStorage.setItem(STORAGE_KEYS.SCORE, JSON.stringify(score));
  } catch (e) {
    console.error('Error saving game state', e);
  }
};

export const loadGameState = async () => {
  try {
    const grid = await AsyncStorage.getItem(STORAGE_KEYS.GRID);
    const score = await AsyncStorage.getItem(STORAGE_KEYS.SCORE);
    return {
      grid: grid ? JSON.parse(grid) : null,
      score: score ? JSON.parse(score) : 0,
    };
  } catch (e) {
    console.error('Error loading game state', e);
    return null;
  }
};

export const getHighScore = async () => {
  try {
    const highScore = await AsyncStorage.getItem(STORAGE_KEYS.HIGH_SCORE);
    return highScore ? JSON.parse(highScore) : 0;
  } catch (e) {
    return 0;
  }
};

export const saveHighScore = async (score) => {
  try {
    const currentHigh = await getHighScore();
    if (score > currentHigh) {
      // 1. Save Locally
      await AsyncStorage.setItem(STORAGE_KEYS.HIGH_SCORE, JSON.stringify(score));
      
      // 2. Save to Cloud (Firestore)
      await setDoc(doc(db, "leaderboard", "Anonymous_User"), {
        highScore: score,
        lastUpdated: new Date()
      }, { merge: true });
    }
  } catch (e) {
    console.error('Error syncing score to cloud', e);
  }
};

export const saveToLeaderboard = async (newScore) => {
  try {
    const existingLeaderboard = await AsyncStorage.getItem(STORAGE_KEYS.LEADERBOARD);
    let scores = existingLeaderboard ? JSON.parse(existingLeaderboard) : [];
    
    scores.push({ score: newScore, date: new Date().toLocaleDateString() });
    scores.sort((a, b) => b.score - a.score);
    scores = scores.slice(0, 5);

    await AsyncStorage.setItem(STORAGE_KEYS.LEADERBOARD, JSON.stringify(scores));
  } catch (e) {
    console.error("Error saving to leaderboard", e);
  }
};

export const getLeaderboard = async () => {
  try {
    const scores = await AsyncStorage.getItem(STORAGE_KEYS.LEADERBOARD);
    return scores ? JSON.parse(scores) : [];
  } catch (e) {
    return [];
  }
};