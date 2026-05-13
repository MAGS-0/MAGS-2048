import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

const Particle = ({ color }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    }).start();
  }, []);

  // Randomize directions
  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, (Math.random() - 0.5) * width],
  });

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, (Math.random() - 0.5) * height],
  });

  const opacity = animatedValue.interpolate({
    inputRange: [0, 0.8, 1],
    outputRange: [1, 1, 0],
  });

  const rotate = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${Math.random() * 360}deg`],
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          backgroundColor: color,
          transform: [{ translateX }, { translateY }, { rotate }],
          opacity,
        },
      ]}
    />
  );
};

export default function Confetti({ active }) {
  if (!active) return null;

  const colors = ['#f2b179', '#f59563', '#f67c5f', '#f65e3b', '#edcf72'];
  const particles = Array.from({ length: 20 });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.container}>
        {particles.map((_, i) => (
          <Particle key={i} color={colors[i % colors.length]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    width: 10,
    height: 10,
    position: 'absolute',
  },
});