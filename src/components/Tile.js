import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

export default function Tile({ value, cellSize }) {
  // Animation values
  const scaleValue = useRef(new Animated.Value(0)).current; // For the "Pop" entry
  const pulseValue = useRef(new Animated.Value(1)).current; // For the "Merge"

  useEffect(() => {
    if (value !== 0) {
      // 1. Entry Animation: Scale from 0 to 1
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }).start();

      // 2. Merge Animation: If the tile value just changed/merged, pulse it
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1.15,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleValue.setValue(0);
    }
  }, [value]);

  const getTileStyle = (val) => {
    const colors = {
      2: '#eee4da', 4: '#ede0c8', 8: '#f2b179', 16: '#f59563',
      32: '#f67c5f', 64: '#f65e3b', 128: '#edcf72', 256: '#edcc61',
      512: '#edc850', 1024: '#edc53f', 2048: '#edc22e'
    };
    return { 
      backgroundColor: colors[val] || '#3c3a32',
      width: cellSize - 10,
      height: cellSize - 10,
    };
  };

  if (value === 0) return null;

  return (
    <Animated.View style={[
      styles.tile, 
      getTileStyle(value),
      { transform: [{ scale: scaleValue }, { scale: pulseValue }] }
    ]}>
      <Text style={[styles.tileText, { color: value <= 4 ? '#776e65' : '#f9f6f2' }]}>
        {value}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    margin: 5,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute', // Allows for smoother layout transitions
  },
  tileText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});