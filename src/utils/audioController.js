import { Audio } from 'expo-av';
import { Asset } from 'expo-asset';
import * as Haptics from 'expo-haptics';

// Cache container to hold preloaded Sound objects in memory
const soundObjects = {};
// State flags to prevent rapid-fire hardware channel overlapping thread locks
const activeStatus = {};

// 1. Premium milestone achievements (512+)
const TILE_SOUNDS = {
  512: require('../../assets/sounds/Tile 512.mp3'), // Note: Spaces in filenames can cause issues on Android. Consider renaming to Tile_512.mp3
  1024: require('../../assets/sounds/Tile 1024.mp3'), // Note: Spaces in filenames can cause issues on Android. Consider renaming to Tile_1024.mp3
  2048: require('../../assets/sounds/Tile 2048.mp3'), // Note: Spaces in filenames can cause issues on Android. Consider renaming to Tile_2048.mp3
};

// 2. Structural UI and movement controls matching your renamed files perfectly
const UI_SOUNDS = {
  swipe_v: require('../../assets/sounds/swipe_vertical.mp3'),
  swipe_h: require('../../assets/sounds/swipe_horizontal.mp3'),
  undo: require('../../assets/sounds/undo.mp3'),
  delete: require('../../assets/sounds/delete.mp3'),
  // Add new sounds for game state and rewards
  highScore: require('../../assets/sounds/high_score.mp3'),
  coinReward: require('../../assets/sounds/coin_reward.mp3'),
  start: require('../../assets/sounds/game_start.mp3'),
  gameover: require('../../assets/sounds/game_over.mp3'),
};

/**
 * Preloads all active audio clips into device sound cache memory immediately on app loading
 */
export const preloadGameAudio = async () => {
  try {
    // Configure hardware behavior for non-blocking, ambient gameplay audio mixing
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    // Load Tile sounds safely by ensuring they are downloaded before being passed to Audio
    for (const [key, source] of Object.entries(TILE_SOUNDS)) {
      if (!soundObjects[`tile_${key}`]) {
        const asset = Asset.fromModule(source);
        await asset.downloadAsync(); // Ensure file is locally available
        
        console.log(`[🔊 AUDIO] Preloading tile sound: tile_${key}`); // Debug log
        const { sound } = await Audio.Sound.createAsync(asset, { shouldPlay: false });
        soundObjects[`tile_${key}`] = sound;
        activeStatus[`tile_${key}`] = false;
      }
    }

    // Load UI sounds safely by ensuring they are downloaded before being passed to Audio
    for (const [key, source] of Object.entries(UI_SOUNDS)) {
      if (!soundObjects[key]) {
        const asset = Asset.fromModule(source);
        await asset.downloadAsync(); // Ensure file is locally available
        
        console.log(`[🔊 AUDIO] Preloading UI sound: ${key}`); // Debug log
        const { sound } = await Audio.Sound.createAsync(asset, { shouldPlay: false });
        soundObjects[key] = sound;
        activeStatus[key] = false;
      }
    }
  } catch (err) {
    console.log('[🔊 AUDIO CONTROL PRELOAD EXCEPTION]', err);
  }
};

/**
 * Universal runner to execute short sound effects and haptic steps safely without blocking threads
 */
const executeFeedback = async (soundKey, hapticStyle, soundOn, hapticOn) => {
  // 1. Execute physical device vibration engine requests natively
  if (hapticOn) {
    try {
      if (hapticStyle === 'light') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      else if (hapticStyle === 'medium') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      else if (hapticStyle === 'heavy') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (e) {
      // Absorb silent haptic fallback cases on simulator/older targets safely
    }
  }

  // 2. Stream audio files out from loaded cache profiles
  if (!soundOn || !soundKey) return;

  const sound = soundObjects[soundKey];
  if (!sound) return;

  // Stop overlapping tracks if a player moves faster than a sample sound file playback duration
  if (activeStatus[soundKey]) return;

  try {
    activeStatus[soundKey] = true;

    const status = await sound.getStatusAsync();
    if (status.isLoaded) {
      // Re-rack the playhead to the beginning marker frame and trigger sound
      await sound.setPositionAsync(0);
      await sound.playAsync();
    }
    
    activeStatus[soundKey] = false;
  } catch (err) {
    // Check if the issue is just Android dropping focus temporarily due to speed
    const errorStr = String(err);
    if (errorStr.includes('AudioFocusNotAcquiredException')) {
      // Quietly absorb this system restriction warning without logging it to the screen console
    } else {
      console.log('[🔊 FEEDBACK EXCEPTION]', err);
    }
    if (soundKey) activeStatus[soundKey] = false;
  }
};

// --- EXPORTED SYSTEM INTEGRATIONS FOR ACTIVE GAMEPLAY SCREEN ---

export const playSwipeSound = (direction, soundOn, hapticOn) => {
  const isVertical = direction === 'up' || direction === 'down';
  executeFeedback(
    isVertical ? 'swipe_v' : 'swipe_h',
    'heavy', 
    soundOn,
    hapticOn
  );
};

export const playMergeSound = (highestTileValue, soundOn, hapticOn) => {
  // If the tile is less than 512, safely fall back to a generic swipe sound to stay quiet
  if (highestTileValue < 512) {
    // Use horizontal swipe as a default subtle feedback for early merges
    executeFeedback('swipe_h', 'medium', soundOn, hapticOn);
    return;
  }

  // Cap lookups gracefully if players build past the 2048 master file threshold
  let lookupKey = highestTileValue;
  if (highestTileValue > 2048) lookupKey = 2048;

  executeFeedback(
    `tile_${lookupKey}`,
    highestTileValue >= 1024 ? 'heavy' : 'medium', 
    soundOn,
    hapticOn
  );
};

export const playPowerUpSound = (type, soundOn, hapticOn) => {
  if (type === 'undo') {
    executeFeedback('undo', 'medium', soundOn, hapticOn);
  } else if (type === 'delete') {
    executeFeedback('delete', 'heavy', soundOn, hapticOn);
  }
};

export const playGameStateSound = (state, soundOn, hapticOn) => {
  if (state === 'start') {
    executeFeedback('start', 'medium', soundOn, hapticOn);
  } else if (state === 'gameover') {
    executeFeedback('gameover', 'heavy', soundOn, hapticOn);
  }
};

export const playHighScoreSound = (soundOn, hapticOn) => {
  executeFeedback('highScore', 'heavy', soundOn, hapticOn); // Use 'highScore' key
};

export const playCoinRewardSound = (soundOn, hapticOn) => {
  executeFeedback('coinReward', 'medium', soundOn, hapticOn); // Use 'coinReward' key
};

export const playPremiumUnlockedSound = (soundOn, hapticOn) => {
  executeFeedback('premiumUnlocked', 'heavy', soundOn, hapticOn); // Assuming you have this sound
};