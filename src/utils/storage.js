import AsyncStorage from '@react-native-async-storage/async-storage';

const GAME_STATE_KEY = '@mags_2048_game_state';
const HIGH_SCORE_KEY = '@mags_2048_high_score';
const USERNAME_KEY = '@mags_2048_username';

// Save the current grid and score
export const saveGameState = async (grid, score) => {
  try {
    const jsonValue = JSON.stringify({ grid, score });
    await AsyncStorage.setItem(GAME_STATE_KEY, jsonValue);
  } catch (e) {
    console.error("Error saving game state", e);
  }
};

// Load the saved grid and score
export const loadGameState = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(GAME_STATE_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (e) {
    console.error("Error loading game state", e);
    return null;
  }
};

// Save the personal high score
export const saveHighScore = async (score) => {
  try {
    await AsyncStorage.setItem(HIGH_SCORE_KEY, score.toString());
  } catch (e) {
    console.error("Error saving high score", e);
  }
};

// Get the personal high score
export const getHighScore = async () => {
  try {
    const value = await AsyncStorage.getItem(HIGH_SCORE_KEY);
    return value != null ? parseInt(value, 10) : 0;
  } catch (e) {
    console.error("Error getting high score", e);
    return 0;
  }
};

// Save the player's name
export const saveUsername = async (name) => {
  try {
    await AsyncStorage.setItem(USERNAME_KEY, name);
  } catch (e) {
    console.error("Error saving username", e);
  }
};

// Retrieve the player's name
export const getUsername = async () => {
  try {
    const name = await AsyncStorage.getItem(USERNAME_KEY);
    return name;
  } catch (e) {
    console.error("Error getting username", e);
    return null;
  }
};

// Clear all data (optional, for debugging)
export const clearStorage = async () => {
  try {
    await AsyncStorage.clear();
  } catch (e) {
    console.error("Error clearing storage", e);
  }
};