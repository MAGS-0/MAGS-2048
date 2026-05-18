import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

// Cache container to hold preloaded Sound objects in memory
const soundObjects = {};
// State flags to prevent rapid-fire hardware channel overlapping thread locks
const activeStatus = {};

// 1. Premium milestone achievements (512+)
const TILE_SOUNDS = {
  512: require('../../assets/sounds/Tile 512.mp3'),
  1024: require('../../assets/sounds/Tile 1024.mp3'),
  2048: require('../../assets/sounds/Tile 2048.mp3'),
};

// 2. Structural UI and movement controls matching your renamed files perfectly
const UI_SOUNDS = {
  swipe_v: require('../../assets/sounds/swipe_vertical.mp3'),
  swipe_h: require('../../assets/sounds/swipe_horizontal.mp3'),
  undo: require('../../assets/sounds/undo.mp3'),
  delete: require('../../assets/sounds/delete.mp3'),
  start: require('../../assets/sounds/game_start.mp3'),
  gameover: require('../../assets/sounds/game_over.mp3'),
};

/**
 * Preloads all active audio clips into device sound cache memory immediately on app loading
 */
export const preloadGameAudio = async () => {
  try {
    // Configure hardware behavior for responsive gameplay mixing
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });

    // Unload existing instances if re-running code during hot-reloads
    for (const key in soundObjects) {
      if (soundObjects[key]) {
        await soundObjects[key].unloadAsync();
      }
    }

    // Load transactional interface sounds
    for (const [key, asset] of Object.entries(UI_SOUNDS)) {
      const { sound } = await Audio.Sound.createAsync(asset, { shouldCorrectPitch: false });
      soundObjects[key] = sound;
      activeStatus[key] = false;
    }

    // Load selective elite milestone sounds
    for (const [tileValue, asset] of Object.entries(TILE_SOUNDS)) {
      const { sound } = await Audio.Sound.createAsync(asset, { shouldCorrectPitch: false });
      soundObjects[`tile_${tileValue}`] = sound;
      activeStatus[`tile_${tileValue}`] = false;
    }

    console.log('[🔊 AUDIO] Premium responsive audio controller initialized.');
  } catch (error) {
    console.warn('[🔊 AUDIO ERROR] Preload routine bypassed safely:', error);
  }
};

/**
 * Central router to combine ultra-low latency audio with tactile feedback
 */
const executeFeedback = async (soundKey, hapticStyle, soundOn = true, hapticOn = true) => {
  try {
    // 1. Tactile Haptic Triggers
    if (hapticOn && hapticStyle) {
      switch (hapticStyle) {
        case 'light':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'success':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'error':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
      }
    }

    // 2. Play Audio Engine Track (With rapid-fire overlap cut-off logic)
    if (soundOn && soundObjects[soundKey]) {
      const soundInstance = soundObjects[soundKey];

      // If this specific sound channel is already running, intercept and force stop it immediately
      if (activeStatus[soundKey]) {
        await soundInstance.stopAsync();
      }

      activeStatus[soundKey] = true;

      // Set hardware parameters sequentially to guarantee execution delivery
      await soundInstance.setStatusAsync({
        positionMillis: 0,
        shouldPlay: true,
        volume: 1.0
      });

      activeStatus[soundKey] = false;
    }
  } catch (err) {
    console.log('[🔊 FEEDBACK EXCEPTION]', err);
    if (soundKey) activeStatus[soundKey] = false;
  }
};

// --- EXPORTED SYSTEM INTEGRATIONS FOR ACTIVE GAMEPLAY SCREEN ---

export const playSwipeSound = (direction, soundOn, hapticOn) => {
  const isVertical = direction === 'up' || direction === 'down';
  executeFeedback(
    isVertical ? 'swipe_v' : 'swipe_h',
    'light', 
    soundOn,
    hapticOn
  );
};

export const playMergeSound = (highestTileValue, soundOn, hapticOn) => {
  // If the tile is less than 512, safely fall back to a generic swipe sound to stay quiet
  if (highestTileValue < 512) {
    executeFeedback(null, 'light', soundOn, hapticOn);
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
  executeFeedback(
    type === 'undo' ? 'undo' : 'delete',
    'success', 
    soundOn,
    hapticOn
  );
};

export const playGameStateSound = (state, soundOn, hapticOn) => {
  executeFeedback(
    state === 'start' ? 'start' : 'gameover',
    state === 'start' ? 'medium' : 'error', 
    soundOn,
    hapticOn
  );
};