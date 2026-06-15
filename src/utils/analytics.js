export const logGameEvent = async (eventName, params = {}) => {
  try {
    // Safe attempt for native Firebase Analytics (Standalone/Dev Client only)
    try {
      const analytics = require('@react-native-firebase/analytics').default;
      const instance = analytics();
      if (instance) {
        await instance.logEvent(eventName, params);
      }
    } catch (e) {
      // Native module not found (e.g. standard Expo Go), skip silently
    }

    // 2. Beautiful terminal logging fallback during local development testing
    if (__DEV__) {
      console.log(`[📊 ANALYTICS LOGGED] Event: "${eventName}"`, JSON.stringify(params));
    }
  } catch (error) {
    console.warn('[📊 ANALYTICS ERROR] Failed to transfer event payload:', error);
  }
};



//test build code - not used in production
// import { Platform } from 'react-native';

// // Safely require the package only if available
// let FirebaseAnalytics = null;
// try {
//   FirebaseAnalytics = require('expo-firebase-analytics').default;
// } catch (e) {
//   // Gracefully fail silently if the module is completely unlinked
// }

// export const logGameEvent = async (eventName, params = {}) => {
//   try {
//     // Check if we are running in a real standalone native environment with Firebase linked
//     if (FirebaseAnalytics && typeof FirebaseAnalytics.logEvent === 'function') {
//       await FirebaseAnalytics.logEvent(eventName, params);
//     } else {
//       // Fallback: Log beautifully to your terminal during development in Expo Go
//       console.log(`[📊 ANALYTICS MOCK] Event: "${eventName}"`, JSON.stringify(params));
//     }
//   } catch (error) {
//     console.warn('[📊 ANALYTICS ERROR] Failed to log event:', error);
//   }
// };