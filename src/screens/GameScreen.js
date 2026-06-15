import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StyleSheet, View, Text, Dimensions, PanResponder, Alert, TouchableOpacity, Animated, Easing, Image, NativeModules, TextInput, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { initializeGrid, moveGrid, isGameOver, spawnTile } from '../utils/gameLogic';
import { saveGameState, loadGameState, getHighScore, saveHighScore, saveUsername, getUsername, saveCoins, getCoins, getUserAvatar, saveUserAvatar, getUserId } from '../utils/storage';
import { submitGlobalScore, updateLeaderboardAvatar } from '../utils/firebase';
import Tile from '../components/Tile';
import Confetti from '../components/Confetti';
import UsernameModal from '../components/UsernameModal';
import Button3D from '../components/Button3D';
import { useAds } from '../context/AdContext';

import { logGameEvent } from '../utils/analytics';
import { 
  preloadGameAudio, 
  playSwipeSound, 
  playMergeSound, 
  playPowerUpSound, 
  playGameStateSound,
  playHighScoreSound
} from '../utils/audioController';

// Handle Native BannerAd for Expo Go compatibility
let BannerAd, BannerAdSize, TestIds;
try {
  // Check if the native module exists in the current binary
  if (!NativeModules.RNGoogleMobileAdsModule && !NativeModules.RNGoogleMobileAdsBannerViewModule) {
    throw new Error('AdMob Native Module not found');
  }
  const AdMob = require('react-native-google-mobile-ads');
  BannerAd = AdMob.BannerAd;
  BannerAdSize = AdMob.BannerAdSize;
  TestIds = AdMob.TestIds;
} catch (e) {
  const Mock = require('../utils/admobMock');
  BannerAd = Mock.BannerAdMock;
  BannerAdSize = Mock.BannerAdSize;
  TestIds = Mock.TestIds;
}

const { width, height } = Dimensions.get('window');
const CELL_SIZE = (width - 40) / 4;
const TILE_SLIDE_DURATION = 150; // Optimized for snappy gameplay feel

// --- LAYOUT SPACING CONTROLS ---
// Adjust these variables to find the perfect empty space for your layout.
const GLOBAL_TOP_PADDING = 60;    // Space from the very top of the screen/notch
const BOARD_MARGIN_TOP = 70;      // Space between the Header and the Game Board
const BOARD_MARGIN_BOTTOM = 80;   // Space between the Game Board and the Power-ups
const YOUR_ANDROID_PACKAGE_NAME = 'com.mags2048.android'; // Replace with your actual Android package name from app.json
const SUPPORT_EMAIL = 'hello.gogames@gmail.com'; // Replace with your actual support email

const convertNumericGridToObjects = (numericGrid) => {
  if (!Array.isArray(numericGrid)) return numericGrid;
  return numericGrid.map((row) =>
    row.map((cell) => (cell === 0 || cell === '0' ? null : (cell === null ? null : { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`, value: cell })))
  );
};

// --- HELPER COMPONENT FOR SMOOTH SLIDING WRAPPERS ---
function AnimatedTileWrapper({ r, c, fromR, fromC, isDeleteMode, onTileSelect, children }) {
  const startX = (fromC !== undefined ? fromC : c) * CELL_SIZE;
  const startY = (fromR !== undefined ? fromR : r) * CELL_SIZE;
  const animatedPos = useRef(new Animated.ValueXY({ x: startX, y: startY })).current;

  useEffect(() => {
    Animated.timing(animatedPos, {
      toValue: { x: c * CELL_SIZE, y: r * CELL_SIZE },
      duration: TILE_SLIDE_DURATION,
      easing: Easing.out(Easing.quad), // Starts fast, slows down at the end
      useNativeDriver: true,
    }).start();
  }, [r, c]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: CELL_SIZE,
        height: CELL_SIZE,
        justifyContent: 'center',
        alignItems: 'center',
        transform: [
          { translateX: animatedPos.x },
          { translateY: animatedPos.y }
        ]
      }}
    >
      <TouchableOpacity
        activeOpacity={isDeleteMode ? 0.5 : 1}
        onPress={onTileSelect}
        disabled={!isDeleteMode}
        style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function GameScreen({ navigation }) {
  const adContext = useAds();
  const isAdsRemoved = adContext?.adsRemoved;
  const hideInterstitialAction = adContext?.hideInterstitialAction;

  const [grid, setGrid] = useState(initializeGrid());
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [history, setHistory] = useState([]);
  const [username, setUsername] = useState(null);
  const [userId, setUserId] = useState(null);
  const [avatarId, setAvatarId] = useState('avatar_1');
  const [showNameModal, setShowNameModal] = useState(false);
  
  const [newTileCoord, setNewTileCoord] = useState(null);
  const [mergedCoords, setMergedCoords] = useState([]);
  // State to control whether the confetti celebration overlay is currently active
  const [showConfetti, setShowConfetti] = useState(false);

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticEnabled, setHapticEnabled] = useState(true);

  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [coins, setCoins] = useState(0);

  const [showAd, setShowAd] = useState(true);
  const [showInterstitialMock, setShowInterstitialMock] = useState(false);
  const [isNewUserTutorial, setIsNewUserTutorial] = useState(false);
  const [powerUpMoveCount, setPowerUpMoveCount] = useState(0);
  const [achievedMilestones, setAchievedMilestones] = useState({});
  const [undoTutorialShown, setUndoTutorialShown] = useState(false);
  const [deleteTutorialShown, setDeleteTutorialShown] = useState(false);

  const [showGameOverScreen, setShowGameOverScreen] = useState(false);
  const [mergingGhosts, setMergingGhosts] = useState([]);

  const scoreBounce = useRef(new Animated.Value(1)).current;
  const isAnimating = useRef(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // --- FEEDBACK LOOP STATES ---
  const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);
  const [showDislikeFeedbackModal, setShowDislikeFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [lastFeedbackPromptDate, setLastFeedbackPromptDate] = useState(null); // Date string (YYYY-MM-DD)
  const feedbackPromptSkippedSession = useRef(false); // For "Later" in current session
  // --- TUTORIAL NUDGE STATES & ANIMATIONS ---
  const [activeTutorialStep, setActiveTutorialStep] = useState(null); // 'undo' or 'delete'
  const tutorialPulseAnim = useRef(new Animated.Value(1)).current;
  const handAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let pulseLoop;
    let handLoop;

    if (activeTutorialStep) {
      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(tutorialPulseAnim, { toValue: 1.1, duration: 500, useNativeDriver: true }),
          Animated.timing(tutorialPulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      handLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(handAnim, { toValue: 15, duration: 600, useNativeDriver: true }),
          Animated.timing(handAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ])
      );
      pulseLoop.start();
      handLoop.start();
    } else {
      tutorialPulseAnim.setValue(1);
      handAnim.setValue(0);
    }

    return () => {
      if (pulseLoop) pulseLoop.stop();
      if (handLoop) handLoop.stop();
    };
  }, [activeTutorialStep]);

  useEffect(() => {
    let animation;
    if (showGameOverScreen) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 800,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ])
      );
      animation.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => animation && animation.stop();
  }, [showGameOverScreen]);

  // Manual trigger via navigation params (for Dev Tools in HomeScreen)
  useEffect(() => {
    if (adContext?.route?.params?.triggerReview) {
      setShowFeedbackPrompt(true);
      navigation.setParams({ triggerReview: undefined });
    }
  }, [adContext?.route?.params]);

  // Load last feedback prompt date from AsyncStorage
  useEffect(() => {
    const loadFeedbackState = async () => {
      const storedDate = await AsyncStorage.getItem('mags_2048_last_feedback_prompt_date');
      setLastFeedbackPromptDate(storedDate);
    };
    loadFeedbackState();
  }, []);

  const wasFeedbackPromptShownToday = useMemo(() => {
    if (!lastFeedbackPromptDate) return false;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return lastFeedbackPromptDate === today;
  }, [lastFeedbackPromptDate]);

  useEffect(() => {
    const init = async () => {
      await preloadGameAudio();

      const storedCoins = await getCoins();
      if (storedCoins === null) {
        setCoins(5);
        setIsNewUserTutorial(true);
        await saveCoins(5);
        Alert.alert(
          "🎁 Welcome Bonus!",
          "You have been awarded a complimentary Welcome Bonus of 5 Coins! Use them to activate Undo and Delete power-ups during your matches.",
          [{ text: "Awesome!", style: "default" }]
        );
      } else {
        setCoins(storedCoins);
      }

      const saved = await loadGameState();
      if (saved && saved.grid) {
        let loadedGrid;
        const sampleCell = saved.grid && saved.grid[0] && saved.grid[0][0];
        if (typeof sampleCell === 'number') {
          loadedGrid = convertNumericGridToObjects(saved.grid);
        } else {
          loadedGrid = saved.grid;
        }
        setGrid(loadedGrid);
        setScore(saved.score);

        // Check if the restored game state is already in a Game Over condition
        if (isGameOver(loadedGrid)) {
          setShowGameOverScreen(true);
        }
      } else {
        playGameStateSound('start', soundEnabled, hapticEnabled);
      }
      const high = await getHighScore();
      setHighScore(high);
      
      const storedName = await getUsername();
      setUsername(storedName);

      const uid = await getUserId();
      setUserId(uid);

      const storedAvatar = await getUserAvatar();
      setAvatarId(storedAvatar);

      // Load achieved milestones to prevent repeating animations
      const milestones = await AsyncStorage.getItem('mags_achieved_milestones');
      if (milestones) setAchievedMilestones(JSON.parse(milestones));

      logGameEvent('screen_view', {
        screen_name: 'GameScreen',
        purpose: 'active_gameplay'
      });
    };
    init();

  }, []);

  useEffect(() => {
    const syncCoins = navigation.addListener('focus', async () => {
      const storedCoins = await getCoins();
      if (storedCoins !== null) {
        setCoins(storedCoins);
      }
    });
    return syncCoins;
  }, [navigation]);

  const triggerScoreAnimation = () => {
    Animated.sequence([
      Animated.timing(scoreBounce, { toValue: 1.2, duration: 100, useNativeDriver: true }),
      Animated.timing(scoreBounce, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const handleNameSave = async (name, selectedAvatar) => {
    await saveUsername(name);
    if (selectedAvatar) await saveUserAvatar(selectedAvatar);
    setUsername(name);
    if (selectedAvatar) setAvatarId(selectedAvatar);
    if (selectedAvatar) await updateLeaderboardAvatar(userId, selectedAvatar);
    setShowNameModal(false);
    await submitGlobalScore(userId, name, score, selectedAvatar || avatarId, '4x4');
  };

  const updateWalletCoins = async (newBalance) => {
    setCoins(newBalance);
    await saveCoins(newBalance);
  };

  const triggerFeedbackLoop = (delay = 3500, ignoreLockout = false) => {
    if (ignoreLockout || (!wasFeedbackPromptShownToday && !feedbackPromptSkippedSession.current)) {
      // Use a timeout to allow other animations (confetti, score bounce) to settle
      setTimeout(() => {
        setShowFeedbackPrompt(true);
      }, delay);
      return true;
    }
    return false;
  };

  const handleFeedbackPromptResponse = async (response) => {
    setShowFeedbackPrompt(false);
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    if (response === 'yes') {
      if (Platform.OS === 'android') {
        Linking.openURL(`market://details?id=${YOUR_ANDROID_PACKAGE_NAME}`).catch(err => {
          console.error("Couldn't open Play Store:", err);
          Alert.alert("Error", "Could not open the Play Store. Please try again later.");
        });
      } else if (Platform.OS === 'ios') {
        // Placeholder for iOS app store link
        Alert.alert("Thank You!", "Please rate us on the App Store!");
      }
      await AsyncStorage.setItem('mags_2048_last_feedback_prompt_date', today);
      setLastFeedbackPromptDate(today);
    } else if (response === 'no') {
      setShowDislikeFeedbackModal(true);
    } else if (response === 'later') {
      feedbackPromptSkippedSession.current = true; // Skip for this session
      await AsyncStorage.setItem('mags_2048_last_feedback_prompt_date', today);
      setLastFeedbackPromptDate(today);
    }
  };

  const handleSendDislikeFeedback = async () => {
    if (feedbackText.trim().length === 0) {
      Alert.alert("Feedback Empty", "Please enter your feedback before sending.");
      return;
    }

    // Capture device and app info
    const deviceName = Device.deviceName || Device.modelName || 'Unknown Device';
    const osVersion = Device.osVersion || 'Unknown OS';
    const buildVersion = Constants.expoConfig?.version || Constants.nativeAppVersion || '1.0.0';

    let city = 'Unknown', state = 'Unknown', country = 'Unknown';

    // try {
    //   // Attempt to get location metadata (requires user permission)
    //   const { status } = await Location.requestForegroundPermissionsAsync();
    //   if (status === 'granted') {
    //     const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    //     const geocode = await Location.reverseGeocodeAsync({
    //       latitude: location.coords.latitude,
    //       longitude: location.coords.longitude,
    //     });

    //     if (geocode && geocode.length > 0) {
    //       const geo = geocode[0];
    //       city = geo.city || 'Unknown';
    //       state = geo.region || 'Unknown';
    //       country = geo.country || 'Unknown';
    //     }
    //   }
    // } catch (error) {
    //   console.warn("Metadata capture failed:", error);
    // }

    const metadata = `\n\n----------\nDevice name: ${deviceName}\nOS version: ${osVersion}\nBuild version: ${buildVersion}\nCity: ${city}\nState: ${state}\nCountry: ${country}`;

    const subject = "Go! 2048 | Feedback";
    const fullBody = `${feedbackText}${metadata}`;
    
    const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullBody)}`;

    try {
      await Linking.openURL(mailtoUrl);
      Alert.alert("Thank You!", "Your feedback has been sent. We appreciate your input!");
      setShowDislikeFeedbackModal(false);
      setFeedbackText('');
      const today = new Date().toISOString().slice(0, 10);
      await AsyncStorage.setItem('mags_2048_last_feedback_prompt_date', today);
      setLastFeedbackPromptDate(today);
    } catch (error) {
      console.error("Failed to open email client:", error);
      Alert.alert("Error", "Could not open email client. Please ensure you have one configured.");
    }
  };

  const handleCancelDislikeFeedback = async () => {
    setShowDislikeFeedbackModal(false);
    setFeedbackText('');
    const today = new Date().toISOString().slice(0, 10);
    await AsyncStorage.setItem('mags_2048_last_feedback_prompt_date', today);
    setLastFeedbackPromptDate(today);
  };

  const launchRewardedAdVideo = () => {
    const success = adContext.showRewardedAd(async () => {
      const updatedCoins = coins + 1;
      await updateWalletCoins(updatedCoins);

      logGameEvent('ad_reward_claimed', { resulting_wallet_total: updatedCoins });

      Alert.alert(
        "🪙 Reward Claimed!",
        "Thank you for watching! +1 Coin has been securely added to your layout balance.",
        [{ text: "Continue playing", style: "default" }]
      );
    });

    if (!success) {
      Alert.alert("Ad not ready", "The reward video is still loading. Please try again in a moment.");
    }
  };

  const resetGame = () => {
    logGameEvent('game_restart', {
      current_score_at_reset: score,
      moves_made_before_reset: history.length
    });

    playGameStateSound('start', soundEnabled, hapticEnabled);

    setNewTileCoord(null);
    setMergedCoords([]);
    // setShowConfetti(false);
    setIsDeleteMode(false);
    setShowGameOverScreen(false);

    const newGrid = initializeGrid();
    setGrid(newGrid);
    setScore(0);
    setHistory([]);
    saveGameState(newGrid, 0);
  };

  const handleMove = async (direction) => {
    // Block moves if a tutorial nudge is active to force interaction with the power-up
    if (isDeleteMode || showGameOverScreen || isAnimating.current === true || activeTutorialStep) return;

    const result = moveGrid(grid, direction);

    if (result.changed) {
      isAnimating.current = true;

      const oldGrid = JSON.parse(JSON.stringify(grid));
      
      setNewTileCoord(null);
      setMergedCoords([]);
      setMergingGhosts([]);
      setHistory(prev => [...prev, { grid: oldGrid, score }]);
      
      const slidGrid = result.grid;

      const oldCounts = {};
      const nextCounts = {};
      let milestoneTileFound = 0;

      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const valOld = oldGrid[r][c] ? oldGrid[r][c].value : 0;
          const valNext = slidGrid[r][c] ? slidGrid[r][c].value : 0;
          if (valOld > 0) oldCounts[valOld] = (oldCounts[valOld] || 0) + 1;
          if (valNext > 0) nextCounts[valNext] = (nextCounts[valNext] || 0) + 1;
        }
      }

      const milestonesToCheck = [2048, 1024, 512, 256, 128, 64];
      for (let m of milestonesToCheck) {
        const currentCount = nextCounts[m] || 0;
        const previousCount = oldCounts[m] || 0;

        if (currentCount > previousCount) {
          milestoneTileFound = m;
          break; 
        }
      }

      if (result.score > 0) {
        playMergeSound(milestoneTileFound > 0 ? milestoneTileFound : 2, soundEnabled, hapticEnabled);
      } else {
        playSwipeSound(direction, soundEnabled, hapticEnabled);
      }

      const nextScore = score + result.score;

      const currentMergedCoords = [];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const newTile = slidGrid[r][c];
          if (newTile) {
            const oldTile = oldGrid.flat().find(t => t && t.id === newTile.id);
            if (oldTile && newTile.value > oldTile.value) {
              currentMergedCoords.push(`${r}-${c}`);
            }
          }
        }
      }

      const ghosts = [];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const tile = slidGrid[r][c];
          if (tile && tile.mergedId) {
            for (let or = 0; or < 4; or++) {
              for (let oc = 0; oc < 4; oc++) {
                if (oldGrid[or][oc] && oldGrid[or][oc].id === tile.mergedId) {
                  ghosts.push({ ...oldGrid[or][oc], sourceR: or, sourceC: oc, targetR: r, targetC: c });
                }
              }
            }
          }
        }
      }

      setGrid(slidGrid);
      setScore(nextScore);
      setMergedCoords(currentMergedCoords);
      setMergingGhosts(ghosts);
      if (result.score > 0) triggerScoreAnimation();

      setTimeout(async () => {
        try {
          const finalGrid = spawnTile(slidGrid);
          
          let newCoord = null;
          finalGrid.forEach((row, r) => {
            row.forEach((cell, c) => {
              if (slidGrid[r][c] === null && finalGrid[r][c] !== null) {
                newCoord = `${r}-${c}`;
              }
            });
          });

          setGrid(finalGrid);
          setNewTileCoord(newCoord);
          setMergedCoords([]); 
          setMergingGhosts([]);
          saveGameState(finalGrid, nextScore);

          if (isGameOver(finalGrid)) {
            logGameEvent('game_over', {
              final_score: nextScore,
              highest_score_record: Math.max(nextScore, highScore),
              total_moves_played: history.length + 1
            });

            playGameStateSound('gameover', soundEnabled, hapticEnabled);

            if (username) {
              await submitGlobalScore(userId, username, nextScore, avatarId, '4x4');
            } else {
              setShowNameModal(true);
            }

            if (!isAdsRemoved) {
              const hasReadyInterstitial = typeof adContext?.isGameOverInterstitialReady === 'function'
                ? adContext.isGameOverInterstitialReady()
                : false;

              if (typeof adContext?.showGameOverInterstitial === 'function' && hasReadyInterstitial) {
                try {
                  adContext.showGameOverInterstitial();
                } catch (e) { /* Ad failed to show, proceed to Game Over */ }
              } else {
                console.log("[AdMob] Interstitial not ready to show at Game Over");
              }
            }
            setShowGameOverScreen(true);
          }
        } catch (error) {
          console.error("Critical Animation Loop Error:", error);
        } finally {
          isAnimating.current = false;
        }
      }, TILE_SLIDE_DURATION + 40);

      const nextMoveCount = powerUpMoveCount + 1;
      setPowerUpMoveCount(nextMoveCount);
      if (isNewUserTutorial && !undoTutorialShown && nextMoveCount === 1) {
        feedbackPromptSkippedSession.current = false; // Reset skip for new achievement
        setTimeout(() => {
          setUndoTutorialShown(true);
          setActiveTutorialStep('undo');
        }, 600);
      } else if (isNewUserTutorial && undoTutorialShown && !deleteTutorialShown && nextMoveCount === 3) {
        setTimeout(() => {
          setDeleteTutorialShown(true);
          feedbackPromptSkippedSession.current = false; // Reset skip for new achievement
          setActiveTutorialStep('delete');
        }, 600);
      }

      // Handle first-time milestone logic
      if (milestoneTileFound > 0 && !achievedMilestones[milestoneTileFound]) {
        const newMilestones = { ...achievedMilestones, [milestoneTileFound]: true };
        setAchievedMilestones(newMilestones);
        await AsyncStorage.setItem('mags_achieved_milestones', JSON.stringify(newMilestones));

        // Award coins for 2048+
        if (milestoneTileFound >= 2048) {
          const updatedCoins = coins + 1;
          await updateWalletCoins(updatedCoins);
          Alert.alert(
            "🪙 Milestone Earned!",
            `Amazing! You unlocked a ${milestoneTileFound} tile for the first time and earned +1 Coin!`,
            [{ text: "Sweet!", style: "default" }]
          );
        }

        // Trigger confetti and feedback for 64+
        if (milestoneTileFound >= 64) {
          setShowConfetti(false);
          setTimeout(() => setShowConfetti(true), 10);
          setTimeout(() => setShowConfetti(false), 3000);

          if (!wasFeedbackPromptShownToday && !feedbackPromptSkippedSession.current) {
            setTimeout(() => setShowFeedbackPrompt(true), 3500);
          }
        }

        logGameEvent('score_milestone', {
          tile_value: milestoneTileFound,
          current_total_score: nextScore
        });
      }

      if (nextScore > highScore) {
        playHighScoreSound(soundEnabled, hapticEnabled);
        setHighScore(nextScore);
        saveHighScore(nextScore);
      }
    }
  };

  const handleUndo = async () => {
    if (activeTutorialStep === 'undo') setActiveTutorialStep(null);
    if (coins < 1) {
      Alert.alert(
        "Insufficient Coins", 
        "An Undo action costs 1 Coin. Would you like to watch a short video to earn 1 free coin?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "📺 Earn 1 Coin", onPress: launchRewardedAdVideo }
        ]
      );
      return;
    }

    if (history.length > 0) {
      // Safety: Reset animation flag to ensure board isn't locked 
      // if undo is triggered during a transition or immediately after game over
      isAnimating.current = false;

      logGameEvent('powerup_used', { type: 'undo_move', score_at_time_of_use: score });
      playPowerUpSound('undo', soundEnabled, hapticEnabled);

      const previousState = history[history.length - 1];
      setNewTileCoord(null);
      setMergedCoords([]);
      setIsDeleteMode(false);
      setShowGameOverScreen(false);
      setGrid(previousState.grid);
      setScore(previousState.score);
      setHistory(prev => prev.slice(0, -1));
      saveGameState(previousState.grid, previousState.score);

      await updateWalletCoins(coins - 1);
    }
  };

  const handleTileSelect = async (r, c) => {
    if (activeTutorialStep === 'delete_select') setActiveTutorialStep(null);
    if (!isDeleteMode) return;
    if (grid[r][c] === null) return;

    let activeTileCount = 0;
    grid.forEach(row => row.forEach(cell => { if (cell !== null) activeTileCount++; }));

    if (activeTileCount <= 1) {
      Alert.alert("Action Blocked", "You cannot delete a tile if it is the only one remaining on the board!");
      setIsDeleteMode(false);
      return;
    }

    logGameEvent('powerup_used', {
      type: 'delete_tile',
      deleted_tile_value: grid[r][c] ? grid[r][c].value : null,
      score_at_time_of_use: score
    });

    playPowerUpSound('delete', soundEnabled, hapticEnabled);

    const oldGrid = JSON.parse(JSON.stringify(grid));
    setHistory(prev => [...prev, { grid: oldGrid, score }]);

    const nextGrid = grid.map(row => row.map(cell => (cell ? { ...cell } : null)));
    nextGrid[r][c] = null;

    setNewTileCoord(null);
    setMergedCoords([]);
    setGrid(nextGrid);
    setIsDeleteMode(false);
    setShowGameOverScreen(false);
    saveGameState(nextGrid, score);

    await updateWalletCoins(coins - 2);
  };

  const toggleDeleteMode = () => {
    if (activeTutorialStep === 'delete') {
      setActiveTutorialStep('delete_select');
      setIsDeleteMode(true);
      return;
    }
    // Mandatory flow: prevent toggling off during the selection nudge
    if (activeTutorialStep === 'delete_select') return;

    if (coins < 2 && !isDeleteMode) {
      Alert.alert(
        "Insufficient Coins", 
        "Deleting a tile costs 2 Coins. Would you like to watch a short video to earn a free coin?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "📺 Earn 1 Coin", onPress: launchRewardedAdVideo }
        ]
      );
      return;
    }
    setIsDeleteMode(!isDeleteMode);
  };

  const triggerGameOverDeleteMode = () => {
    if (coins < 2) {
      Alert.alert(
        "Insufficient Coins", 
        "Deleting a tile costs 2 Coins. Would you like to watch a short video to earn a free coin?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "📺 Earn 1 Coin", onPress: launchRewardedAdVideo }
        ]
      );
      return;
    }
    setShowGameOverScreen(false);
    setIsDeleteMode(true);
    Alert.alert("Power-Up Activated", "Select any numbered tile on the board to clear it and keep playing!");
  };

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: () => true,
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
  }), [grid, isDeleteMode, showGameOverScreen, handleMove]);

  const pointerProps = useMemo(() => {
    if (!activeTutorialStep) {
      return { left: 0, bottom: 0, emoji: '', tutorialText: null };
    }
    let left = activeTutorialStep === 'undo' ? width * 0.21 : width * 0.69;
    let bottom = 190;
    let tutorialText = null;
    let emoji = activeTutorialStep === 'delete_select' ? "👆" : "👇";

    if (activeTutorialStep === 'delete_select') {
      let tr = 1.5, tc = 1.5;
      if (newTileCoord) {
        const coords = newTileCoord.split('-');
        tr = parseInt(coords[0], 10);
        tc = parseInt(coords[1], 10);
      }
      left = 20 + tc * CELL_SIZE + (CELL_SIZE * 0.7) - 24;
      bottom = (height * 0.52) + (1.5 - tr) * CELL_SIZE - 40;
      tutorialText = "TAP HERE";
    }
    return { left, bottom, emoji, tutorialText };
  }, [activeTutorialStep, newTileCoord, width, height, CELL_SIZE]);

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <TouchableOpacity 
            onLongPress={() => setShowFeedbackPrompt(true)}
            delayLongPress={2000}
            activeOpacity={0.9}
          >
            <Text style={styles.title}>Go! 2048</Text>
          </TouchableOpacity>
          <Text style={styles.subtitle}>Slide & Merge to win!</Text>
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
          <Button3D
            style={[styles.scoreContainer, styles.coinWalletContainer]}
            onPress={() => {
              Alert.alert(
                "Need Extra Coins?",
                "Watch a quick 5-second sponsor video to add +1 free Coin to your wallet!",
                [
                  { text: "Later", style: "cancel" },
                  { text: "📺 Watch Video", onPress: launchRewardedAdVideo }
                ]
              );
            }}
          >
            <Text style={[styles.scoreLabel, styles.coinLabelText]}>GET FREE 🪙</Text>
            <Text style={styles.coinValueText}>🪙 {coins}</Text>
          </Button3D>
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.backgroundGrid}>
          {Array(16).fill(null).map((_, i) => (
            <View key={`bg-${i}`} style={styles.cellPlaceholder} />
          ))}
        </View>
        <View style={styles.tileContainer}>
          {(() => {
            const tiles = [];
            grid.forEach((row, r) => {
              row.forEach((cell, c) => {
                if (cell !== null) tiles.push({ ...cell, r, c });
              });
            });
            const tileElements = tiles.map((tile) => (
              <AnimatedTileWrapper
                key={tile.id}
                r={tile.r}
                c={tile.c}
                isDeleteMode={isDeleteMode}
                onTileSelect={() => handleTileSelect(tile.r, tile.c)}
              >
                <Tile 
                  value={tile.value} 
                  cellSize={CELL_SIZE} 
                  isNew={newTileCoord === `${tile.r}-${tile.c}`} 
                  isMerged={mergedCoords.includes(`${tile.r}-${tile.c}`)}
                  isHighlighted={activeTutorialStep === 'delete_select' && newTileCoord === `${tile.r}-${tile.c}`}
                  slideDuration={TILE_SLIDE_DURATION}
                  r={tile.r}
                  c={tile.c}
                />
              </AnimatedTileWrapper>
            ));

            const ghostElements = mergingGhosts.map((ghost) => (
              <AnimatedTileWrapper
                key={`ghost-${ghost.id}`}
                r={ghost.targetR}
                c={ghost.targetC}
                fromR={ghost.sourceR}
                fromC={ghost.sourceC}
                isDeleteMode={false}
              >
                <Tile value={ghost.value} cellSize={CELL_SIZE} isNew={false} isMerged={false} />
              </AnimatedTileWrapper>
            ));

            return [...tileElements, ...ghostElements];
          })()}
        </View>
      </View>

      <View style={styles.powerUpsWrapper}>
        <Text style={styles.powerUpsTitle}>POWER-UPS</Text>
        
        <View style={styles.powerUpRow}>
          <Animated.View style={{ 
            width: '48.5%', 
            transform: [{ scale: activeTutorialStep === 'undo' ? tutorialPulseAnim : 1 }],
            zIndex: activeTutorialStep === 'undo' ? 3001 : 1 
          }}>
            <Button3D 
              style={[
                styles.powerUpBtn, 
                styles.undoBtn, 
                history.length === 0 && styles.disabledBtn,
                { width: '100%' }
              ]} 
              onPress={handleUndo}
              disabled={history.length === 0}
            >
              <Text style={[styles.powerUpBtnText, history.length === 0 && styles.disabledBtnText]}>
                ↩ Undo  <Text style={styles.coinCostBadge}>1 🪙</Text>
              </Text>
            </Button3D>
          </Animated.View>

          <Animated.View style={{ 
            width: '48.5%', 
            transform: [{ scale: activeTutorialStep === 'delete' ? tutorialPulseAnim : 1 }],
            zIndex: activeTutorialStep === 'delete' ? 3001 : 1 
          }}>
            <Button3D 
              style={[
                styles.powerUpBtn, 
                styles.deleteBtn, 
                isDeleteMode && styles.activeDeleteBtn,
                { width: '100%' }
              ]} 
              onPress={toggleDeleteMode}
            >
              <Text style={styles.powerUpBtnText}>
                {isDeleteMode ? "📭 Select Tile..." : "✕ Delete  "}
                {!isDeleteMode && <Text style={styles.coinCostBadge}>2 🪙</Text>}
              </Text>
            </Button3D>
          </Animated.View>
        </View>

        <View style={styles.powerUpRow}>
          <Button3D style={[styles.powerUpBtn, styles.homeBtn]} onPress={() => {
            Alert.alert(
              "Start New Game?",
              "Are you sure you want to end this game? Your current progress will be lost.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Start New", style: "destructive", onPress: () => resetGame() }
              ]
            );
          }}>
            <Text style={styles.powerUpBtnText}>🔄Restart</Text>
          </Button3D>
          
          <Button3D 
            style={[styles.powerUpBtn, styles.settingsBtn, { backgroundColor: '#707070' }]}
            onPress={() => setShowSettingsModal(true)}
          >
            <Text style={styles.powerUpBtnText}>⚙️ Settings</Text>
          </Button3D>
        </View>

        {/* {!isAdsRemoved && (
          <Button3D style={styles.removeAdsBtn} onPress={() => navigation.navigate('Shop')}>
            <Text style={styles.removeAdsBtnText}>Remove Ads — Open Shop</Text>
          </Button3D>
        )} */}
      </View>

      {showSettingsModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.settingsCard}>
            <Text style={styles.settingsTitle}>Settings</Text>
            
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Sound Effects</Text>
              <Button3D
                style={soundEnabled ? styles.toggleActive : styles.toggleInactive}
                onPress={() => setSoundEnabled(!soundEnabled)}
              >
                <Text style={styles.toggleText}>{soundEnabled ? "ON" : "OFF"}</Text>
              </Button3D>
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Haptic Feedback</Text>
              <Button3D
                style={hapticEnabled ? styles.toggleActive : styles.toggleInactive}
                onPress={() => setHapticEnabled(!hapticEnabled)}
              >
                <Text style={styles.toggleText}>{hapticEnabled ? "ON" : "OFF"}</Text>
              </Button3D>
            </View>

            <Button3D style={[styles.menuItemBtn, { backgroundColor: '#e1b024' }]} onPress={() => { setShowSettingsModal(false); navigation.navigate('Shop'); }}>
              <Text style={styles.menuItemText}>👑 Open Game Shop</Text>
            </Button3D>

            <Button3D style={styles.menuItemBtn} onPress={() => Alert.alert("How to Play - Go! 2048", "Slide matching number blocks into each other to add them up to reach the 2048 tile! This earns you +1 coins in reward!")}>
              <Text style={styles.menuItemText}>📖 How to Play Tutorial</Text>
            </Button3D>

            <Button3D style={styles.closeSettingsBtn} onPress={() => setShowSettingsModal(false)}>
              <Text style={styles.closeSettingsText}>Close</Text>
            </Button3D>
          </View>
        </View>
      )}

      {showGameOverScreen && (
        <View style={styles.modalOverlay}>
          <View style={styles.gameOverCard}>
            <Text style={styles.gameOverEmoji}>🎮</Text>
            <Text style={styles.gameOverTitle}>Game Over</Text>
            
            <View style={styles.finalScoreRow}>
              <View style={styles.finalScoreBox}>
                <Text style={styles.finalScoreLabel}>FINAL SCORE</Text>
                <Text style={styles.finalScoreValue}>{score}</Text>
              </View>
              <View style={[styles.finalScoreBox, styles.gameOverWalletBox]}>
                <Text style={styles.gameOverWalletLabel}>YOUR WALLET</Text>
                <Text style={styles.gameOverWalletValue}>🪙 {coins} Coins</Text>
              </View>
            </View>

            {coins < 1 && (
              <Button3D style={styles.gameOverWatchAdBtn} onPress={() => { setShowGameOverScreen(false); launchRewardedAdVideo(); }}>
                <Text style={styles.gameOverWatchAdBtnText}>📺 Watch Video for Free +1 Coin</Text>
              </Button3D>
            )}

            <Text style={styles.gameOverHelpText}>Spend coins to purchase a lifeline power-up or restart clean:</Text>

            <View style={styles.gameOverBtnRow}>
              <Animated.View style={{ width: '48.5%', transform: [{ scale: pulseAnim }] }}>
                <Button3D 
                  style={[
                    styles.gameOverBtn, 
                    styles.undoBtn, 
                    history.length === 0 && styles.disabledBtn,
                    { width: '100%' }
                  ]} 
                  onPress={handleUndo}
                  disabled={history.length === 0}
                >
                  <Text style={styles.powerUpBtnText}>
                    ↩ Undo (1 🪙)
                  </Text>
                </Button3D>
              </Animated.View>

              <Animated.View style={{ width: '48.5%', transform: [{ scale: pulseAnim }] }}>
                <Button3D 
                  style={[
                    styles.gameOverBtn,
                    styles.deleteBtn,
                    { width: '100%' }
                  ]} 
                  onPress={triggerGameOverDeleteMode}
                >
                  <Text style={styles.powerUpBtnText}>
                    ✕ Delete (2 🪙)
                  </Text>
                </Button3D>
              </Animated.View>
            </View>

            <View style={styles.gameOverBtnRow}>
              <Button3D style={[styles.gameOverBtn, styles.homeBtn]} onPress={resetGame}>
                <Text style={styles.powerUpBtnText}>🔄Restart</Text>
              </Button3D>

              <Button3D style={[styles.gameOverBtn, styles.settingsBtn]} onPress={() => { setShowGameOverScreen(false); navigation.navigate('Home'); }}>
                <Text style={styles.powerUpBtnText}>🏠 Home Menu</Text>
              </Button3D>
            </View>
          </View>
        </View>
      )}

      {/* The Confetti component renders a full-screen canvas of falling particles when active is true */}
      {/* <Confetti active={showConfetti} /> */}

      {/* --- FEEDBACK LOOP MODALS --- */}
      {showFeedbackPrompt && (
        <View style={[styles.modalOverlay, { zIndex: 10000 }]}>
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackTitle}>Enjoying Go! 2048?</Text>
            <Text style={styles.feedbackMessage}>We'd love to hear your thoughts!</Text>
            <Button3D style={[styles.feedbackButton, { backgroundColor: '#4CAF50' }]} onPress={() => handleFeedbackPromptResponse('yes')}>
              <Text style={styles.feedbackButtonText}>Yes, I love it!</Text>
            </Button3D>
            <Button3D style={[styles.feedbackButton, { backgroundColor: '#FFC107' }]} onPress={() => handleFeedbackPromptResponse('later')}>
              <Text style={styles.feedbackButtonText}>Later</Text>
            </Button3D>
            <Button3D style={[styles.feedbackButton, { backgroundColor: '#F44336' }]} onPress={() => handleFeedbackPromptResponse('no')}>
              <Text style={styles.feedbackButtonText}>Not really...</Text>
            </Button3D>
          </View>
        </View>
      )}

      {showDislikeFeedbackModal && (
        <View style={[styles.modalOverlay, { zIndex: 10000 }]}>
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackTitle}>What didn't you like?</Text>
            <Text style={styles.feedbackMessage}>Your feedback helps us improve.</Text>
            <TextInput
              style={styles.feedbackInput}
              placeholder="Tell us what went wrong..."
              placeholderTextColor="#9BA7B0"
              multiline
              numberOfLines={4}
              value={feedbackText}
              onChangeText={setFeedbackText}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
              <Button3D 
                style={[styles.feedbackButton, { width: '48%', backgroundColor: '#2196F3' }]} 
                onPress={handleSendDislikeFeedback}
              >
                <Text style={styles.feedbackButtonText}>Send</Text>
              </Button3D>
              <Button3D 
                style={[styles.feedbackButton, { width: '48%', backgroundColor: '#9E9E9E' }]} 
                onPress={handleCancelDislikeFeedback}
              >
                <Text style={styles.feedbackButtonText}>Cancel</Text>
              </Button3D>
            </View>
          </View>
        </View>
      )}

      <UsernameModal visible={showNameModal} onSave={handleNameSave} />

      {activeTutorialStep && (
        <View style={[styles.tutorialOverlay, { zIndex: 9999 }]} pointerEvents="box-none">
          <View style={styles.tutorialDimmer} pointerEvents="none" />
          {activeTutorialStep !== 'delete_select' && (
            <Animated.View style={styles.tutorialCard}>
              <Text style={styles.tutorialTitle}>
                {activeTutorialStep === 'undo' ? "💡 TIP: UNDO MOVE" : "💡 TIP: DELETE TILE"}
              </Text>
              <Text style={styles.tutorialMessage}>
                {activeTutorialStep === 'undo' 
                  ? "Made a mistake? Use Undo to revert your last move. It helps you stay in the game longer!" 
                  : "Is the board getting crowded? Use Delete to remove any tile and create more space!"}
              </Text>
            </Animated.View>
          )}
          <Animated.Text
            pointerEvents="none"
            style={[
              styles.handPointer,
              {
                transform: [{ translateY: handAnim }],
                left: pointerProps.left,
                bottom: pointerProps.bottom
              }
            ]}
          >
            {pointerProps?.emoji}
          </Animated.Text>

          {/* New Text Label for "TAP HERE" */}
          {pointerProps?.tutorialText && (
            <Animated.Text
              pointerEvents="none"
              style={[
                styles.tapHereText,
                {
                  left: pointerProps.left + 30, // Position relative to hand pointer
                  bottom: pointerProps.bottom + 20, // Position relative to hand pointer
                  transform: [{ scale: tutorialPulseAnim }] // Reuse tutorialPulseAnim for text
                }
              ]}
            >
              {pointerProps.tutorialText}
            </Animated.Text>
          )}
        </View>
      )}

      {!isAdsRemoved && (
        <View style={styles.adWrapperBottom}>
          <BannerAd unitId={__DEV__ ? TestIds.BANNER : "ca-app-pub-2731691947572564/9661697789"} size={BannerAdSize.BANNER} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf8ef', alignItems: 'center', justifyContent: 'flex-start', paddingVertical: 10, paddingTop: GLOBAL_TOP_PADDING },
  header: { flexDirection: 'row', width: width - 40, justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 },
  titleContainer: { alignItems: 'flex-start' },
  title: { fontSize: 36, fontWeight: 'bold', color: '#776e65', lineHeight: 38 },
  subtitle: { color: '#776e65', fontSize: 13, fontWeight: '500', opacity: 0.8 },
  scoreBoard: { flexDirection: 'row' },
  scoreContainer: { backgroundColor: '#bbada0', padding: 8, borderRadius: 5, alignItems: 'center', minWidth: 58, marginLeft: 4 },
  scoreLabel: { color: '#eee4da', fontSize: 10, fontWeight: 'bold' },
  scoreValue: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  
  coinWalletContainer: { backgroundColor: '#e1b024', minWidth: 68 },
  coinLabelText: { color: '#ffffff', opacity: 0.95 },
  coinValueText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },

  adBanner: { flexDirection: 'row', backgroundColor: '#7c5bc4', width: width, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'space-between' },
  adTag: { backgroundColor: 'rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: 10, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3, fontWeight: 'bold' },
  adBannerText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  adCloseBtn: { paddingHorizontal: 4 },
  adCloseText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', opacity: 0.7 },

  grid: { width: width - 40, height: width - 40, backgroundColor: '#bbada0', borderRadius: 6, position: 'relative', overflow: 'hidden', marginTop: BOARD_MARGIN_TOP, marginBottom: BOARD_MARGIN_BOTTOM },
  backgroundGrid: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', flexWrap: 'wrap', padding: 5 },
  tileContainer: { ...StyleSheet.absoluteFillObject, padding: 5 },
  cellPlaceholder: { width: (width - 50) / 4 - 10, height: (width - 50) / 4 - 10, margin: 5, borderRadius: 5, backgroundColor: 'rgba(238, 228, 218, 0.35)' },

  powerUpsWrapper: { width: width - 40, marginTop: 0 },
  powerUpsTitle: { fontSize: 11, fontWeight: 'bold', color: '#bbada0', marginBottom: 6, letterSpacing: 0.5 },
  powerUpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  powerUpBtn: { paddingVertical: 14, borderRadius: 6, width: '48.5%', alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 4 },
  powerUpBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  coinCostBadge: { fontSize: 12, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, overflow: 'hidden', color: '#fff', fontWeight: 'bold' },
  
  undoBtn: { backgroundColor: '#f9945c' },
  deleteBtn: { backgroundColor: '#ff6b54' },
  activeDeleteBtn: { backgroundColor: '#c43d27' },
  homeBtn: { backgroundColor: '#8f7a66' }, 
  settingsBtn: { backgroundColor: '#bbada0' }, 
  
  disabledBtn: { backgroundColor: '#e4dbd2', opacity: 0.5 },
  disabledBtnText: { color: '#a69a8f', textDecorationLine: 'line-through' },

  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.55)', justifyContent: 'center', alignItems: 'center', zIndex: 2000 },
  adOverlayBackground: { backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 3000 },
  
  settingsCard: { width: width * 0.8, backgroundColor: '#faf8ef', padding: 24, borderRadius: 10, alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
  settingsTitle: { fontSize: 26, fontWeight: 'bold', color: '#776e65', marginBottom: 20 },
  settingRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee4da' },
  settingLabel: { fontSize: 16, fontWeight: '600', color: '#776e65' },
  toggleActive: { backgroundColor: '#8f7a66', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 4 },
  toggleInactive: { backgroundColor: '#e4dbd2', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 4 },
  toggleText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  menuItemBtn: { width: '100%', paddingVertical: 14, backgroundColor: '#bbada0', borderRadius: 6, alignItems: 'center', marginTop: 16, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 4 },
  menuItemText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  closeSettingsBtn: { marginTop: 24, paddingVertical: 10, width: '100%', alignItems: 'center', backgroundColor: '#f1f1f1', borderRadius: 6, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.16, shadowRadius: 4 },
  closeSettingsText: { color: '#776e65', fontSize: 15, fontWeight: 'bold', opacity: 0.8 },

  adVideoCard: { width: width * 0.88, backgroundColor: '#1a1a1a', borderRadius: 12, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  adVideoBadge: { color: '#aaa', fontSize: 10, fontWeight: 'bold', letterSpacing: 2, marginBottom: 14 },
  adVideoScreenPlaceholder: { width: '100%', height: 180, backgroundColor: '#0b0b0b', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 20, paddingHorizontal: 20 },
  adVideoPlayheadIcon: { fontSize: 44, marginBottom: 10 },
  adVideoPlaybackTitle: { color: '#ffffff', fontSize: 15, fontWeight: 'bold', textAlign: 'center' },
  adVideoSubtitleText: { color: '#666', fontSize: 12, marginTop: 4, textAlign: 'center' },
  adRewardClaimBtn: { width: '100%', backgroundColor: '#e1b024', paddingVertical: 15, borderRadius: 6, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 4 },
  adRewardClaimBtnDisabled: { backgroundColor: '#333' },
  adRewardClaimBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },

  interstitialOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#2c3e50', justifyContent: 'center', alignItems: 'center', zIndex: 4000 },
  interstitialContainer: { width: width * 0.9, backgroundColor: '#ffffff', padding: 30, borderRadius: 16, alignItems: 'center', elevation: 20 },
  interstitialBadge: { color: '#7f8c8d', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 15 },
  interstitialMainIcon: { fontSize: 60, marginBottom: 15 },
  interstitialTitle: { fontSize: 22, fontWeight: 'bold', color: '#2c3e50', textAlign: 'center', marginBottom: 8 },
  interstitialSubtext: { fontSize: 14, color: '#95a5a6', textAlign: 'center', marginBottom: 30, paddingHorizontal: 10 },
  interstitialCloseBtn: { width: '100%', backgroundColor: '#e74c3c', paddingVertical: 14, borderRadius: 8, alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 4 },
  interstitialCloseBtnDisabled: { backgroundColor: '#bdc3c7' },
  interstitialCloseText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },

  adWrapperBottom: { position: 'absolute', bottom: 0, width: width, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  removeAdsBtn: { width: width - 40, backgroundColor: '#e1b024', paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  removeAdsBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  gameOverCard: { width: width * 0.85, backgroundColor: '#faf8ef', padding: 24, borderRadius: 12, alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
  gameOverEmoji: { fontSize: 42, marginBottom: 5 },
  gameOverTitle: { fontSize: 32, fontWeight: 'bold', color: '#776e65', marginBottom: 15 },
  finalScoreRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 15 },
  finalScoreBox: { backgroundColor: '#bbada0', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center', width: '48.5%' },
  finalScoreLabel: { color: '#eee4da', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  finalScoreValue: { color: '#ffffff', fontSize: 22, fontWeight: 'bold', marginTop: 2 },
  
  gameOverWalletBox: { backgroundColor: '#e1b024' },
  gameOverWalletLabel: { color: '#fffdf0', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  gameOverWalletValue: { color: '#ffffff', fontSize: 20, fontWeight: 'bold', marginTop: 2 },

  gameOverWatchAdBtn: { width: '100%', backgroundColor: '#7c5bc4', paddingVertical: 12, borderRadius: 6, alignItems: 'center', marginBottom: 15, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 4 },
  gameOverWatchAdBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },

  gameOverHelpText: { color: '#776e65', fontSize: 13, textAlign: 'center', marginBottom: 20, opacity: 0.8, paddingHorizontal: 10 },
  gameOverBtnRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 12 },
  gameOverBtn: { paddingVertical: 14, borderRadius: 6, width: '48.5%', alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 4 },

  // --- TUTORIAL OVERLAY STYLES ---
  tutorialOverlay: { ...StyleSheet.absoluteFillObject, pointerEvents: 'box-none', justifyContent: 'center', alignItems: 'center' }, // zIndex moved to inline style
  tutorialDimmer: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  tutorialCard: { width: width * 0.84, backgroundColor: '#fff', padding: 22, borderRadius: 14, alignItems: 'center', elevation: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 6 },
  tutorialTitle: { fontSize: 18, fontWeight: 'bold', color: '#776e65', marginBottom: 10 },
  tutorialMessage: { fontSize: 14, color: '#776e65', textAlign: 'center', marginBottom: 5, lineHeight: 22, fontWeight: '500' },
  tutorialSkipText: { color: '#8f7a66', fontWeight: 'bold', fontSize: 14, textDecorationLine: 'underline' },
  handPointer: { position: 'absolute', fontSize: 48, zIndex: 6000, textShadowColor: 'rgba(0, 0, 0, 0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },

  // --- FEEDBACK MODAL STYLES ---
  feedbackCard: { width: width * 0.85, backgroundColor: '#faf8ef', padding: 24, borderRadius: 12, alignItems: 'center' },
  feedbackTitle: { fontSize: 24, fontWeight: 'bold', color: '#776e65', marginBottom: 10 },
  feedbackMessage: { fontSize: 16, color: '#8f7a66', textAlign: 'center', marginBottom: 20 },
  feedbackButton: { width: '80%', paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  feedbackButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  feedbackInput: { width: '100%', height: 100, backgroundColor: '#eee4da', borderRadius: 8, padding: 10, marginBottom: 20, textAlignVertical: 'top', fontSize: 15, color: '#776e65' },

  // --- NEW STYLE FOR "TAP HERE" TEXT ---
  tapHereText: {
    position: 'absolute',
    backgroundColor: '#e1b024',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    zIndex: 6001, // Ensure it's above the hand pointer
  }
});




// import React, { useState, useEffect, useRef } from 'react';
// import { StyleSheet, View, Text, Dimensions, PanResponder, Alert, TouchableOpacity, Animated, Easing } from 'react-native';
// import { initializeGrid, moveGrid, isGameOver, spawnTile } from '../utils/gameLogic';
// import { saveGameState, loadGameState, getHighScore, saveHighScore, saveUsername, getUsername, saveCoins, getCoins } from '../utils/storage';
// import { submitGlobalScore } from '../utils/firebase';
// import Tile from '../components/Tile';
// import Confetti from '../components/Confetti';
// import UsernameModal from '../components/UsernameModal';
// import Button3D from '../components/Button3D';
// import { useAds } from '../context/AdContext';
// import { BannerAdMock } from '../utils/admobMock';

// import { logGameEvent } from '../utils/analytics';
// import {
//   preloadGameAudio,
//   playSwipeSound,
//   playMergeSound,
//   playPowerUpSound,
//   playGameStateSound,
//   playHighScoreSound
// } from '../utils/audioController';

// const { width } = Dimensions.get('window');
// const CELL_SIZE = (width - 40) / 4;
// const TILE_SLIDE_DURATION = 150; // Optimized for snappy gameplay feel

// const convertNumericGridToObjects = (numericGrid) => {
//   if (!Array.isArray(numericGrid)) return numericGrid;
//   return numericGrid.map((row) =>
//     row.map((cell) => (cell === 0 || cell === '0' ? null : (cell === null ? null : { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, value: cell })))
//   );
// };

// // --- HELPER COMPONENT FOR SMOOTH SLIDING WRAPPERS ---
// function AnimatedTileWrapper({ r, c, fromR, fromC, isDeleteMode, onTileSelect, children }) {
//   const startX = (fromC !== undefined ? fromC : c) * CELL_SIZE;
//   const startY = (fromR !== undefined ? fromR : r) * CELL_SIZE;
//   const animatedPos = useRef(new Animated.ValueXY({ x: startX, y: startY })).current;

//   useEffect(() => {
//     Animated.timing(animatedPos, {
//       toValue: { x: c * CELL_SIZE, y: r * CELL_SIZE },
//       duration: TILE_SLIDE_DURATION,
//       easing: Easing.out(Easing.quad), // Starts fast, slows down at the end
//       useNativeDriver: true,
//     }).start();
//   }, [r, c]);

//   return (
//     <Animated.View
//       style={{
//         position: 'absolute',
//         width: CELL_SIZE,
//         height: CELL_SIZE,
//         justifyContent: 'center',
//         alignItems: 'center',
//         transform: [
//           { translateX: animatedPos.x },
//           { translateY: animatedPos.y }
//         ]
//       }}
//     >
//       <TouchableOpacity
//         activeOpacity={isDeleteMode ? 0.5 : 1}
//         onPress={onTileSelect}
//         disabled={!isDeleteMode}
//         style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
//       >
//         {children}
//       </TouchableOpacity>
//     </Animated.View>
//   );
// }

// export default function GameScreen({ navigation }) {
//   const adContext = useAds();
//   const isAdsRemoved = adContext?.adsRemoved;
//   const hideInterstitialAction = adContext?.hideInterstitialAction;

//   const [grid, setGrid] = useState(initializeGrid());
//   const [score, setScore] = useState(0);
//   const [highScore, setHighScore] = useState(0);
//   const [history, setHistory] = useState([]);
//   const [username, setUsername] = useState(null);
//   const [showNameModal, setShowNameModal] = useState(false);

//   const [newTileCoord, setNewTileCoord] = useState(null);
//   const [mergedCoords, setMergedCoords] = useState([]);
//   const [showConfetti, setShowConfetti] = useState(false);

//   const [showSettingsModal, setShowSettingsModal] = useState(false);
//   const [soundEnabled, setSoundEnabled] = useState(true);
//   const [hapticEnabled, setHapticEnabled] = useState(true);

//   const [isDeleteMode, setIsDeleteMode] = useState(false);
//   const [coins, setCoins] = useState(0);

//   const [showRewardedAdModal, setShowRewardedAdModal] = useState(false);
//   const [adCountdown, setAdCountdown] = useState(5);
//   const adTimerRef = useRef(null);

//   const [showAd, setShowAd] = useState(true);
//   const [showInterstitialMock, setShowInterstitialMock] = useState(false);
//   const [isNewUserTutorial, setIsNewUserTutorial] = useState(false);
//   const [powerUpMoveCount, setPowerUpMoveCount] = useState(0);
//   const [undoTutorialShown, setUndoTutorialShown] = useState(false);
//   const [deleteTutorialShown, setDeleteTutorialShown] = useState(false);

//   const [showGameOverScreen, setShowGameOverScreen] = useState(false);
//   const [mergingGhosts, setMergingGhosts] = useState([]);

//   const scoreBounce = useRef(new Animated.Value(1)).current;
//   const isAnimating = useRef(false);

//   useEffect(() => {
//     const init = async () => {
//       await preloadGameAudio();

//       const storedCoins = await getCoins();
//       if (storedCoins === null) {
//         setCoins(5);
//         setIsNewUserTutorial(true);
//         await saveCoins(5);
//         Alert.alert(
//           "🎁 Welcome Bonus!",
//           "You have been awarded a complimentary Welcome Bonus of 5 Coins! Use them to activate Undo and Delete power-ups during your matches.",
//           [{ text: "Awesome!", style: "default" }]
//         );
//       } else {
//         setCoins(storedCoins);
//       }

//       const saved = await loadGameState();
//       if (saved && saved.grid) {
//         const sampleCell = saved.grid && saved.grid[0] && saved.grid[0][0];
//         if (typeof sampleCell === 'number') {
//           setGrid(convertNumericGridToObjects(saved.grid));
//         } else {
//           setGrid(saved.grid);
//         }
//         setScore(saved.score);
//       } else {
//         playGameStateSound('start', soundEnabled, hapticEnabled);
//       }
//       const high = await getHighScore();
//       setHighScore(high);

//       const storedName = await getUsername();
//       setUsername(storedName);

//       logGameEvent('screen_view', {
//         screen_name: 'GameScreen',
//         purpose: 'active_gameplay'
//       });
//     };
//     init();

//     return () => clearInterval(adTimerRef.current);
//   }, []);

//   useEffect(() => {
//     const syncCoins = navigation.addListener('focus', async () => {
//       const storedCoins = await getCoins();
//       if (storedCoins !== null) {
//         setCoins(storedCoins);
//       }
//     });
//     return syncCoins;
//   }, [navigation]);

//   const triggerScoreAnimation = () => {
//     Animated.sequence([
//       Animated.timing(scoreBounce, { toValue: 1.2, duration: 100, useNativeDriver: true }),
//       Animated.timing(scoreBounce, { toValue: 1, duration: 100, useNativeDriver: true }),
//     ]).start();
//   };

//   const handleNameSave = async (name) => {
//     await saveUsername(name);
//     setUsername(name);
//     setShowNameModal(false);
//     await submitGlobalScore(name, score, '4x4');
//   };

//   const updateWalletCoins = async (newBalance) => {
//     setCoins(newBalance);
//     await saveCoins(newBalance);
//   };

//   const launchRewardedAdVideo = () => {
//     setIsDeleteMode(false);
//     setAdCountdown(5);
//     setShowRewardedAdModal(true);

//     logGameEvent('ad_request', { type: 'rewarded_video_coin' });

//     adTimerRef.current = setInterval(() => {
//       setAdCountdown((prev) => {
//         if (prev <= 1) {
//           clearInterval(adTimerRef.current);
//           return 0;
//         }
//         return prev - 1;
//       });
//     }, 1000);
//   };

//   const claimAdCoinReward = async () => {
//     if (adCountdown > 0) return;

//     clearInterval(adTimerRef.current);
//     setShowRewardedAdModal(false);

//     const updatedCoins = coins + 1;
//     await updateWalletCoins(updatedCoins);

//     logGameEvent('ad_reward_claimed', { resulting_wallet_total: updatedCoins });

//     Alert.alert(
//       "🪙 Reward Claimed!",
//       "Thank you for watching! +1 Coin has been securely added to your layout balance.",
//       [{ text: "Continue playing", style: "default" }]
//     );
//   };

//   const resetGame = () => {
//     logGameEvent('game_restart', {
//       current_score_at_reset: score,
//       moves_made_before_reset: history.length
//     });

//     playGameStateSound('start', soundEnabled, hapticEnabled);

//     setNewTileCoord(null);
//     setMergedCoords([]);
//     setShowConfetti(false);
//     setIsDeleteMode(false);
//     setShowGameOverScreen(false);

//     const newGrid = initializeGrid();
//     setGrid(newGrid);
//     setScore(0);
//     setHistory([]);
//     saveGameState(newGrid, 0);
//   };

//   const handleMove = async (direction) => {
//     // Prevents move processing if board is locked, in delete mode, or game is over
//     if (isDeleteMode || showRewardedAdModal || showGameOverScreen || isAnimating.current === true) return;

//     const result = moveGrid(grid, direction);

//     if (result.changed) {
//       isAnimating.current = true;

//       const oldGrid = JSON.parse(JSON.stringify(grid));

//       // 1. Group immediate state resets to prevent "ghost" animations from previous turns
//       setNewTileCoord(null);
//       setMergedCoords([]);
//       setMergingGhosts([]);
//       setHistory(prev => [...prev, { grid: oldGrid, score }]);

//       const slidGrid = result.grid;

//       const oldCounts = {};
//       const nextCounts = {};
//       let milestoneTileFound = 0;

//       for (let r = 0; r < 4; r++) {
//         for (let c = 0; c < 4; c++) {
//           const valOld = oldGrid[r][c] ? oldGrid[r][c].value : 0;
//           const valNext = slidGrid[r][c] ? slidGrid[r][c].value : 0;
//           if (valOld > 0) oldCounts[valOld] = (oldCounts[valOld] || 0) + 1;
//           if (valNext > 0) nextCounts[valNext] = (nextCounts[valNext] || 0) + 1;
//         }
//       }

//       const milestonesToCheck = [2048, 1024, 512, 256, 128];
//       for (let m of milestonesToCheck) {
//         const currentCount = nextCounts[m] || 0;
//         const previousCount = oldCounts[m] || 0;

//         if (currentCount > previousCount) {
//           milestoneTileFound = m;
//           break;
//         }
//       }

//       if (result.score > 0) {
//         playMergeSound(milestoneTileFound > 0 ? milestoneTileFound : 2, soundEnabled, hapticEnabled);
//       } else {
//         playSwipeSound(direction, soundEnabled, hapticEnabled);
//       }

//       const nextScore = score + result.score;

//       // IMPROVED: Identify merged tiles by checking if their value increased relative to their own ID's previous value
//       const currentMergedCoords = [];
//       for (let r = 0; r < 4; r++) {
//         for (let c = 0; c < 4; c++) {
//           const newTile = slidGrid[r][c];
//           if (newTile) {
//             // Find this specific tile in the old grid by ID
//             const oldTile = oldGrid.flat().find(t => t && t.id === newTile.id);
//             if (oldTile && newTile.value > oldTile.value) {
//               currentMergedCoords.push(`${r}-${c}`);
//             }
//           }
//         }
//       }

//       // Identify "Ghost" tiles (the trailing tiles in a merge) to animate them alongside the main tile
//       const ghosts = [];
//       for (let r = 0; r < 4; r++) {
//         for (let c = 0; c < 4; c++) {
//           const tile = slidGrid[r][c];
//           if (tile && tile.mergedId) {
//             // Find the original (source) position of the merged contributor
//             for (let or = 0; or < 4; or++) {
//               for (let oc = 0; oc < 4; oc++) {
//                 if (oldGrid[or][oc] && oldGrid[or][oc].id === tile.mergedId) {
//                   ghosts.push({ ...oldGrid[or][oc], sourceR: or, sourceC: oc, targetR: r, targetC: c });
//                 }
//               }
//             }
//           }
//         }
//       }

//       // PHASE 1: Update grid and merge state simultaneously for Phase 1 render
//       setGrid(slidGrid);
//       setScore(nextScore);
//       setMergedCoords(currentMergedCoords);
//       setMergingGhosts(ghosts);
//       if (result.score > 0) triggerScoreAnimation();

//       // PHASE 2: Delay spawn until sliding finishes (Increased buffer for reliability)
//       setTimeout(async () => {
//         try {
//           const finalGrid = spawnTile(slidGrid);

//           let newCoord = null;
//           finalGrid.forEach((row, r) => {
//             row.forEach((cell, c) => {
//               if (slidGrid[r][c] === null && finalGrid[r][c] !== null) {
//                 newCoord = `${r}-${c}`;
//               }
//             });
//           });

//           // Group Phase 2 updates to ensure they happen in one render
//           setGrid(finalGrid);
//           setNewTileCoord(newCoord);
//           setMergedCoords([]);
//           setMergingGhosts([]);
//           saveGameState(finalGrid, nextScore);

//           // Check for Game Over only AFTER the tile has spawned
//           if (isGameOver(finalGrid)) {
//             logGameEvent('game_over', {
//               final_score: nextScore,
//               highest_score_record: Math.max(nextScore, highScore),
//               total_moves_played: history.length + 1
//             });

//             playGameStateSound('gameover', soundEnabled, hapticEnabled);

//             if (username) {
//               await submitGlobalScore(username, nextScore, '4x4');
//             } else {
//               setShowNameModal(true);
//             }

//             if (!isAdsRemoved) {
//               const hasReadyInterstitial = typeof adContext?.isInterstitialReady === 'function'
//                 ? adContext.isInterstitialReady()
//                 : false;

//               if (typeof adContext?.showInterstitial === 'function' && hasReadyInterstitial) {
//                 try {
//                   adContext.showInterstitial();
//                 } catch (e) {
//                   setShowInterstitialMock(true);
//                 }
//               } else {
//                 setShowInterstitialMock(true);
//               }
//             }
//             setShowGameOverScreen(true);
//           }
//         } catch (error) {
//           console.error("Critical Animation Loop Error:", error);
//         } finally {
//           // ALWAYS unlock the board, even if Firebase or Ads crash
//           isAnimating.current = false;
//         }
//       }, TILE_SLIDE_DURATION + 40); // Increased buffer to 40ms for smoother handoff

//       const nextMoveCount = powerUpMoveCount + 1;
//       setPowerUpMoveCount(nextMoveCount);
//       if (isNewUserTutorial && !undoTutorialShown && nextMoveCount === 1) {
//         setUndoTutorialShown(true);
//         setTimeout(() => {
//           Alert.alert(
//             'Power-Up Tip',
//             'Great first move! Use your free coin by tapping the Undo button to revert it and learn how the power-up works.',
//             [
//               { text: 'Later', style: 'cancel' },
//               { text: 'Try Undo', onPress: handleUndo }
//             ]
//           );
//         }, 200);
//       } else if (isNewUserTutorial && undoTutorialShown && !deleteTutorialShown && nextMoveCount === 3) {
//         setDeleteTutorialShown(true);
//         setTimeout(() => {
//           Alert.alert(
//             'Power-Up Tip',
//             'Nice progress! Now try the Delete power-up to remove a tile and keep your game going.',
//             [
//               { text: 'Later', style: 'cancel' },
//               { text: 'Try Delete', onPress: toggleDeleteMode }
//             ]
//           );
//         }, 200);
//       }

//       if (milestoneTileFound >= 2048) {
//         const updatedCoins = coins + 1;
//         await updateWalletCoins(updatedCoins);

//         Alert.alert(
//           "🪙 Milestone Earned!",
//           `Amazing! You unlocked a ${milestoneTileFound} tile and earned +1 Coin! Keep it up.`,
//           [{ text: "Sweet!", style: "default" }]
//         );

//         logGameEvent('score_milestone', {
//           tile_value: milestoneTileFound,
//           current_total_score: nextScore
//         });

//         if (milestoneTileFound >= 512) {
//           setShowConfetti(false);
//           setTimeout(() => setShowConfetti(true), 10);
//           setTimeout(() => setShowConfetti(false), 2000);
//         }
//       }

//       if (nextScore > highScore) {
//         playHighScoreSound(soundEnabled, hapticEnabled);
//         setHighScore(nextScore);
//         saveHighScore(nextScore);
//       }
//     }
//   };

//   const handleUndo = async () => {
//     if (coins < 1) {
//       Alert.alert(
//         "Insufficient Coins",
//         "An Undo action costs 1 Coin. Would you like to watch a short video to earn 1 free coin?",
//         [
//           { text: "Cancel", style: "cancel" },
//           { text: "📺 Earn 1 Coin", onPress: launchRewardedAdVideo }
//         ]
//       );
//       return;
//     }

//     if (history.length > 0) {
//       logGameEvent('powerup_used', { type: 'undo_move', score_at_time_of_use: score });
//       playPowerUpSound('undo', soundEnabled, hapticEnabled);

//       const previousState = history[history.length - 1];
//       setNewTileCoord(null);
//       setMergedCoords([]);
//       setIsDeleteMode(false);
//       setShowGameOverScreen(false);
//       setGrid(previousState.grid);
//       setScore(previousState.score);
//       setHistory(prev => prev.slice(0, -1));
//       saveGameState(previousState.grid, previousState.score);

//       await updateWalletCoins(coins - 1);
//     }
//   };

//   const handleTileSelect = async (r, c) => {
//     if (!isDeleteMode) return;
//     if (grid[r][c] === null) return;

//     let activeTileCount = 0;
//     grid.forEach(row => row.forEach(cell => { if (cell !== null) activeTileCount++; }));

//     if (activeTileCount <= 1) {
//       Alert.alert("Action Blocked", "You cannot delete a tile if it is the only one remaining on the board!");
//       setIsDeleteMode(false);
//       return;
//     }

//     logGameEvent('powerup_used', {
//       type: 'delete_tile',
//       deleted_tile_value: grid[r][c] ? grid[r][c].value : null,
//       score_at_time_of_use: score
//     });

//     playPowerUpSound('delete', soundEnabled, hapticEnabled);

//     const oldGrid = JSON.parse(JSON.stringify(grid));
//     setHistory(prev => [...prev, { grid: oldGrid, score }]);

//     const nextGrid = grid.map(row => row.map(cell => (cell ? { ...cell } : null)));
//     nextGrid[r][c] = null;

//     setNewTileCoord(null);
//     setMergedCoords([]);
//     setGrid(nextGrid);
//     setIsDeleteMode(false);
//     setShowGameOverScreen(false);
//     saveGameState(nextGrid, score);

//     await updateWalletCoins(coins - 2);
//   };

//   const toggleDeleteMode = () => {
//     if (coins < 2 && !isDeleteMode) {
//       Alert.alert(
//         "Insufficient Coins",
//         "Deleting a tile costs 2 Coins. Would you like to watch a short video to earn a free coin?",
//         [
//           { text: "Cancel", style: "cancel" },
//           { text: "📺 Earn 1 Coin", onPress: launchRewardedAdVideo }
//         ]
//       );
//       return;
//     }
//     setIsDeleteMode(!isDeleteMode);
//   };

//   const triggerGameOverDeleteMode = () => {
//     if (coins < 2) {
//       Alert.alert(
//         "Insufficient Coins",
//         "Deleting a tile costs 2 Coins. Would you like to watch a short video to earn a free coin?",
//         [
//           { text: "Cancel", style: "cancel" },
//           { text: "📺 Earn 1 Coin", onPress: launchRewardedAdVideo }
//         ]
//       );
//       return;
//     }
//     setShowGameOverScreen(false);
//     setIsDeleteMode(true);
//     Alert.alert("Power-Up Activated", "Select any numbered tile on the board to clear it and keep playing!");
//   };

//   const panResponder = PanResponder.create({
//     onStartShouldSetPanResponder: () => true,
//     onPanResponderRelease: (e, gestureState) => {
//       const { dx, dy } = gestureState;
//       if (Math.abs(dx) > Math.abs(dy)) {
//         if (dx > 30) handleMove('right');
//         else if (dx < -30) handleMove('left');
//       } else {
//         if (dy > 30) handleMove('down');
//         else if (dy < -30) handleMove('up');
//       }
//     },
//   });

//   return (
//     <View style={styles.container} {...panResponder.panHandlers}>
//       <View style={styles.header}>
//         <View style={styles.titleContainer}>
//           <Text style={styles.title}>2048</Text>
//           <Text style={styles.subtitle}>Join tiles to win!</Text>
//         </View>
//         <View style={styles.scoreBoard}>
//           <Animated.View style={[styles.scoreContainer, { transform: [{ scale: scoreBounce }] }]}>
//             <Text style={styles.scoreLabel}>SCORE</Text>
//             <Text style={styles.scoreValue}>{score}</Text>
//           </Animated.View>
//           <View style={styles.scoreContainer}>
//             <Text style={styles.scoreLabel}>BEST</Text>
//             <Text style={styles.scoreValue}>{highScore}</Text>
//           </View>
//           <Button3D
//             style={[styles.scoreContainer, styles.coinWalletContainer]}
//             onPress={() => {
//               Alert.alert(
//                 "Need Extra Coins?",
//                 "Watch a quick 5-second sponsor video to add +1 free Coin to your wallet!",
//                 [
//                   { text: "Later", style: "cancel" },
//                   { text: "📺 Watch Video", onPress: launchRewardedAdVideo }
//                 ]
//               );
//             }}
//           >
//             <Text style={[styles.scoreLabel, styles.coinLabelText]}>GET 🪙</Text>
//             <Text style={styles.coinValueText}>🪙 {coins}</Text>
//           </Button3D>
//         </View>
//       </View>

//       <View style={styles.grid}>
//         <View style={styles.backgroundGrid}>
//           {Array(16).fill(null).map((_, i) => (
//             <View key={`bg-${i}`} style={styles.cellPlaceholder} />
//           ))}
//         </View>
//         <View style={styles.tileContainer}>
//           {(() => {
//             const tiles = [];
//             // 1. Render primary tiles
//             grid.forEach((row, r) => {
//               row.forEach((cell, c) => {
//                 if (cell !== null) tiles.push({ ...cell, r, c });
//               });
//             });
//             const tileElements = tiles.map((tile) => (
//               <AnimatedTileWrapper
//                 key={tile.id}
//                 r={tile.r}
//                 c={tile.c}
//                 isDeleteMode={isDeleteMode}
//                 onTileSelect={() => handleTileSelect(tile.r, tile.c)}
//               >
//                 <Tile
//                   value={tile.value}
//                   cellSize={CELL_SIZE}
//                   isNew={newTileCoord === `${tile.r}-${tile.c}`}
//                   isMerged={mergedCoords.includes(`${tile.r}-${tile.c}`)}
//                   slideDuration={TILE_SLIDE_DURATION}
//                   r={tile.r}
//                   c={tile.c}
//                 />
//               </AnimatedTileWrapper>
//             ));

//             // 2. Render Ghost tiles (the contributors to a merge)
//             const ghostElements = mergingGhosts.map((ghost) => (
//               <AnimatedTileWrapper
//                 key={`ghost-${ghost.id}`}
//                 r={ghost.targetR}
//                 c={ghost.targetC}
//                 fromR={ghost.sourceR}
//                 fromC={ghost.sourceC}
//                 isDeleteMode={false}
//               >
//                 {/* Ghost shows the original value (2) sliding to the target */}
//                 <Tile value={ghost.value} cellSize={CELL_SIZE} isNew={false} isMerged={false} />
//               </AnimatedTileWrapper>
//             ));

//             return [...tileElements, ...ghostElements];
//           })()}
//         </View>
//       </View>

//       <View style={styles.powerUpsWrapper}>
//         <Text style={styles.powerUpsTitle}>POWER-UPS</Text>

//         <View style={styles.powerUpRow}>
//           <Button3D
//             style={[
//               styles.powerUpBtn,
//               styles.undoBtn,
//               history.length === 0 && styles.disabledBtn
//             ]}
//             onPress={handleUndo}
//             disabled={history.length === 0}
//           >
//             <Text style={[styles.powerUpBtnText, history.length === 0 && styles.disabledBtnText]}>
//               ↩ Undo  <Text style={styles.coinCostBadge}>1 🪙</Text>
//             </Text>
//           </Button3D>

//           <Button3D
//             style={[
//               styles.powerUpBtn,
//               styles.deleteBtn,
//               isDeleteMode && styles.activeDeleteBtn
//             ]}
//             onPress={toggleDeleteMode}
//           >
//             <Text style={styles.powerUpBtnText}>
//               {isDeleteMode ? "📭 Select Tile..." : "✕ Delete  "}
//               {!isDeleteMode && <Text style={styles.coinCostBadge}>2 🪙</Text>}
//             </Text>
//           </Button3D>
//         </View>

//         <View style={styles.powerUpRow}>
//           <Button3D style={[styles.powerUpBtn, styles.homeBtn]} onPress={() => {
//             Alert.alert(
//               "Start New Game?",
//               "Are you sure you want to end this game? Your current progress will be lost.",
//               [
//                 { text: "Cancel", style: "cancel" },
//                 { text: "Start New", style: "destructive", onPress: () => resetGame() }
//               ]
//             );
//           }}>
//             <Text style={styles.powerUpBtnText}>🔄Restart</Text>
//           </Button3D>

//           <Button3D
//             style={[styles.powerUpBtn, styles.settingsBtn, { backgroundColor: '#707070' }]}
//             onPress={() => setShowSettingsModal(true)}
//           >
//             <Text style={styles.powerUpBtnText}>⚙️ Settings</Text>
//           </Button3D>
//         </View>

//         {!isAdsRemoved && (
//           <Button3D style={styles.removeAdsBtn} onPress={() => navigation.navigate('Shop')}>
//             <Text style={styles.removeAdsBtnText}>Remove Ads — Open Shop</Text>
//           </Button3D>
//         )}
//       </View>

//       {showSettingsModal && (
//         <View style={styles.modalOverlay}>
//           <View style={styles.settingsCard}>
//             <Text style={styles.settingsTitle}>Settings</Text>

//             <View style={styles.settingRow}>
//               <Text style={styles.settingLabel}>Sound Effects</Text>
//               <Button3D
//                 style={soundEnabled ? styles.toggleActive : styles.toggleInactive}
//                 onPress={() => setSoundEnabled(!soundEnabled)}
//               >
//                 <Text style={styles.toggleText}>{soundEnabled ? "ON" : "OFF"}</Text>
//               </Button3D>
//             </View>

//             <View style={styles.settingRow}>
//               <Text style={styles.settingLabel}>Haptic Feedback</Text>
//               <Button3D
//                 style={hapticEnabled ? styles.toggleActive : styles.toggleInactive}
//                 onPress={() => setHapticEnabled(!hapticEnabled)}
//               >
//                 <Text style={styles.toggleText}>{hapticEnabled ? "ON" : "OFF"}</Text>
//               </Button3D>
//             </View>

//             <Button3D style={[styles.menuItemBtn, { backgroundColor: '#e1b024' }]} onPress={() => { setShowSettingsModal(false); navigation.navigate('Shop'); }}>
//               <Text style={styles.menuItemText}>👑 Open Game Shop</Text>
//             </Button3D>

//             <Button3D style={styles.menuItemBtn} onPress={() => Alert.alert("How to Play", "Slide matching number blocks into each other to add them up to reach the 2048 tile! This earns you +1 coins in reward!")}>
//               <Text style={styles.menuItemText}>📖 How to Play Tutorial</Text>
//             </Button3D>

//             <Button3D style={styles.closeSettingsBtn} onPress={() => setShowSettingsModal(false)}>
//               <Text style={styles.closeSettingsText}>Close</Text>
//             </Button3D>
//           </View>
//         </View>
//       )}

//       {showRewardedAdModal && (
//         <View style={[styles.modalOverlay, styles.adOverlayBackground]}>
//           <View style={styles.adVideoCard}>
//             <Text style={styles.adVideoBadge}>SPONSOR VIDEO AD</Text>

//             <View style={styles.adVideoScreenPlaceholder}>
//               <Text style={styles.adVideoPlayheadIcon}>🎬</Text>
//               <Text style={styles.adVideoPlaybackTitle}>MAGS Premium Network Stream</Text>
//               <Text style={styles.adVideoSubtitleText}>Do not close this window to claim reward.</Text>
//             </View>

//             <Button3D
//               style={[styles.adRewardClaimBtn, adCountdown > 0 && styles.adRewardClaimBtnDisabled]}
//               onPress={claimAdCoinReward}
//               disabled={adCountdown > 0}
//             >
//               <Text style={styles.adRewardClaimBtnText}>
//                 {adCountdown > 0 ? `⏳ Reward unlocks in ${adCountdown}s...` : '🎁 CLAIM +1 COIN'}
//               </Text>
//             </Button3D>
//           </View>
//         </View>
//       )}

//       {showInterstitialMock && showGameOverScreen && (
//         <InterstitialAdMock onClose={() => {
//           if (typeof hideInterstitialAction === 'function') {
//             hideInterstitialAction();
//           }
//           setShowInterstitialMock(false);
//         }} />
//       )}

//       {showGameOverScreen && (
//         <View style={styles.modalOverlay}>
//           <View style={styles.gameOverCard}>
//             <Text style={styles.gameOverEmoji}>🎮</Text>
//             <Text style={styles.gameOverTitle}>Game Over</Text>

//             <View style={styles.finalScoreRow}>
//               <View style={styles.finalScoreBox}>
//                 <Text style={styles.finalScoreLabel}>FINAL SCORE</Text>
//                 <Text style={styles.finalScoreValue}>{score}</Text>
//               </View>
//               <View style={[styles.finalScoreBox, styles.gameOverWalletBox]}>
//                 <Text style={styles.gameOverWalletLabel}>YOUR WALLET</Text>
//                 <Text style={styles.gameOverWalletValue}>🪙 {coins} Coins</Text>
//               </View>
//             </View>

//             {coins < 1 && (
//               <Button3D style={styles.gameOverWatchAdBtn} onPress={() => { setShowGameOverScreen(false); launchRewardedAdVideo(); }}>
//                 <Text style={styles.gameOverWatchAdBtnText}>📺 Watch Video for Free +1 Coin</Text>
//               </Button3D>
//             )}

//             <Text style={styles.gameOverHelpText}>Spend coins to purchase a lifeline power-up or restart clean:</Text>

//             <View style={styles.gameOverBtnRow}>
//               <Button3D
//                 style={[
//                   styles.gameOverBtn,
//                   styles.undoBtn,
//                   history.length === 0 && styles.disabledBtn
//                 ]}
//                 onPress={handleUndo}
//                 disabled={history.length === 0}
//               >
//                 <Text style={styles.powerUpBtnText}>
//                   ↩ Undo (1 🪙)
//                 </Text>
//               </Button3D>

//               <Button3D
//                 style={[
//                   styles.gameOverBtn,
//                   styles.deleteBtn
//                 ]}
//                 onPress={triggerGameOverDeleteMode}
//               >
//                 <Text style={styles.powerUpBtnText}>
//                   ✕ Delete (2 🪙)
//                 </Text>
//               </Button3D>
//             </View>

//             <View style={styles.gameOverBtnRow}>
//               <Button3D style={[styles.gameOverBtn, styles.homeBtn]} onPress={resetGame}>
//                 <Text style={styles.powerUpBtnText}>🔄Restart</Text>
//               </Button3D>

//               <Button3D style={[styles.gameOverBtn, styles.settingsBtn]} onPress={() => { setShowGameOverScreen(false); navigation.navigate('Home'); }}>
//                 <Text style={styles.powerUpBtnText}>🏠 Home Menu</Text>
//               </Button3D>
//             </View>
//           </View>
//         </View>
//       )}

//       <Confetti active={showConfetti} />
//       <UsernameModal visible={showNameModal} onSave={handleNameSave} />
//       <View style={styles.adWrapperBottom}>
//         {!isAdsRemoved && showAd && <BannerAdMock onFailed={() => setShowAd(false)} />}
//       </View>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: '#faf8ef', alignItems: 'center', justifyContent: 'flex-start', paddingVertical: 10, paddingTop: 60 },
//   header: { flexDirection: 'row', width: width - 40, justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
//   titleContainer: { alignItems: 'flex-start' },
//   title: { fontSize: 36, fontWeight: 'bold', color: '#776e65', lineHeight: 38 },
//   subtitle: { color: '#776e65', fontSize: 13, fontWeight: '500', opacity: 0.8 },
//   scoreBoard: { flexDirection: 'row' },
//   scoreContainer: { backgroundColor: '#bbada0', padding: 8, borderRadius: 5, alignItems: 'center', minWidth: 58, marginLeft: 4 },
//   scoreLabel: { color: '#eee4da', fontSize: 10, fontWeight: 'bold' },
//   scoreValue: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },

//   coinWalletContainer: { backgroundColor: '#e1b024', borderWidth: 1, borderColor: '#cca01d', minWidth: 68 },
//   coinLabelText: { color: '#ffffff', opacity: 0.95 },
//   coinValueText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },

//   adBanner: { flexDirection: 'row', backgroundColor: '#7c5bc4', width: width, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'space-between' },
//   adTag: { backgroundColor: 'rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: 10, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3, fontWeight: 'bold' },
//   adBannerText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
//   adCloseBtn: { paddingHorizontal: 4 },
//   adCloseText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', opacity: 0.7 },

//   grid: { width: width - 40, height: width - 40, backgroundColor: '#bbada0', borderRadius: 6, position: 'relative', overflow: 'hidden' },
//   backgroundGrid: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', flexWrap: 'wrap', padding: 5 },
//   tileContainer: { ...StyleSheet.absoluteFillObject, padding: 5 },
//   cellPlaceholder: { width: (width - 50) / 4 - 10, height: (width - 50) / 4 - 10, margin: 5, borderRadius: 5, backgroundColor: 'rgba(238, 228, 218, 0.35)' },

//   powerUpsWrapper: { width: width - 40, marginTop: 20 },
//   powerUpsTitle: { fontSize: 11, fontWeight: 'bold', color: '#bbada0', marginBottom: 6, letterSpacing: 0.5 },
//   powerUpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
//   powerUpBtn: { paddingVertical: 14, borderRadius: 6, width: '48.5%', alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 4 },
//   powerUpBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
//   coinCostBadge: { backgroundColor: 'rgba(0,0,0,0.18)', fontSize: 12, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, overflow: 'hidden', color: '#fff', fontWeight: 'bold' },

//   undoBtn: { backgroundColor: '#f9945c' },
//   deleteBtn: { backgroundColor: '#ff6b54' },
//   activeDeleteBtn: { backgroundColor: '#c43d27' },
//   homeBtn: { backgroundColor: '#8f7a66' },
//   settingsBtn: { backgroundColor: '#bbada0' },

//   disabledBtn: { backgroundColor: '#e4dbd2', opacity: 0.5 },
//   disabledBtnText: { color: '#a69a8f', textDecorationLine: 'line-through' },

//   modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.55)', justifyContent: 'center', alignItems: 'center', zIndex: 2000 },
//   adOverlayBackground: { backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 3000 },

//   settingsCard: { width: width * 0.8, backgroundColor: '#faf8ef', padding: 24, borderRadius: 10, alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
//   settingsTitle: { fontSize: 26, fontWeight: 'bold', color: '#776e65', marginBottom: 20 },
//   settingRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee4da' },
//   settingLabel: { fontSize: 16, fontWeight: '600', color: '#776e65' },
//   toggleActive: { backgroundColor: '#8f7a66', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 4 },
//   toggleInactive: { backgroundColor: '#e4dbd2', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 4 },
//   toggleText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
//   menuItemBtn: { width: '100%', paddingVertical: 14, backgroundColor: '#bbada0', borderRadius: 6, alignItems: 'center', marginTop: 16, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 4 },
//   menuItemText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
//   closeSettingsBtn: { marginTop: 24, paddingVertical: 10, width: '100%', alignItems: 'center', backgroundColor: '#f1f1f1', borderRadius: 6, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.16, shadowRadius: 4 },
//   closeSettingsText: { color: '#776e65', fontSize: 15, fontWeight: 'bold', opacity: 0.8 },

//   adVideoCard: { width: width * 0.88, backgroundColor: '#1a1a1a', borderRadius: 12, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
//   adVideoBadge: { color: '#aaa', fontSize: 10, fontWeight: 'bold', letterSpacing: 2, marginBottom: 14 },
//   adVideoScreenPlaceholder: { width: '100%', height: 180, backgroundColor: '#0b0b0b', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 20, paddingHorizontal: 20 },
//   adVideoPlayheadIcon: { fontSize: 44, marginBottom: 10 },
//   adVideoPlaybackTitle: { color: '#ffffff', fontSize: 15, fontWeight: 'bold', textAlign: 'center' },
//   adVideoSubtitleText: { color: '#666', fontSize: 12, marginTop: 4, textAlign: 'center' },
//   adRewardClaimBtn: { width: '100%', backgroundColor: '#e1b024', paddingVertical: 15, borderRadius: 6, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 4 },
//   adRewardClaimBtnDisabled: { backgroundColor: '#333' },
//   adRewardClaimBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },

//   interstitialOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#2c3e50', justifyContent: 'center', alignItems: 'center', zIndex: 4000 },
//   interstitialContainer: { width: width * 0.9, backgroundColor: '#ffffff', padding: 30, borderRadius: 16, alignItems: 'center', elevation: 20 },
//   interstitialBadge: { color: '#7f8c8d', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 15 },
//   interstitialMainIcon: { fontSize: 60, marginBottom: 15 },
//   interstitialTitle: { fontSize: 22, fontWeight: 'bold', color: '#2c3e50', textAlign: 'center', marginBottom: 8 },
//   interstitialSubtext: { fontSize: 14, color: '#95a5a6', textAlign: 'center', marginBottom: 30, paddingHorizontal: 10 },
//   interstitialCloseBtn: { width: '100%', backgroundColor: '#e74c3c', paddingVertical: 14, borderRadius: 8, alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 4 },
//   interstitialCloseBtnDisabled: { backgroundColor: '#bdc3c7' },
//   interstitialCloseText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },

//   adWrapperBottom: {
//     position: 'absolute',
//     bottom: 10,
//     width: width,
//     alignItems: 'center',
//     justifyContent: 'center',
//     backgroundColor: 'transparent'
//   },
//   removeAdsBtn: { width: width - 40, backgroundColor: '#e1b024', paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
//   removeAdsBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

//   gameOverCard: { width: width * 0.85, backgroundColor: '#faf8ef', padding: 24, borderRadius: 12, alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
//   gameOverEmoji: { fontSize: 42, marginBottom: 5 },
//   gameOverTitle: { fontSize: 32, fontWeight: 'bold', color: '#776e65', marginBottom: 15 },
//   finalScoreRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 15 },
//   finalScoreBox: { backgroundColor: '#bbada0', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center', width: '48.5%' },
//   finalScoreLabel: { color: '#eee4da', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
//   finalScoreValue: { color: '#ffffff', fontSize: 22, fontWeight: 'bold', marginTop: 2 },

//   gameOverWalletBox: { backgroundColor: '#e1b024' },
//   gameOverWalletLabel: { color: '#fffdf0', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
//   gameOverWalletValue: { color: '#ffffff', fontSize: 20, fontWeight: 'bold', marginTop: 2 },

//   gameOverWatchAdBtn: { width: '100%', backgroundColor: '#7c5bc4', paddingVertical: 12, borderRadius: 6, alignItems: 'center', marginBottom: 15, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 4 },
//   gameOverWatchAdBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },

//   gameOverHelpText: { color: '#776e65', fontSize: 13, textAlign: 'center', marginBottom: 20, opacity: 0.8, paddingHorizontal: 10 },
//   gameOverBtnRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 12 },
//   gameOverBtn: { paddingVertical: 14, borderRadius: 6, width: '48.5%', alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 4 }
// });
