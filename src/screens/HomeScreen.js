import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, Alert, Animated, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUsername, getUserAvatar, getCoins, saveCoins } from '../utils/storage';
import UsernameModal from '../components/UsernameModal';
import Button3D from '../components/Button3D';
import { useAds } from '../context/AdContext';
import { fetchRemoteBaseCoins } from '../utils/firebase';

const { width, height } = Dimensions.get('window');

const AVATAR_SOURCES = {
  avatar_1: require('../assets/avatar1.png'),
  avatar_2: require('../assets/avatar2.png'),
  avatar_3: require('../assets/avatar3.png'),
  avatar_4: require('../assets/avatar4.png'),
  avatar_5: require('../assets/avatar5.png'),
  avatar_6: require('../assets/avatar6.png'),
  avatar_7: require('../assets/avatar7.png'),
  avatar_8: require('../assets/avatar8.png'),
  avatar_9: require('../assets/avatar9.png'),
  avatar_10: require('../assets/avatar10.png'),
  avatar_11: require('../assets/avatar11.png'),
  avatar_12: require('../assets/avatar12.png'),
  avatar_13: require('../assets/avatar13.png'),
  avatar_14: require('../assets/avatar14.png'),
  avatar_15: require('../assets/avatar15.png'),
};

export default function HomeScreen({ navigation }) {
  // Destructure adsRemoved instead of missing parameters to match AdContext
  const { showInterstitial, setAdsRemovedStatus, adsRemoved } = useAds();
  const [currentUser, setCurrentUser] = useState(null);
  const [currentAvatar, setCurrentAvatar] = useState('avatar_1');
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  // Local state to track if the premium pack has been purchased
  const [isPremiumUser, setIsPremiumUser] = useState(false);
  
  // --- WALLET INVENTORY ACCUMULATOR ---
  const [walletCoins, setWalletCoins] = useState(0);
  
  // --- ADVANCED CALENDAR STREAK LOGIC STATES ---
  const [isRewardClaimed, setIsRewardClaimed] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(1);
  const [baseCoinAmount, setBaseCoinAmount] = useState(1);
  const [countdownText, setCountdownText] = useState('');
  const [showRewardAdModal, setShowRewardAdModal] = useState(false);
  const [adCountdown, setAdCountdown] = useState(5);
  
  // --- NATIVE ANIMATION INTERPOLATION CHANNELS ---
  const coinFlyAnimY = useRef(new Animated.Value(0)).current;
  const coinFlyAnimX = useRef(new Animated.Value(0)).current; 
  const coinFlyAnimOpacity = useRef(new Animated.Value(0)).current;
  const walletScaleAnim = useRef(new Animated.Value(1)).current;

  const countdownTimerRef = useRef(null);
  const adTimerRef = useRef(null);

  useEffect(() => {
    const initializeDashboard = async () => {
      const name = await getUsername();
      setCurrentUser(name);

      const avatarId = await getUserAvatar();
      setCurrentAvatar(avatarId);

      const totalCoins = await getCoins() || 0;
      setWalletCoins(totalCoins);

      const remoteCoins = await fetchRemoteBaseCoins();
      setBaseCoinAmount(remoteCoins);

      // Check storage directly for premium/no-ads configuration
      const adsRemovedValue = await AsyncStorage.getItem('mags_2048_ads_removed');
      setIsPremiumUser(adsRemovedValue === 'true' || adsRemoved === true);

      await evaluateProgressiveStreakRules();
    };

    initializeDashboard();
    const unsubscribe = navigation.addListener('focus', initializeDashboard);
    
    return () => {
      unsubscribe();
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (adTimerRef.current) clearInterval(adTimerRef.current);
    };
  }, [navigation, adsRemoved]);

  // --- ENGINE CORE: STREAK EVALUATION ---
  const evaluateProgressiveStreakRules = async () => {
    try {
      const lastClaimedTimestamp = await AsyncStorage.getItem('mags_2048_last_daily_claim');
      const savedStreakStr = await AsyncStorage.getItem('mags_2048_daily_streak_count');
      
      let streak = savedStreakStr ? parseInt(savedStreakStr, 10) : 1;
      if (streak > 7) streak = 1;

      if (!lastClaimedTimestamp) {
        setCurrentStreak(1);
        setIsRewardClaimed(false);
        return;
      }

      const now = new Date();
      const lastClaimDate = new Date(parseInt(lastClaimedTimestamp, 10));

      const isSameDay = 
        lastClaimDate.getDate() === now.getDate() &&
        lastClaimDate.getMonth() === now.getMonth() &&
        lastClaimDate.getFullYear() === now.getFullYear();

      if (isSameDay) {
        setCurrentStreak(streak);
        setIsRewardClaimed(true);
        startMidnightCountdown();
        return;
      }

      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      
      const isYesterday = 
        lastClaimDate.getDate() === yesterday.getDate() &&
        lastClaimDate.getMonth() === yesterday.getMonth() &&
        lastClaimDate.getFullYear() === yesterday.getFullYear();

      if (isYesterday) {
        setCurrentStreak(streak);
        setIsRewardClaimed(false);
      } else {
        setCurrentStreak(1);
        await AsyncStorage.setItem('mags_2048_daily_streak_count', '1');
        setIsRewardClaimed(false);
      }
    } catch (e) {
      console.log(e);
    }
  };

  const handleProfileSave = (name, avatarId) => {
    if (name) setCurrentUser(name);
    if (avatarId) setCurrentAvatar(avatarId);
    setShowProfileModal(false);
  };

  const calculateRewardPayout = (streakValue) => {
    if (streakValue >= 7) return baseCoinAmount * 5; 
    if (streakValue >= 5) return baseCoinAmount * 2; 
    return baseCoinAmount; 
  };

  const startMidnightCountdown = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    const updateTimer = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);

      const difference = midnight - now;
      if (difference <= 0) {
        clearInterval(countdownTimerRef.current);
        setIsRewardClaimed(false);
        setCountdownText('');
        evaluateProgressiveStreakRules();
        return;
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setCountdownText(
        `${hours < 10 ? '0' : ''}${hours}h ${minutes < 10 ? '0' : ''}${minutes}m ${seconds < 10 ? '0' : ''}${seconds}s`
      );
    };

    updateTimer();
    countdownTimerRef.current = setInterval(updateTimer, 1000);
  };

  // --- TRIGGER CALIBRATED DIAGONAL FLYING ANIMATION ---
  const triggerCoinEarningAnimation = () => {
    coinFlyAnimY.setValue(0);
    coinFlyAnimX.setValue(0); 
    coinFlyAnimOpacity.setValue(1);

    Animated.parallel([
      Animated.timing(coinFlyAnimY, {
        toValue: -height * 0.27,
        duration: 850,
        useNativeDriver: true,
      }),
      Animated.timing(coinFlyAnimX, {
        toValue: width * 0.36,
        duration: 850,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(700),
        Animated.timing(coinFlyAnimOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        })
      ])
    ]).start(async () => {
      Animated.sequence([
        Animated.timing(walletScaleAnim, { toValue: 1.25, duration: 90, useNativeDriver: true }),
        Animated.timing(walletScaleAnim, { toValue: 1.0, duration: 110, useNativeDriver: true })
      ]).start();

      const currentWallet = await getCoins() || 0;
      setWalletCoins(currentWallet);
    });
  };

  const commitRewardToWallet = async (isDoubled) => {
    try {
      const baselineReward = calculateRewardPayout(currentStreak);
      const finalCoinPayout = isDoubled ? baselineReward * 2 : baselineReward;

      const walletBalance = await getCoins() || 0;
      const newBalance = walletBalance + finalCoinPayout;
      await saveCoins(newBalance);

      await AsyncStorage.setItem('mags_2048_last_daily_claim', Date.now().toString());
      
      let nextStreak = currentStreak + 1;
      if (nextStreak > 7) nextStreak = 1; 
      await AsyncStorage.setItem('mags_2048_daily_streak_count', nextStreak.toString());
      setCurrentStreak(nextStreak);

      setIsRewardClaimed(true);
      startMidnightCountdown();

      triggerCoinEarningAnimation();

    } catch (e) {
      Alert.alert("Transaction Error", "Could not write coin reward balance.");
    }
  };

  const launchRewardedAdDoubleFlow = () => {
    setAdCountdown(5);
    setShowRewardAdModal(true);

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

  const claimDoubleAdReward = async () => {
    if (adCountdown > 0) return;
    clearInterval(adTimerRef.current);
    setShowRewardAdModal(false);
    await commitRewardToWallet(true); 
  };

  const handlePlayPress = () => {
    showInterstitial();
    navigation.navigate('Game');
  };

  const handleDevReset = async () => {
    try {
      await setAdsRemovedStatus(false);
      await AsyncStorage.removeItem('mags_2048_coins');
      await AsyncStorage.removeItem('@mags_2048_username');
      await AsyncStorage.removeItem('@mags_2048_user_avatar');
      await AsyncStorage.removeItem('mags_2048_last_daily_claim');
      await AsyncStorage.removeItem('mags_2048_daily_streak_count');
      await AsyncStorage.removeItem('mags_2048_ads_removed');
      
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (adTimerRef.current) clearInterval(adTimerRef.current);
      
      setIsRewardClaimed(false);
      setCurrentStreak(1);
      setWalletCoins(0);
      setCurrentUser(null);
      setCurrentAvatar('avatar_1');
      setCountdownText('');
      setIsPremiumUser(false);
      
      Alert.alert("🛠️ Test Ecosystem Reset", "All parameters flushed cleanly.");
    } catch (e) {
      console.log(e);
    }
  };

  const immediateClaimValue = calculateRewardPayout(currentStreak);

  // Dynamic key attached to component ensures forceful component re-mount/render when premium state updates
  return (
    <View style={styles.container} key={`home-view-premium-render-${isPremiumUser || adsRemoved}`}>
      
      <View style={styles.topHeaderControlBar}>
        <View style={styles.brandingNode}>
          <Text style={styles.headerTitleBrand}>MAGS 2048</Text>
          <View style={styles.profileHeaderRow}>
            <TouchableOpacity style={styles.profileAvatarWrapper} onPress={() => setShowProfileModal(true)} activeOpacity={0.8}>
              <Image
                source={AVATAR_SOURCES[currentAvatar] || AVATAR_SOURCES.avatar_1}
                style={styles.profileAvatar}
              />
            </TouchableOpacity>
            <View style={styles.profileTextBlock}>
              {currentUser ? (
                <Text style={styles.welcomeSubtitle}>Welcome back! 👋 {currentUser}</Text>
              ) : (
                <Text style={styles.welcomeSubtitle}>Welcome, Player! 🎮</Text>
              )}
              <Text style={styles.profileHintText}>Tap avatar to edit</Text>
            </View>
          </View>
        </View>

        <Animated.View style={[styles.walletStatusPill, { transform: [{ scale: walletScaleAnim }] }]}>
          <Text style={styles.walletTokenSymbol}>🪙</Text>
          <Text style={styles.walletBalanceText}>{walletCoins}</Text>
        </Animated.View>
      </View>

      <View style={styles.calendarCard}>
        <View style={styles.calendarHeaderRow}>
          <Text style={styles.calendarCardTitle}>📆 DAILY CALENDAR</Text>
          <Text style={styles.streakBadgeText}>DAY {currentStreak} STREAK</Text>
        </View>

        <View style={styles.dotsRowContainer}>
          {[1, 2, 3, 4, 5, 6, 7].map((dayIndex) => {
            const isCurrent = dayIndex === currentStreak;
            const isPast = dayIndex < currentStreak;
            
            let dotStyle = styles.futureDot;
            if (isCurrent) dotStyle = styles.activeDot;
            if (isPast || (isRewardClaimed && isCurrent)) dotStyle = styles.completedDot;

            let labelSymbol = `+${calculateRewardPayout(dayIndex)}`;
            if (dayIndex === 7) labelSymbol = "👑🔥";

            return (
              <View key={`calendar-dot-node-${dayIndex}`} style={styles.dotNodeColumn}>
                <View style={[styles.baseDotLayout, dotStyle]}>
                  <Text style={[styles.dotLabelValue, isCurrent && styles.activeDotText]}>
                    {isPast || (isRewardClaimed && isCurrent) ? "✓" : labelSymbol}
                  </Text>
                </View>
                <Text style={styles.dotSubTextLabel}>D{dayIndex}</Text>
              </View>
            );
          })}
        </View>

        {isRewardClaimed ? (
          <View style={styles.claimedFeedbackWrapper}>
            <Text style={styles.claimedMainText}>✓ BONUS CLAIMED TODAY</Text>
            <Text style={styles.claimedTimeSubText}>Next gift drops in: {countdownText}</Text>
          </View>
        ) : (
          <View style={styles.actionButtonsStack}>
            <Button3D style={[styles.primaryClaimBtn, styles.elevated, { backgroundColor: '#e76f51' }]}
            edgeColor="#ab523c"
            onPress={() => commitRewardToWallet(false)}>
              <Text style={styles.primaryClaimBtnText}>
                Claim Single (+{immediateClaimValue} 🪙)
              </Text>
            </Button3D>

            <Button3D style={[styles.adClaimBtn, styles.elevated, { backgroundColor: '#44bd7e' }]}
            edgeColor="#2d7c53"
            onPress={launchRewardedAdDoubleFlow}>
              <Text style={styles.adClaimBtnText}>
                🎬 DOUBLE REWARD (+{immediateClaimValue * 2} 🪙)
              </Text>
            </Button3D>
          </View>
        )}

        <Animated.View 
          style={[
            styles.floatingAnimatedCoinItem, 
            { 
              opacity: coinFlyAnimOpacity,
              transform: [
                { translateY: coinFlyAnimY },
                { translateX: coinFlyAnimX }
              ] 
            }
          ]}
        >
          <Text style={{ fontSize: 32 }}>🪙</Text>
        </Animated.View>
      </View>

      {/* --- ACTION INTERFACE NAVIGATION CONTROLS --- */}
      <View style={styles.navigationMenuBlock}>
        <Button3D style={[styles.primaryMenuBtn, { backgroundColor: '#f2a968' }]}
        edgeColor="#f27c14"
        onPress={handlePlayPress}>
          <Text style={styles.primaryMenuBtnText}>🕹 Start Active Match</Text>
        </Button3D>

        <Button3D style={[styles.primaryMenuBtn, styles.secondaryMenuBtn, { backgroundColor: '#58b7d4' }]}
        edgeColor="#448ba0"
        onPress={() => navigation.navigate('Leaderboard')}>
          <Text style={styles.secondaryMenuBtnText}>🏆 Global Leaderboards</Text>
        </Button3D>

        {/* Condition evaluates cleanly using direct context flag to hide button */}
        {!isPremiumUser && !adsRemoved && (
          <Button3D style={[styles.primaryMenuBtn, styles.secondaryMenuBtn, { backgroundColor: '#edc22e' }]}
          edgeColor="#c09403"
          onPress={() => navigation.navigate('Shop')}>
            <Text style={styles.secondaryMenuBtnText}>👑 Coin Store & Upgrades</Text>
          </Button3D>
        )}

        <Button3D style={[styles.devResetButton, styles.elevated]} onPress={handleDevReset}>
          <Text style={styles.devResetText}>⚠️ CLEAR ALL DATA (NEW USER TEST)</Text>
        </Button3D>
      </View>

      <UsernameModal
        visible={showProfileModal}
        onSave={handleProfileSave}
        initialName={currentUser || ''}
        initialAvatar={currentAvatar}
      />

      {showRewardAdModal && (
        <View style={styles.adOverlayContainer}>
          <View style={styles.adVideoBoxCard}>
            <Text style={styles.adVideoBadge}>SPONSOR AD MULTIPLIER</Text>
            <View style={styles.videoContentBox}>
              <Text style={styles.videoPlayerEmoji}>🎬</Text>
              <Text style={styles.videoMainTitle}>MAGS Ad Engine Stream</Text>
              <Text style={styles.videoSubTitle}>Watch this promo to unlock 2x reward coins!</Text>
            </View>
            <TouchableOpacity 
              style={[styles.claimAdBtn, adCountdown > 0 && styles.claimAdBtnDisabled]}
              onPress={claimDoubleAdReward}
              disabled={adCountdown > 0}
            >
              <Text style={styles.claimAdText}>
                {adCountdown > 0 ? `⏳ Multiplier unlocks in ${adCountdown}s...` : '🎁 DOUBLE MY COINS NOW'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf8ef', alignItems: 'center', justifyContent: 'flex-start', paddingTop: height * 0.08 },
  topHeaderControlBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: width * 0.9, marginBottom: height * 0.04, paddingHorizontal: 4 },
  brandingNode: { alignItems: 'flex-start' },
  headerTitleBrand: { fontSize: 32, fontWeight: 'bold', color: '#776e65' },
  welcomeSubtitle: { fontSize: 13, color: '#a39485', fontWeight: '500', marginTop: 2 },
  walletStatusPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#bbada0', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#fff' },
  walletTokenSymbol: { fontSize: 16, marginRight: 6 },
  walletBalanceText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  profileHeaderRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  profileAvatarWrapper: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden', marginRight: 12, backgroundColor: '#eee4da', borderWidth: 1, borderColor: '#dcd1c4' },
  profileAvatar: { width: '100%', height: '100%' },
  profileTextBlock: { flexShrink: 1 },
  profileHintText: { fontSize: 10, color: '#b2a189', marginTop: 2 },

  calendarCard: { position: 'relative', width: width * 0.9, backgroundColor: '#eee4da', padding: 18, borderRadius: 12, marginBottom: 25, borderWidth: 1, borderColor: '#dcd1c4', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3 },  calendarHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(119,110,101,0.12)', paddingBottom: 8 },
  calendarCardTitle: { fontSize: 11, fontWeight: 'bold', color: '#776e65', letterSpacing: 0.3 },
  streakBadgeText: { fontSize: 10, fontWeight: 'bold', backgroundColor: '#8f7a66', color: '#fff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  
  dotsRowContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 20 },
  dotNodeColumn: { alignItems: 'center', flex: 1 },
  baseDotLayout: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#dcd1c4' },
  futureDot: { backgroundColor: '#faf8ef' },
  activeDot: { backgroundColor: '#e1b024', borderWidth: 2, borderColor: '#ffffff' },
  completedDot: { backgroundColor: '#bbada0' },
  dotLabelValue: { fontSize: 10, fontWeight: 'bold', color: '#776e65' },
  activeDotText: { color: '#ffffff', fontSize: 11 },
  dotSubTextLabel: { fontSize: 9, fontWeight: 'bold', color: '#a39485', marginTop: 4 },

  claimedFeedbackWrapper: { alignItems: 'center', paddingVertical: 8 },
  claimedMainText: { color: '#a39485', fontWeight: 'bold', fontSize: 14, letterSpacing: 0.5 },
  claimedTimeSubText: { color: '#776e65', fontSize: 11, marginTop: 4, fontWeight: '500' },

  actionButtonsStack: { width: '100%' },
  primaryClaimBtn: { backgroundColor: '#bbada0', paddingVertical: 10, borderRadius: 6, alignItems: 'center', marginBottom: 8 },
  primaryClaimBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  adClaimBtn: { backgroundColor: '#e1b024', paddingVertical: 12, borderRadius: 6, alignItems: 'center', borderWidth: 1, borderColor: '#cca01d' },
  adClaimBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14, letterSpacing: 0.2 },

  floatingAnimatedCoinItem: { position: 'absolute', bottom: 40, left: '44%', zIndex: 999 },

  navigationMenuBlock: { width: width * 0.9, alignItems: 'center' },
  primaryMenuBtn: { width: '100%', backgroundColor: '#f9945c', paddingVertical: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2 },
  primaryMenuBtnText: { color: '#ffffff', fontSize: 17, fontWeight: 'bold' },
  secondaryMenuBtn: { backgroundColor: '#bbada0' },
  secondaryMenuBtnText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },

  devResetButton: { width: '100%', marginTop: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#e74c3c', borderRadius: 6, backgroundColor: 'rgba(231, 76, 60, 0.03)', alignItems: 'center', justifyContent: 'center' },
  devResetText: { color: '#e74c3c', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },

  elevated: { elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 3 },

  adOverlayContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  adVideoBoxCard: { width: width * 0.85, backgroundColor: '#1a1a1a', padding: 20, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  adVideoBadge: { color: '#888', fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 12 },
  videoContentBox: { width: '100%', height: 150, backgroundColor: '#000', borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  videoPlayerEmoji: { fontSize: 40, marginBottom: 8 },
  videoMainTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  videoSubTitle: { color: '#666', fontSize: 11, marginTop: 4, textAlign: 'center', paddingHorizontal: 15 },
  claimAdBtn: { width: '100%', backgroundColor: '#e1b024', paddingVertical: 14, borderRadius: 6, alignItems: 'center' },
  claimAdBtnDisabled: { backgroundColor: '#333' },
  claimAdText: { color: '#fff', fontWeight: 'bold', fontSize: 14 }
});