import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { getUsername, saveUsername } from '../utils/storage';
import { useAds } from '../context/AdContext';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const { showInterstitial } = useAds();
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const initializeUser = async () => {
      // Safely ensure local storage matches your database profile name
      await saveUsername('Sum');
      const name = await getUsername();
      setCurrentUser(name);
    };

    initializeUser();

    // Refresh username text whenever you navigate back to the Home Screen
    const unsubscribe = navigation.addListener('focus', initializeUser);
    return unsubscribe;
  }, [navigation]);

  const handlePlayPress = () => {
    showInterstitial();
    navigation.navigate('Game');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MAGS 2048</Text>
      
      {currentUser && (
        <Text style={styles.welcomeText}>Welcome back, {currentUser}!</Text>
      )}

      <TouchableOpacity 
        style={styles.button} 
        onPress={handlePlayPress}
      >
        <Text style={styles.buttonText}>PLAY GAME</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.button, styles.secondaryButton]} 
        onPress={() => navigation.navigate('Leaderboard')}
      >
        <Text style={styles.secondaryButtonText}>LEADERBOARD</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#faf8ef', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  title: { 
    fontSize: 48, 
    fontWeight: 'bold', 
    color: '#776e65', 
    marginBottom: 10 
  },
  welcomeText: {
    fontSize: 18,
    color: '#776e65',
    marginBottom: 40,
    fontWeight: '500'
  },
  button: { 
    backgroundColor: '#8f7a66', 
    paddingHorizontal: 40, 
    paddingVertical: 15, 
    borderRadius: 5,
    width: width * 0.7,
    alignItems: 'center',
    marginBottom: 15
  },
  buttonText: { 
    color: '#ffffff', 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  secondaryButton: {
    backgroundColor: '#bbada0',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold'
  }
});