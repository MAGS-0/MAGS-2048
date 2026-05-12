import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { useAds } from '../context/AdContext';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const { showInterstitial } = useAds();

  const handlePlayPress = () => {
    // Show the ad (currently logs to terminal)
    showInterstitial();
    // Navigate to the Game
    navigation.navigate('Game');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MAGS 2048</Text>
      
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
    marginBottom: 50 
  },
  button: { 
    backgroundColor: '#8f7a66', 
    paddingHorizontal: 40, 
    paddingVertical: 15, 
    borderRadius: 5, 
    width: width * 0.7, 
    alignItems: 'center',
    marginBottom: 20 
  },
  buttonText: { 
    color: '#ffffff', 
    fontSize: 20, 
    fontWeight: 'bold' 
  },
  secondaryButton: { 
    backgroundColor: '#bbada0' 
  },
  secondaryButtonText: { 
    color: '#ffffff', 
    fontSize: 18, 
    fontWeight: 'bold' 
  }
});