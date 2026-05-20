import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Dimensions, PanResponder, Alert, TouchableOpacity, Animated } from 'react-native';
import { initializeGrid, moveGrid, isGameOver } from '../utils/gameLogic';
import { saveGameState, loadGameState, getHighScore, saveHighScore, saveUsername, getUsername, saveCoins, getCoins } from '../utils/storage';
import { submitGlobalScore } from '../utils/firebase';
import Tile from '../components/Tile';
import Confetti from '../components/Confetti';
import UsernameModal from '../components/UsernameModal';
import { useAds } from '../context/AdContext'; 

const BannerAdMock = ({ onFailed, navigation }) => (
  <TouchableOpacity style={styles.adBanner} onPress={() => navigation.navigate('Shop')}>
    <Text style={styles.adTag}>Ad Mock</Text>
    <Text style={styles.adBannerText}>Remove Ads + Daily Coins — $2.99</Text>
    <TouchableOpacity style={styles.adCloseBtn} onPress={(e) => { e.stopPropagation(); onFailed(); }}>
      <Text style={styles.adCloseText}>×</Text>
    </TouchableOpacity>
  </TouchableOpacity>
);

const InterstitialAdMock = ({ onClose }) => {
  const [countdown, setCountdown] = useState(3);
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, []);

  return (
    <View style={styles.interstitialOverlay}>
      <View style={styles.interstitialContainer}>
        <Text style={styles.interstitialBadge}>SPONSOR INTERSTITIAL AD</Text>
        <Text style={styles.interstitialMainIcon}>🎬</Text>
        <Text style={styles.interstitialTitle}>MAGS Premium Ad Network</Text>
        <Text style={styles.interstitialSubtext}>Full-screen interstitial showing at game break point.</Text>
        
        <TouchableOpacity 
          style={[styles.interstitialCloseBtn, countdown > 0 && styles.interstitialCloseBtnDisabled]}
          onPress={onClose}
          disabled={countdown > 0}
        >
          <Text style={styles.interstitialCloseText}>
            {countdown > 0 ? `Skip in ${countdown}s` : 'Close Ad ✕'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

import { logGameEvent } from '../utils/analytics';
import { 
  preloadGameAudio, 
  playSwipeSound, 
  playMergeSound, 
  playPowerUpSound, 
  playGameStateSound 
} from '../utils/audioController';

const { width } = Dimensions.get('window');
const CELL_SIZE = (width - 40) / 4;

export default function GameScreen({ navigation }) {
  const { isAdsRemoved, showInterstitial: triggerNativeInterstitial } = useAds();

  const [grid, setGrid] = useState(initializeGrid());
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [history, setHistory] = useState([]);
  const [username, setUsername] = useState(null);
  const [showNameModal, setShowNameModal] = useState(false);
  
  const [newTileCoord, setNewTileCoord] = useState(null);
  const [mergedCoords, setMergedCoords] = useState([]);
  const [showConfetti, setShowConfetti] = useState(false);

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticEnabled, setHapticEnabled] = useState(true);

  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [coins, setCoins] = useState(0);

  const [showRewardedAdModal, setShowRewardedAdModal] = useState(false);
  const [adCountdown, setAdCountdown] = useState(5);
  const adTimerRef = useRef(null);

  const [showAd, setShowAd] = useState(true);

  const [showGameOverScreen, setShowGameOverScreen] = useState(false);
  const [showInterstitial, setShowInterstitial] = useState(false);

  const scoreBounce = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const init = async () => {
      await preloadGameAudio();

      const storedCoins = await getCoins();
      if (storedCoins === null) {
        setCoins(5);
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
        setGrid(saved.grid);
        setScore(saved.score);
      } else {
        playGameStateSound('start', soundEnabled, hapticEnabled);
      }
      const high = await getHighScore();
      setHighScore(high);
      
      const storedName = await getUsername();
      setUsername(storedName);

      logGameEvent('screen_view', {
        screen_name: 'GameScreen',
        purpose: 'active_gameplay'
      });
    };
    init();

    return () => clearInterval(adTimerRef.current);
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

  const handleNameSave = async (name) => {
    await saveUsername(name);
    setUsername(name);
    setShowNameModal(false);
    await submitGlobalScore(name, score, '4x4');
  };

  const updateWalletCoins = async (newBalance) => {
    setCoins(newBalance);
    await saveCoins(newBalance);
  };

  const launchRewardedAdVideo = () => {
    setIsDeleteMode(false);
    setAdCountdown(5);
    setShowRewardedAdModal(true);

    logGameEvent('ad_request', { type: 'rewarded_video_coin' });

    adTimerRef.current = setInterval(() => {
      setAdCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(adTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const claimAdCoinReward = async () => {
    if (adCountdown > 0) return;
    
    clearInterval(adTimerRef.current);
    setShowRewardedAdModal(false);
    
    const updatedCoins = coins + 1;
    await updateWalletCoins(updatedCoins);

    logGameEvent('ad_reward_claimed', { resulting_wallet_total: updatedCoins });

    Alert.alert(
      "🪙 Reward Claimed!",
      "Thank you for watching! +1 Coin has been securely added to your layout balance.",
      [{ text: "Continue playing", style: "default" }]
    );
  };

  const resetGame = () => {
    logGameEvent('game_restart', {
      current_score_at_reset: score,
      moves_made_before_reset: history.length
    });

    playGameStateSound('start', soundEnabled, hapticEnabled);

    setNewTileCoord(null);
    setMergedCoords([]);
    setShowConfetti(false);
    setIsDeleteMode(false);
    setShowGameOverScreen(false);
    setShowInterstitial(false);

    const newGrid = initializeGrid();
    setGrid(newGrid);
    setScore(0);
    setHistory([]);
    saveGameState(newGrid, 0);
  };

  const handleMove = async (direction) => {
    if (isDeleteMode || showRewardedAdModal || showGameOverScreen || showInterstitial) return;

    const oldGrid = JSON.parse(JSON.stringify(grid));
    const result = moveGrid(grid, direction);
    
    if (result.changed) {
      setHistory(prev => [...prev, { grid: oldGrid, score }]);
      
      const nextScore = score + result.score;
      const nextGrid = result.grid;

      let newCoord = null;
      let merges = [];
      let milestoneTileFound = 0;

      // Find where the new random layout tile spawned
      nextGrid.forEach((row, r) => {
        row.forEach((cell, c) => {
          if (oldGrid[r][c] === 0 && nextGrid[r][c] !== 0) {
            newCoord = `${r}-${c}`;
          }
        });
      });

      // --- MATHEMATICAL MILESTONE CALCULATOR ---
      // We read the grid values directly to see what was formed on this move
      const oldCounts = {};
      const nextCounts = {};

      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const valOld = oldGrid[r][c];
          const valNext = nextGrid[r][c];
          if (valOld > 0) oldCounts[valOld] = (oldCounts[valOld] || 0) + 1;
          if (valNext > 0) nextCounts[valNext] = (nextCounts[valNext] || 0) + 1;
        }
      }

      // Check milestones starting from highest down to 128
      const milestonesToCheck = [2048, 1024, 512, 256, 128];
      for (let m of milestonesToCheck) {
        const currentCount = nextCounts[m] || 0;
        const previousCount = oldCounts[m] || 0;

        // If we have more of this tile value now than before the slide, one was definitely created!
        if (currentCount > previousCount) {
          milestoneTileFound = m;
          break; 
        }
      }

      // Play audio engine tracks perfectly
      if (result.score > 0) {
        playMergeSound(milestoneTileFound > 0 ? milestoneTileFound : 2, soundEnabled, hapticEnabled);
      } else {
        playSwipeSound(direction, soundEnabled, hapticEnabled);
      }

      // Process rewards if a milestone was reached
      if (milestoneTileFound >= 128) {
        const updatedCoins = coins + 1;
        await updateWalletCoins(updatedCoins);
        
        Alert.alert(
          "🪙 Milestone Earned!",
          `Amazing! You unlocked a ${milestoneTileFound} tile and earned +1 Coin! Keep it up.`,
          [{ text: "Sweet!", style: "default" }]
        );

        logGameEvent('score_milestone', {
          tile_value: milestoneTileFound,
          current_total_score: nextScore
        });

        if (milestoneTileFound >= 512) {
          setShowConfetti(false);
          setTimeout(() => setShowConfetti(true), 10);
          setTimeout(() => setShowConfetti(false), 2000);
        }
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
        logGameEvent('game_over', {
          final_score: nextScore,
          highest_score_record: Math.max(nextScore, highScore),
          total_moves_played: history.length + 1
        });

        playGameStateSound('gameover', soundEnabled, hapticEnabled);

        if (username) {
          await submitGlobalScore(username, nextScore, '4x4');
        } else {
          setShowNameModal(true);
        }

        if (isAdsRemoved) {
          setShowGameOverScreen(true);
        } else {
          logGameEvent('ad_request', { type: 'interstitial_gameover' });
          setShowInterstitial(true);
        }
      }
    }
  };

  const handleUndo = async () => {
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
    if (!isDeleteMode) return;
    if (grid[r][c] === 0) return;

    let activeTileCount = 0;
    grid.forEach(row => row.forEach(cell => { if (cell !== 0) activeTileCount++; }));

    if (activeTileCount <= 1) {
      Alert.alert("Action Blocked", "You cannot delete a tile if it is the only one remaining on the board!");
      setIsDeleteMode(false);
      return;
    }

    logGameEvent('powerup_used', {
      type: 'delete_tile',
      deleted_tile_value: grid[r][c],
      score_at_time_of_use: score
    });

    playPowerUpSound('delete', soundEnabled, hapticEnabled);

    const oldGrid = JSON.parse(JSON.stringify(grid));
    setHistory(prev => [...prev, { grid: oldGrid, score }]);

    const nextGrid = grid.map(row => [...row]);
    nextGrid[r][c] = 0;

    setNewTileCoord(null);
    setMergedCoords([]);
    setGrid(nextGrid);
    setIsDeleteMode(false);
    setShowGameOverScreen(false);
    saveGameState(nextGrid, score);

    await updateWalletCoins(coins - 2);
  };

  const toggleDeleteMode = () => {
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
          <Text style={styles.subtitle}>Join tiles to win!</Text>
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
          <TouchableOpacity 
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
            <Text style={[styles.scoreLabel, styles.coinLabelText]}>GET 🪙</Text>
            <Text style={styles.coinValueText}>🪙 {coins}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.adWrapper}>
        {!isAdsRemoved && showAd && (
          <BannerAdMock onFailed={() => setShowAd(false)} navigation={navigation} />
        )}
      </View>

      <View style={styles.grid}>
        <View style={styles.backgroundGrid}>
          {Array(16).fill(null).map((_, i) => (
            <View key={`bg-${i}`} style={styles.cellPlaceholder} />
          ))}
        </View>
        <View style={styles.tileContainer}>
          {grid.map((row, r) => row.map((cell, c) => (
            <TouchableOpacity 
              key={`tile-trigger-${r}-${c}`}
              activeOpacity={isDeleteMode ? 0.5 : 1}
              onPress={() => handleTileSelect(r, c)}
              disabled={!isDeleteMode}
              style={{ 
                position: 'absolute', 
                left: c * CELL_SIZE, 
                top: r * CELL_SIZE,
                width: CELL_SIZE,
                height: CELL_SIZE,
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              {cell !== 0 && (
                <Tile 
                  value={cell} 
                  cellSize={CELL_SIZE} 
                  isNew={newTileCoord === `${r}-${c}`} 
                  isMerged={mergedCoords.includes(`${r}-${c}`)}
                />
              )}
            </TouchableOpacity>
          )))}
        </View>
      </View>

      <View style={styles.powerUpsWrapper}>
        <Text style={styles.powerUpsTitle}>POWER-UPS</Text>
        
        <View style={styles.powerUpRow}>
          <TouchableOpacity 
            style={[
              styles.powerUpBtn, 
              styles.undoBtn, 
              history.length === 0 && styles.disabledBtn
            ]} 
            onPress={handleUndo}
            disabled={history.length === 0}
          >
            <Text style={[styles.powerUpBtnText, history.length === 0 && styles.disabledBtnText]}>
              ↩ Undo  <Text style={styles.coinCostBadge}>1 🪙</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.powerUpBtn, 
              styles.deleteBtn, 
              isDeleteMode && styles.activeDeleteBtn
            ]} 
            onPress={toggleDeleteMode}
          >
            <Text style={styles.powerUpBtnText}>
              {isDeleteMode ? "📭 Select Tile..." : "✕ Delete  "}
              {!isDeleteMode && <Text style={styles.coinCostBadge}>2 🪙</Text>}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.powerUpRow}>
          <TouchableOpacity style={[styles.powerUpBtn, styles.homeBtn]} onPress={() => {
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
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.powerUpBtn, styles.settingsBtn]}
            onPress={() => setShowSettingsModal(true)}
          >
            <Text style={styles.powerUpBtnText}>⚙️ Settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showSettingsModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.settingsCard}>
            <Text style={styles.settingsTitle}>Settings</Text>
            
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Sound Effects</Text>
              <TouchableOpacity 
                style={soundEnabled ? styles.toggleActive : styles.toggleInactive} 
                onPress={() => setSoundEnabled(!soundEnabled)}
              >
                <Text style={styles.toggleText}>{soundEnabled ? "ON" : "OFF"}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Haptic Feedback</Text>
              <TouchableOpacity 
                style={hapticEnabled ? styles.toggleActive : styles.toggleInactive} 
                onPress={() => setHapticEnabled(!hapticEnabled)}
              >
                <Text style={styles.toggleText}>{hapticEnabled ? "ON" : "OFF"}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.menuItemBtn, { backgroundColor: '#e1b024' }]} onPress={() => { setShowSettingsModal(false); navigation.navigate('Shop'); }}>
              <Text style={styles.menuItemText}>👑 Open Game Shop</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItemBtn} onPress={() => Alert.alert("How to Play", "Slide matching number blocks into each other to add them up and reach the 2048 tile!")}>
              <Text style={styles.menuItemText}>📖 How to Play Tutorial</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeSettingsBtn} onPress={() => setShowSettingsModal(false)}>
              <Text style={styles.closeSettingsText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showRewardedAdModal && (
        <View style={[styles.modalOverlay, styles.adOverlayBackground]}>
          <View style={styles.adVideoCard}>
            <Text style={styles.adVideoBadge}>SPONSOR VIDEO AD</Text>
            
            <View style={styles.adVideoScreenPlaceholder}>
              <Text style={styles.adVideoPlayheadIcon}>🎬</Text>
              <Text style={styles.adVideoPlaybackTitle}>MAGS Premium Network Stream</Text>
              <Text style={styles.adVideoSubtitleText}>Do not close this window to claim reward.</Text>
            </View>

            <TouchableOpacity 
              style={[styles.adRewardClaimBtn, adCountdown > 0 && styles.adRewardClaimBtnDisabled]}
              onPress={claimAdCoinReward}
              disabled={adCountdown > 0}
            >
              <Text style={styles.adRewardClaimBtnText}>
                {adCountdown > 0 ? `⏳ Reward unlocks in ${adCountdown}s...` : '🎁 CLAIM +1 COIN'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showInterstitial && (
        <InterstitialAdMock onClose={() => {
          setShowInterstitial(false);
          setShowGameOverScreen(true);
        }} />
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
              <TouchableOpacity style={styles.gameOverWatchAdBtn} onPress={() => { setShowGameOverScreen(false); launchRewardedAdVideo(); }}>
                <Text style={styles.gameOverWatchAdBtnText}>📺 Watch Video for Free +1 Coin</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.gameOverHelpText}>Spend coins to purchase a lifeline power-up or restart clean:</Text>

            <View style={styles.gameOverBtnRow}>
              <TouchableOpacity 
                style={[
                  styles.gameOverBtn, 
                  styles.undoBtn, 
                  history.length === 0 && styles.disabledBtn
                ]} 
                onPress={handleUndo}
                disabled={history.length === 0}
              >
                <Text style={styles.powerUpBtnText}>
                  ↩ Undo (1 🪙)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.gameOverBtn,
                  styles.deleteBtn
                ]} 
                onPress={triggerGameOverDeleteMode}
              >
                <Text style={styles.powerUpBtnText}>
                  ✕ Delete (2 🪙)
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.gameOverBtnRow}>
              <TouchableOpacity style={[styles.gameOverBtn, styles.homeBtn]} onPress={resetGame}>
                <Text style={styles.powerUpBtnText}>🔄Restart</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.gameOverBtn, styles.settingsBtn]} onPress={() => { setShowGameOverScreen(false); navigation.navigate('Home'); }}>
                <Text style={styles.powerUpBtnText}>🏠 Home Menu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <Confetti active={showConfetti} />
      <UsernameModal visible={showNameModal} onSave={handleNameSave} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf8ef', alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  header: { flexDirection: 'row', width: width - 40, justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  titleContainer: { alignItems: 'flex-start' },
  title: { fontSize: 36, fontWeight: 'bold', color: '#776e65', lineHeight: 38 },
  subtitle: { color: '#776e65', fontSize: 13, fontWeight: '500', opacity: 0.8 },
  scoreBoard: { flexDirection: 'row' },
  scoreContainer: { backgroundColor: '#bbada0', padding: 8, borderRadius: 5, alignItems: 'center', minWidth: 58, marginLeft: 4 },
  scoreLabel: { color: '#eee4da', fontSize: 10, fontWeight: 'bold' },
  scoreValue: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  
  coinWalletContainer: { backgroundColor: '#e1b024', borderWidth: 1, borderColor: '#cca01d', minWidth: 68 },
  coinLabelText: { color: '#ffffff', opacity: 0.95 },
  coinValueText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },

  adWrapper: { width: width - 40, minHeight: 50, marginVertical: 12, justifyContent: 'center', alignItems: 'center' },
  adBanner: { flexDirection: 'row', backgroundColor: '#7c5bc4', width: '100%', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'space-between' },
  adTag: { backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 10, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3, fontWeight: 'bold' },
  adBannerText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  adCloseBtn: { paddingHorizontal: 4 },
  adCloseText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', opacity: 0.7 },

  grid: { width: width - 40, height: width - 40, backgroundColor: '#bbada0', borderRadius: 6, position: 'relative', overflow: 'hidden' },
  backgroundGrid: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', flexWrap: 'wrap', padding: 5 },
  tileContainer: { ...StyleSheet.absoluteFillObject, padding: 5 },
  cellPlaceholder: { width: (width - 50) / 4 - 10, height: (width - 50) / 4 - 10, margin: 5, borderRadius: 5, backgroundColor: 'rgba(238, 228, 218, 0.35)' },

  powerUpsWrapper: { width: width - 40, marginTop: 20 },
  powerUpsTitle: { fontSize: 11, fontWeight: 'bold', color: '#bbada0', marginBottom: 6, letterSpacing: 0.5 },
  powerUpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  powerUpBtn: { paddingVertical: 14, borderRadius: 6, width: '48.5%', alignItems: 'center', justifyContent: 'center' },
  powerUpBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  coinCostBadge: { backgroundColor: 'rgba(0,0,0,0.18)', fontSize: 12, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, overflow: 'hidden', color: '#fff', fontWeight: 'bold' },
  
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
  menuItemBtn: { width: '100%', paddingVertical: 14, backgroundColor: '#bbada0', borderRadius: 6, alignItems: 'center', marginTop: 16 },
  menuItemText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  closeSettingsBtn: { marginTop: 24, paddingVertical: 10, width: '100%', alignItems: 'center' },
  closeSettingsText: { color: '#776e65', fontSize: 15, fontWeight: 'bold', opacity: 0.8 },

  adVideoCard: { width: width * 0.88, backgroundColor: '#1a1a1a', borderRadius: 12, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  adVideoBadge: { color: '#aaa', fontSize: 10, fontWeight: 'bold', letterSpacing: 2, marginBottom: 14 },
  adVideoScreenPlaceholder: { width: '100%', height: 180, backgroundColor: '#0b0b0b', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 20, paddingHorizontal: 20 },
  adVideoPlayheadIcon: { fontSize: 44, marginBottom: 10 },
  adVideoPlaybackTitle: { color: '#ffffff', fontSize: 15, fontWeight: 'bold', textAlign: 'center' },
  adVideoSubtitleText: { color: '#666', fontSize: 12, marginTop: 4, textAlign: 'center' },
  adRewardClaimBtn: { width: '100%', backgroundColor: '#e1b024', paddingVertical: 15, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  adRewardClaimBtnDisabled: { backgroundColor: '#333' },
  adRewardClaimBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },

  interstitialOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#2c3e50', justifyContent: 'center', alignItems: 'center', zIndex: 4000 },
  interstitialContainer: { width: width * 0.9, backgroundColor: '#ffffff', padding: 30, borderRadius: 16, alignItems: 'center', elevation: 20 },
  interstitialBadge: { color: '#7f8c8d', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 15 },
  interstitialMainIcon: { fontSize: 60, marginBottom: 15 },
  interstitialTitle: { fontSize: 22, fontWeight: 'bold', color: '#2c3e50', textAlign: 'center', marginBottom: 8 },
  interstitialSubtext: { fontSize: 14, color: '#95a5a6', textAlign: 'center', marginBottom: 30, paddingHorizontal: 10 },
  interstitialCloseBtn: { width: '100%', backgroundColor: '#e74c3c', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  interstitialCloseBtnDisabled: { backgroundColor: '#bdc3c7' },
  interstitialCloseText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },

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

  gameOverWatchAdBtn: { width: '100%', backgroundColor: '#7c5bc4', paddingVertical: 12, borderRadius: 6, alignItems: 'center', marginBottom: 15 },
  gameOverWatchAdBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },

  gameOverHelpText: { color: '#776e65', fontSize: 13, textAlign: 'center', marginBottom: 20, opacity: 0.8, paddingHorizontal: 10 },
  gameOverBtnRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 12 },
  gameOverBtn: { paddingVertical: 14, borderRadius: 6, width: '48.5%', alignItems: 'center', justifyContent: 'center' }
});