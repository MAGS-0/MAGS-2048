import React from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';

const { width } = Dimensions.get('window');

// 1. Safe Mock Banner for Expo Go testing
export const BannerAdMock = ({ onFailed }) => {
  return (
    <View style={styles.adBanner}>
      <Text style={styles.adTag}>Ad Mock</Text>
      <Text style={styles.adBannerText}>Remove Ads — $2.99</Text>
      <TouchableOpacity style={styles.adCloseBtn} onPress={onFailed}>
        <Text style={styles.adCloseText}>×</Text>
      </TouchableOpacity>
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
  adBanner: { flexDirection: 'row', backgroundColor: '#7c5bc4', width: width - 40, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'space-between' },
  adTag: { backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 10, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3, fontWeight: 'bold' },
  adBannerText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  adCloseBtn: { paddingHorizontal: 4 },
  adCloseText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', opacity: 0.7 }
});