import React, { createContext, useContext, useEffect, useState } from 'react';
import { InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';

const AdContext = createContext();

// Using Google's official Test ID for development
const adUnitId = TestIds.INTERSTITIAL;

export const AdProvider = ({ children }) => {
  const [adLoaded, setAdLoaded] = useState(false);
  const [interstitial, setInterstitial] = useState(null);

  const loadAd = () => {
    const newAd = InterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    newAd.addAdEventListener(AdEventType.LOADED, () => {
      setAdLoaded(true);
    });

    newAd.addAdEventListener(AdEventType.CLOSED, () => {
      setAdLoaded(false);
      loadAd(); // Pre-load the next ad immediately after one is closed
    });

    newAd.load();
    setInterstitial(newAd);
  };

  useEffect(() => {
    loadAd();
  }, []);

  const showInterstitial = () => {
    if (adLoaded && interstitial) {
      interstitial.show();
    } else {
      console.log('Ad not ready yet');
    }
  };

  return (
    <AdContext.Provider value={{ showInterstitial, adLoaded }}>
      {children}
    </AdContext.Provider>
  );
};

export const useAds = () => useContext(AdContext);