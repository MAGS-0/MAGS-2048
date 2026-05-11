import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  GRID: 'MAGS_2048_GRID',
  SCORE: 'MAGS_2048_SCORE',
  HIGH_SCORE: 'MAGS_2048_HIGH_SCORE',
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
      await AsyncStorage.setItem(STORAGE_KEYS.HIGH_SCORE, JSON.stringify(score));
    }
  } catch (e) {
    console.error('Error saving high score', e);
  }
};