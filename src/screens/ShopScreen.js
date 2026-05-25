import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Button3D from '../components/Button3D';
import { useAds } from '../context/AdContext';
import { BannerAdMock } from '../utils/admobMock';
import { getCoins, saveCoins } from '../utils/storage';
import { logGameEvent } from '../utils/analytics';

const { width } = Dimensions.get('window');

export default function ShopScreen({ navigation }) {
  // CRITICAL FIX: Changed from isAdsRemoved to align exactly with your context state tracking property
  const { adsRemoved, setAdsRemovedStatus } = useAds();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [showAd, setShowAd] = useState(true);

  const handlePurchase = async () => {
    if (adsRemoved) {
      Alert.alert("Already Active", "You already own the Premium Bundle! Thank you for supporting MAGS 2048.");
      return;
    }

    setIsPurchasing(true);
    logGameEvent('iap_initiated', { product_id: 'com.mags2048.remove_ads_daily_coins' });

    setTimeout(async () => {
      try {
        // 1. Persist the state globally inside the global state tree context
        await setAdsRemovedStatus(true);
        
        // 2. CRITICAL LINK: Back up to persistent storage so the HomeScreen focus hook can read it instantly
        await AsyncStorage.setItem('mags_2048_ads_removed', 'true');

        const currentCoins = await getCoins() || 0;
        const newCoinBalance = currentCoins + 10;
        await saveCoins(newCoinBalance);

        logGameEvent('iap_success', { product_id: 'com.mags2048.remove_ads_daily_coins', new_balance: newCoinBalance });
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        setIsPurchasing(false);

        Alert.alert(
          "🎉 Purchase Successful!",
          "Thank you! Ads are now permanently removed, and +10 Coins have been safely deposited into your game wallet.",
          [{ text: "Awesome!", onPress: () => navigation.goBack() }]
        );
      } catch (error) {
        setIsPurchasing(false);
        Alert.alert("Transaction Failed", "Could not process mock payment. Please try again.");
      }
    }, 1500);
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Button3D onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="close" size={30} color="#776e65" />
          </Button3D>
          <Text style={styles.headerTitle}>GAME SHOP</Text>
          <View style={{ width: 30 }} />
        </View>

        <View style={styles.content}>
          <Text style={styles.shopIntro}>Upgrade your gameplay experience with premium features:</Text>

          <View style={[styles.productCard, adsRemoved && styles.purchasedCard]}>
            <View style={styles.badgeRow}>
              <Text style={styles.cardBadge}>{adsRemoved ? "ACTIVE TIER" : "BEST VALUE"}</Text>
            </View>
            
            <Text style={styles.productEmoji}>👑</Text>
            <Text style={styles.productTitle}>MAGS Premium Bundle</Text>
            <Text style={styles.productPrice}>{adsRemoved ? "Purchased" : "$2.99 Lifetime"}</Text>

            <View style={styles.featuresList}>
              <View style={styles.featureRow}>
                <Text style={styles.featureCheck}>✓</Text>
                <Text style={styles.featureText}>No Involuntary Interstitials</Text>
              </View>
              <View style={styles.featureRow}>
                <Text style={styles.featureCheck}>✓</Text>
                <Text style={styles.featureText}>Remove Bottom Banner Ads</Text>
              </View>
              <View style={styles.featureRow}>
                <Text style={styles.featureCheck}>✓</Text>
                <Text style={styles.featureText}>+10 Coins Included Instantly</Text>
              </View>
              <View style={styles.featureRow}>
                <Text style={styles.featureCheck}>✓</Text>
                <Text style={styles.featureText}>Support Solo Game Development</Text>
              </View>
            </View>

            <Button3D 
              style={[styles.buyButton, adsRemoved && styles.disabledBuyButton]} 
              onPress={handlePurchase}
              disabled={isPurchasing || adsRemoved}
            >
              {isPurchasing ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buyButtonText}>
                  {adsRemoved ? "PREMIUM UNLOCKED" : "UPGRADE NOW"}
                </Text>
              )}
            </Button3D>
          </View>

          <Text style={styles.footerLegal}>
            Purchases simulate real app store endpoints safely within this build phase.
          </Text>
        </View>
        <View style={styles.adWrapper}>
          {!adsRemoved && showAd && (
            <BannerAdMock onFailed={() => setShowAd(false)} />
          )}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf8ef' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#776e65' },
  backButton: { padding: 4, backgroundColor: '#ffffff', borderRadius: 8, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.16, shadowRadius: 3 },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 20 },
  shopIntro: { fontSize: 15, color: '#776e65', textAlign: 'center', marginBottom: 30, opacity: 0.9, lineHeight: 22 },
  
  productCard: { width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 2, borderColor: '#eee4da', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  purchasedCard: { borderColor: '#e1b024', backgroundColor: '#fffdf0' },
  badgeRow: { position: 'absolute', top: -12, backgroundColor: '#e1b024', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, borderWidth: 2, borderColor: '#faf8ef' },
  cardBadge: { color: '#fff', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 },
  
  productEmoji: { fontSize: 56, marginTop: 10, marginBottom: 10 },
  productTitle: { fontSize: 22, fontWeight: 'bold', color: '#776e65', marginBottom: 6 },
  productPrice: { fontSize: 18, fontWeight: 'bold', color: '#8f7a66', marginBottom: 24 },
  
  featuresList: { width: '100%', marginBottom: 30, paddingHorizontal: 10 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  featureCheck: { color: '#e1b024', fontWeight: 'bold', fontSize: 18, marginRight: 12 },
  featureText: { color: '#776e65', fontSize: 14, fontWeight: '500' },
  
  buyButton: { width: '100%', backgroundColor: '#8f7a66', paddingVertical: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 4 },
  disabledBuyButton: { backgroundColor: '#bbada0' },
  buyButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
  footerLegal: { fontSize: 11, color: '#bbada0', textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
  adWrapper: { width: width, minHeight: 50, marginVertical: 12, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 0 },
});