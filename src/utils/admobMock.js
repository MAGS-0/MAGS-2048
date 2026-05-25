import React from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';

const { width } = Dimensions.get('window');

// 1. Safe Mock Banner for Expo Go testing
export const BannerAdMock = ({ onFailed }) => {
  return (
    <View style={styles.adBanner} pointerEvents="none">
      <View style={styles.adInner}>
        <Text style={styles.adTag}>Test Ad</Text>
        <Text style={styles.adBannerText}>AdMob Banner — ca-app-pub-3940256099942544/6300978111</Text>
      </View>
    </View>
  );
};

// 2. Safe definitions so the rest of the app doesn't crash
export const BannerAdSize = {
  ANCHORED_AD_ADAPTIVE: 'ANCHORED_AD_ADAPTIVE'
};

export const TestIds = {
  BANNER: 'ca-app-pub-3940256099942544/6300978111'
};

const styles = StyleSheet.create({
  adBanner: { width: width, backgroundColor: '#f2f2f2', paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  adInner: { width: width - 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' },
  adTag: { backgroundColor: '#dcdcdc', color: '#333', fontSize: 11, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, fontWeight: '700', marginRight: 8 },
  adBannerText: { color: '#333', fontWeight: '600', fontSize: 13 },
});