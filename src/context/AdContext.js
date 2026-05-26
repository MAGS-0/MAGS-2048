import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const AdContext = createContext();

let InterstitialAd = null;
let AdEventType = null;
let TestIds = null;

try {
  // Replace mocks with real library components
  const Ads = require('react-native-google-mobile-ads');
  InterstitialAd = Ads.InterstitialAd;
  AdEventType = Ads.AdEventType;
  TestIds = Ads.TestIds;
  // Optional: Add request configuration here
  // Ads.default.initialize();
} catch (e) {
  console.log("Ads library not accessible in current bundler mode.");
}

export const AdProvider = ({ children }) => {
  const [interstitial, setInterstitial] = useState(null);
  const [loaded, setLoaded] = useState(false);
  
  // --- NEW STATE TO TRACK PREMIUM AD-FREE STATUS ---
  const [adsRemoved, setAdsRemoved] = useState(false);

  useEffect(() => {
    // Load the user's premium purchase status when the app boots up
    const loadPremiumStatus = async () => {
      try {
        const value = await AsyncStorage.getItem('mags_2048_ads_removed');
        if (value === 'true') {
          setAdsRemoved(true);
        }
      } catch (e) {
        console.log("Failed to look up local ad premium storage flags:", e);
      }
    };
    loadPremiumStatus();

    if (InterstitialAd && TestIds) {
      // PRODUCTION: Replace TestIds.INTERSTITIAL with your actual Ad Unit ID from AdMob
      // const AD_UNIT_ID = Platform.select({ ios: 'your-ios-id', android: 'your-android-id' });
      
      const adInstance = InterstitialAd.createForAdRequest(TestIds.INTERSTITIAL);
      
      const unsubscribeLoaded = adInstance.addAdEventListener(AdEventType.LOADED, () => {
        setLoaded(true);
      });

      const unsubscribeClosed = adInstance.addAdEventListener(AdEventType.CLOSED, () => {
        setLoaded(false);
        adInstance.load(); // Preload next ad
      });

      adInstance.load();
      setInterstitial(adInstance);

      return () => {
        unsubscribeLoaded();
        unsubscribeClosed();
      };
    }
  }, []);

  // --- NEW FUNCTION TO SET AND SAVE PREMIUM PURCHASE TIER ---
  const setAdsRemovedStatus = async (status) => {
    try {
      setAdsRemoved(status);
      await AsyncStorage.setItem('mags_2048_ads_removed', status ? 'true' : 'false');
    } catch (e) {
      console.log("Failed to save ad premium status flag:", e);
    }
  };

  const isInterstitialReady = () => {
    return !!loaded && !!interstitial;
  };

  const showInterstitial = () => {
    // If user purchased "Remove Ads", immediately block the ad from showing
    if (adsRemoved) {
      console.log("Premium Active: Interstitial blocked.");
      return false;
    }

    if (loaded && interstitial) {
      interstitial.show();
      return true;
    }

    console.log("Ad not loaded or running in an unsupported Expo Go environment.");
    return false;
  };

  return (
    <AdContext.Provider value={{ showInterstitial, isInterstitialReady, adsRemoved, setAdsRemovedStatus }}>
      {children}
    </AdContext.Provider>
  );
};

export const useAds = () => useContext(AdContext);