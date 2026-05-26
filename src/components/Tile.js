import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

export default function Tile({ value, cellSize, isNew, isMerged, slideDuration = 150 }) {
  // 1. Setup clean scale animation nodes
  const scaleValue = useRef(new Animated.Value(isNew ? 0 : 1)).current;
  const pulseValue = useRef(new Animated.Value(1)).current; // This will be used for merge animation

  // Internal state to delay the value change until the slide completes
  const [displayValue, setDisplayValue] = useState(value);

  // Persistent refs to track if animations for this specific state have already fired
  const lastPulsedValue = useRef(null);
  const hasSpawned = useRef(false);

  useEffect(() => {
    if (value !== 0) {
      // --- VALUE TRANSITION LOGIC ---
      // If merging, wait for the slide to finish before changing the number visually
      if (isMerged && value !== displayValue) {
        setTimeout(() => {
          setDisplayValue(value);
        }, slideDuration);
      } else {
        setDisplayValue(value);
      }

      // --- SPAWNING ANIMATION ---
      if (isNew && !hasSpawned.current) {
        scaleValue.setValue(0);
        hasSpawned.current = true;
        Animated.timing(scaleValue, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }).start();
      }

      // --- MERGING ANIMATION ---
      // Only pulse if isMerged is true AND we haven't pulsed for this specific value increase yet
      if (isMerged && value > (lastPulsedValue.current || 0)) {
        lastPulsedValue.current = value;
        // Delay the pulse until the tile has actually "arrived" and value has flipped
        setTimeout(() => {
          pulseValue.setValue(1.25);
          Animated.timing(pulseValue, {
            toValue: 1.00,
            duration: 140,
            useNativeDriver: true,
          }).start();
        }, slideDuration);
      }
    }
  }, [value, isNew, isMerged, slideDuration]);

  const getTileStyle = (val) => {
    const colors = {
      2: '#eee4da',
      4: '#ede0c8',
      8: '#f2b179',
      16: '#f59563',
      32: '#f67c5f',
      64: '#f65e3b',
      128: '#edcf72',
      256: '#edcc61',
      512: '#edc850',
      1024: '#edc53f',
      2048: '#edc22e',
    };
    return {
      backgroundColor: colors[val] || '#3c3a32',
      width: cellSize - 10,
      height: cellSize - 10,
    };
  };

  const getTextStyle = (val) => {
    return {
      color: val <= 4 ? '#776e65' : '#f9f6f2',
      fontSize: val > 100 ? cellSize * 0.25 : cellSize * 0.30,
    };
  };

  if (value === 0 || value === null) return null;

  const tileStyle = getTileStyle(displayValue);
  const textStyle = getTextStyle(displayValue);

  const combinedTransform = [
    { scale: scaleValue },
    { scale: pulseValue }
  ];

  return (
    <Animated.View style={[styles.tile, tileStyle, { transform: combinedTransform }]}>
      <Text style={[styles.text, textStyle]}>
        {displayValue}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 5,
  },
  text: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
});