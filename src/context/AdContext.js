import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';

// We try to import the real ads, but catch the error if we are in Expo Go
let InterstitialAd, AdEventType, TestIds;
try {
  const AdModule = require('react-native-google-mobile-ads');
  InterstitialAd = AdModule.InterstitialAd;
  AdEventType = AdModule.AdEventType;
  TestIds = AdModule.TestIds;
} catch (e) {
  console.log("Running in Expo Go: Native Ad Module not available.");
}

const AdContext = createContext();

export const AdProvider = ({ children }) => {
  const [adLoaded, setAdLoaded] = useState(false);
  const [interstitial, setInterstitial] = useState(null);

  useEffect(() => {
    // Only try to load if the module exists
    if (InterstitialAd) {
      const adUnitId = TestIds.INTERSTITIAL;
      const newAd = InterstitialAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
      });

      newAd.addAdEventListener(AdEventType.LOADED, () => setAdLoaded(true));
      newAd.addAdEventListener(AdEventType.CLOSED, () => {
        setAdLoaded(false);
        newAd.load(); 
      });

      newAd.load();
      setInterstitial(newAd);
    }
  }, []);

  const showInterstitial = () => {
    if (InterstitialAd && adLoaded && interstitial) {
      interstitial.show();
    } else {
      // In Expo Go, we show a simple alert instead of a crash
      console.log('Ad Triggered (Development Mode)');
      // Optional: Alert.alert("Ad Simulation", "An interstitial ad would show here in the final build.");
    }
  };

  return (
    <AdContext.Provider value={{ showInterstitial, adLoaded }}>
      {children}
    </AdContext.Provider>
  );
};

export const useAds = () => useContext(AdContext);