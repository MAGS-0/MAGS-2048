import AsyncStorage from '@react-native-async-storage/async-storage';

const GAME_STATE_KEY = '@mags_2048_game_state';
const HIGH_SCORE_KEY = '@mags_2048_high_score';
const USERNAME_KEY = '@mags_2048_username';

export const saveGameState = async (grid, score) => {
  try {
    const jsonValue = JSON.stringify({ grid, score });
    await AsyncStorage.setItem(GAME_STATE_KEY, jsonValue);
  } catch (e) {
    console.error("Error saving game state", e);
  }
};

export const loadGameState = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(GAME_STATE_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (e) {
    console.error("Error loading game state", e);
    return null;
  }
};

export const saveHighScore = async (score) => {
  try {
    await AsyncStorage.setItem(HIGH_SCORE_KEY, score.toString());
  } catch (e) {
    console.error("Error saving high score", e);
  }
};

export const getHighScore = async () => {
  try {
    const value = await AsyncStorage.getItem(HIGH_SCORE_KEY);
    return value != null ? parseInt(value, 10) : 0;
  } catch (e) {
    console.error("Error getting high score", e);
    return 0;
  }
};

// IMPROVED: Automatically trims the name before saving
export const saveUsername = async (name) => {
  try {
    if (name) {
      await AsyncStorage.setItem(USERNAME_KEY, name.trim());
      console.log("Storage: Successfully saved username:", name.trim());
    }
  } catch (e) {
    console.error("Error saving username", e);
  }
};

export const getUsername = async () => {
  try {
    const name = await AsyncStorage.getItem(USERNAME_KEY);
    return name;
  } catch (e) {
    console.error("Error getting username", e);
    return null;
  }
};

export const clearStorage = async () => {
  try {
    await AsyncStorage.clear();
  } catch (e) {
    console.error("Error clearing storage", e);
  }
};