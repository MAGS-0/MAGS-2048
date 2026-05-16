import React, { createContext, useContext, useEffect, useState } from 'react';

const AdContext = createContext();

let InterstitialAd = null;
let AdEventType = null;
let TestIds = null;

try {
  const Ads = require('react-native-google-mobile-ads');
  InterstitialAd = Ads.InterstitialAd;
  AdEventType = Ads.AdEventType;
  TestIds = Ads.TestIds;
} catch (e) {
  console.log("Ads library not accessible in current bundler mode.");
}

export const AdProvider = ({ children }) => {
  const [interstitial, setInterstitial] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (InterstitialAd && TestIds) {
      // Uses standard Google Test ID to prevent build bans or failures
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

  const showInterstitial = () => {
    if (loaded && interstitial) {
      interstitial.show();
    } else {
      console.log("Ad note loaded or running in an unsupported Expo Go environment.");
    }
  };

  return (
    <AdContext.Provider value={{ showInterstitial }}>
      {children}
    </AdContext.Provider>
  );
};

export const useAds = () => useContext(AdContext);