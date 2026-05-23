// import AsyncStorage from '@react-native-async-storage/async-storage';

// const GAME_STATE_KEY = '@mags_2048_game_state';
// const HIGH_SCORE_KEY = '@mags_2048_high_score';
// const USERNAME_KEY = '@mags_2048_username';
// const USER_AVATAR_KEY = '@mags_2048_user_avatar'; // Dedicated slot for storing selected profile picture index

// export const saveGameState = async (grid, score) => {
//   try {
//     const jsonValue = JSON.stringify({ grid, score });
//     await AsyncStorage.setItem(GAME_STATE_KEY, jsonValue);
//   } catch (e) {
//     console.error("Error saving game state", e);
//   }
// };

// export const loadGameState = async () => {
//   try {
//     const jsonValue = await AsyncStorage.getItem(GAME_STATE_KEY);
//     return jsonValue != null ? JSON.parse(jsonValue) : null;
//   } catch (e) {
//     console.error("Error loading game state", e);
//     return null;
//   }
// };

// export const saveHighScore = async (score) => {
//   try {
//     await AsyncStorage.setItem(HIGH_SCORE_KEY, score.toString());
//   } catch (e) {
//     console.error("Error saving high score", e);
//   }
// };

// export const getHighScore = async () => {
//   try {
//     const value = await AsyncStorage.getItem(HIGH_SCORE_KEY);
//     return value != null ? parseInt(value, 10) : 0;
//   } catch (e) {
//     console.error("Error getting high score", e);
//     return 0;
//   }
// };

// // IMPROVED: Automatically trims the name before saving
// export const saveUsername = async (name) => {
//   try {
//     if (name) {
//       await AsyncStorage.setItem(USERNAME_KEY, name.trim());
//       console.log("Storage: Successfully saved username:", name.trim());
//     }
//   } catch (e) {
//     console.error("Error saving username", e);
//   }
// };

// export const getUsername = async () => {
//   try {
//     const name = await AsyncStorage.getItem(USERNAME_KEY);
//     return name;
//   } catch (e) {
//     console.error("Error getting username", e);
//     return null;
//   }
// };

// /**
//  * Saves the selected avatar asset identifier string to device storage
//  */
// export const saveUserAvatar = async (avatarId) => {
//   try {
//     if (avatarId) {
//       await AsyncStorage.setItem(USER_AVATAR_KEY, avatarId);
//       console.log("Storage: Successfully saved user avatar ID:", avatarId);
//     }
//   } catch (e) {
//     console.error("Error saving user avatar", e);
//   }
// };

// /**
//  * Retrieves the stored avatar asset identifier string.
//  * Defaults to 'avatar_1' to ensure a pre-selected image is always available.
//  */
// export const getUserAvatar = async () => {
//   try {
//     const avatarId = await AsyncStorage.getItem(USER_AVATAR_KEY);
//     return avatarId != null ? avatarId : 'avatar_1';
//   } catch (e) {
//     console.error("Error getting user avatar", e);
//     return 'avatar_1';
//   }
// };

// export const clearStorage = async () => {
//   try {
//     await AsyncStorage.clear();
//     console.log("Storage: Core profile and game registries thoroughly wiped.");
//   } catch (e) {
//     console.error("Error clearing storage", e);
//   }
// };

// //Saves the current coin balance to persistent device storage
// export const saveCoins = async (coins) => {
//   try {
//     await AsyncStorage.setItem('mags_2048_coins', coins.toString());
//   } catch (error) {
//     console.error('Error saving coins:', error);
//   }
// };

// /**
//  * Retrieves the stored coin balance, or returns null if it's a first-time player
//  */
// export const getCoins = async () => {
//   try {
//     const coins = await AsyncStorage.getItem('mags_2048_coins');
//     return coins !== null ? parseInt(coins, 10) : null;
//   } catch (error) {
//     console.error('Error reading coins:', error);
//     return null;
//   }
// };


import AsyncStorage from '@react-native-async-storage/async-storage';

const GAME_STATE_KEY = '@mags_2048_game_state';
const HIGH_SCORE_KEY = '@mags_2048_high_score';
const USERNAME_KEY = '@mags_2048_username';
const USER_AVATAR_KEY = '@mags_2048_user_avatar';

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

// --- NEW AVATAR STORAGE FUNCTIONS ---
export const saveUserAvatar = async (avatarId) => {
  try {
    if (avatarId) {
      await AsyncStorage.setItem(USER_AVATAR_KEY, avatarId);
    }
  } catch (e) {
    console.error("Error saving user avatar", e);
  }
};

const AVATAR_IDS = Array.from({ length: 15 }, (_, i) => `avatar_${i + 1}`);

export const getUserAvatar = async () => {
  try {
    const avatarId = await AsyncStorage.getItem(USER_AVATAR_KEY);
    if (avatarId != null) return avatarId;

    const randomAvatar = AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)];
    await AsyncStorage.setItem(USER_AVATAR_KEY, randomAvatar);
    return randomAvatar;
  } catch (e) {
    console.error("Error getting user avatar", e);
    return 'avatar_1';
  }
};

export const clearStorage = async () => {
  try {
    await AsyncStorage.clear();
  } catch (e) {
    console.error("Error clearing storage", e);
  }
};

export const saveCoins = async (coins) => {
  try {
    await AsyncStorage.setItem('mags_2048_coins', coins.toString());
  } catch (error) {
    console.error('Error saving coins:', error);
  }
};

export const getCoins = async () => {
  try {
    const coins = await AsyncStorage.getItem('mags_2048_coins');
    return coins !== null ? parseInt(coins, 10) : null;
  } catch (error) {
    console.error('Error reading coins:', error);
    return null;
  }
};