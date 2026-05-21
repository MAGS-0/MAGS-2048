import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

export default function Tile({ value, cellSize, isNew, isMerged, r, c }) {
  // 1. Setup clean scale animation nodes
  const scaleValue = useRef(new Animated.Value(isNew ? 0 : 1)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;
  
  // 2. Setup sliding position tracking nodes (X and Y offsets)
  const positionAnimated = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  // Track previous grid positions and values to calculate relative movement path
  const prevRowRef = useRef(r);
  const prevColRef = useRef(c);
  const previousValueRef = useRef(value);

  useEffect(() => {
    if (value !== 0) {
      // --- SLIDING MOTION LOGIC ---
      // If the row or column changed, calculate the distance moved and slide smoothly
      if (prevRowRef.current !== r || prevColRef.current !== c) {
        // Calculate the starting offset from the previous position relative to the new position
        const initialX = (prevColRef.current - c) * cellSize;
        const initialY = (prevRowRef.current - r) * cellSize;
        
        // Immediately place the tile at that starting offset position
        positionAnimated.setValue({ x: initialX, y: initialY });
        
        // Smoothly animate the offset back to 0 (the final destination slot)
        Animated.timing(positionAnimated, {
          toValue: { x: 0, y: 0 },
          duration: 150,
          useNativeDriver: true,
        }).start();
      }

      // --- SPAWNING ANIMATION ---
      if (isNew) {
        scaleValue.setValue(0);
        Animated.timing(scaleValue, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }).start();
      }

      // --- MERGING ANIMATION ---
      const valueIncreased = previousValueRef.current !== 0 && value > previousValueRef.current;
      if (isMerged || valueIncreased) {
        pulseValue.setValue(1.25);
        Animated.timing(pulseValue, {
          toValue: 1.00,
          duration: 140,
          useNativeDriver: true,
        }).start();
      }
    }
    
    // Save current states so they serve as the "previous" point during the next move
    prevRowRef.current = r;
    prevColRef.current = c;
    previousValueRef.current = value;
  }, [value, isNew, isMerged, r, c, cellSize]);

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

  const tileStyle = getTileStyle(value);
  const textStyle = getTextStyle(value);

  // Combine sliding positions (translateX, translateY) and scaling sizes together safely
  const combinedTransform = [
    { translateX: positionAnimated.x },
    { translateY: positionAnimated.y },
    { scale: scaleValue },
    { scale: pulseValue }
  ];

  return (
    <Animated.View style={[styles.tile, tileStyle, { transform: combinedTransform }]}>
      <Text style={[styles.text, textStyle]}>
        {value}
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
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1.5,
    elevation: 2,
  },
  text: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
});