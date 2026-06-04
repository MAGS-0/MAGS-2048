import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  RewardedAd, 
  RewardedAdEventType, 
  InterstitialAd, 
  AdEventType, 
  TestIds,
  BannerAd,
  BannerAdSize
} from 'react-native-google-mobile-ads';

const AdContext = createContext();

export const AdProvider = ({ children }) => {
  const [startInterstitial, setStartInterstitial] = useState(null);
  const [startInterstitialLoaded, setStartInterstitialLoaded] = useState(false);
  const [gameOverInterstitial, setGameOverInterstitial] = useState(null);
  const [gameOverInterstitialLoaded, setGameOverInterstitialLoaded] = useState(false);
  const [rewarded, setRewarded] = useState(null);
  const [rewardedLoaded, setRewardedLoaded] = useState(false);
  
  const rewardedCallbackRef = useRef(null);
  
  // --- NEW STATE TO TRACK PREMIUM AD-FREE STATUS ---
  const [adsRemoved, setAdsRemoved] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Load the user's premium purchase status when the app boots up
    const loadPremiumStatus = async () => {
      try {
        const value = await AsyncStorage.getItem('mags_2048_ads_removed');
        if (isMounted && value === 'true') {
          setAdsRemoved(true);
        }
      } catch (e) {
        console.log("Failed to look up local ad premium storage flags:", e);
      }
    };
    loadPremiumStatus();

    loadStartInterstitial();
    loadGameOverInterstitial();
    loadRewarded();

    return () => {
      isMounted = false;
    };
  }, []);

  const loadStartInterstitial = () => {
    // Replace TestIds.INTERSTITIAL with your real Ad Unit ID string from AdMob
    const ad = InterstitialAd.createForAdRequest(__DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-2731691947572564/8838213469');
    ad.addAdEventListener(AdEventType.LOADED, () => setStartInterstitialLoaded(true));
    ad.addAdEventListener(AdEventType.CLOSED, () => {
      setStartInterstitialLoaded(false);
      loadStartInterstitial();
    });
    ad.load();
    setStartInterstitial(ad);
  };

  const loadGameOverInterstitial = () => {
    // Using the Game End Interstitial Ad Unit ID
    const ad = InterstitialAd.createForAdRequest(__DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-2731691947572564/5445763363');
    ad.addAdEventListener(AdEventType.LOADED, () => setGameOverInterstitialLoaded(true));
    ad.addAdEventListener(AdEventType.CLOSED, () => {
      setGameOverInterstitialLoaded(false);
      loadGameOverInterstitial();
    });
    ad.load();
    setGameOverInterstitial(ad);
  };

  const loadRewarded = () => {
    // Replace TestIds.REWARDED with your real Rewarded Ad Unit ID string from AdMob
    const ad = RewardedAd.createForAdRequest(__DEV__ ? TestIds.REWARDED : 'ca-app-pub-2731691947572564/7853636567');
    ad.addAdEventListener(RewardedAdEventType.LOADED, () => setRewardedLoaded(true));
    ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward) => {
      if (rewardedCallbackRef.current) {
        rewardedCallbackRef.current(reward);
        rewardedCallbackRef.current = null;
      }
    });
    ad.addAdEventListener(AdEventType.CLOSED, () => {
      setRewardedLoaded(false);
      loadRewarded();
    });
    ad.load();
    setRewarded(ad);
  };

  // --- NEW FUNCTION TO SET AND SAVE PREMIUM PURCHASE TIER ---
  const setAdsRemovedStatus = async (status) => {
    try {
      setAdsRemoved(status);
      await AsyncStorage.setItem('mags_2048_ads_removed', status ? 'true' : 'false');
    } catch (e) {
      console.log("Failed to save ad premium status flag:", e);
    }
  };

  const isStartInterstitialReady = () => {
    return !!startInterstitialLoaded;
  };

  const isGameOverInterstitialReady = () => {
    return !!gameOverInterstitialLoaded;
  };

  const showStartInterstitial = () => {
    // If user purchased "Remove Ads", immediately block the ad from showing
    if (adsRemoved) {
      return false;
    }

    if (startInterstitialLoaded && startInterstitial) {
      startInterstitial.show();
      return true;
    }
    return false;
  };

  const showGameOverInterstitial = () => {
    if (adsRemoved) {
      return false;
    }

    if (gameOverInterstitialLoaded && gameOverInterstitial) {
      gameOverInterstitial.show();
      return true;
    }
    return false;
  };

  const showRewardedAd = (callback) => {
    if (rewardedLoaded && rewarded) {
      rewardedCallbackRef.current = callback;
      rewarded.show();
      return true;
    }
    return false;
  };

  return (
    <AdContext.Provider value={{ 
      showStartInterstitial,
      isStartInterstitialReady,
      showGameOverInterstitial,
      isGameOverInterstitialReady,
      adsRemoved, 
      setAdsRemovedStatus,
      showRewardedAd,
      rewardedLoaded 
    }}>
      {children}
    </AdContext.Provider>
  );
};

export const useAds = () => useContext(AdContext);

export { BannerAd, BannerAdSize, TestIds };