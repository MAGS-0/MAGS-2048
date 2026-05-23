import React, { useRef } from 'react';
import { Animated, TouchableOpacity, View, StyleSheet } from 'react-native';

const AnimatedView = Animated.createAnimatedComponent(View);

export default function Button3D({
  onPress,
  style,
  children,
  disabled = false,
  edgeColor: customEdgeColor = null,
}) {
  const pressScale = useRef(new Animated.Value(1)).current;
  const depth = useRef(new Animated.Value(6)).current;

  const flattenedStyle = StyleSheet.flatten(style) || {};
  const {
    backgroundColor = '#8f7a66',
    borderRadius = 8,
    padding,
    paddingVertical,
    paddingHorizontal,
    paddingTop,
    paddingBottom,
    paddingLeft,
    paddingRight,
    alignItems,
    justifyContent,
    ...wrapperStyles
  } = flattenedStyle;

  const getDarkerColor = (color) => {
    if (typeof color !== 'string') return 'rgba(0,0,0,0.22)';
    if (color.startsWith('#')) {
      let hex = color.slice(1);
      if (hex.length === 3) {
        hex = hex.split('').map((c) => c + c).join('');
      }
      const num = parseInt(hex, 16);
      if (Number.isNaN(num)) return 'rgba(0,0,0,0.22)';
      const r = (num >> 16) & 0xff;
      const g = (num >> 8) & 0xff;
      const b = num & 0xff;
      const darker = (value) => Math.max(0, Math.min(255, Math.round(value * 0.55)));
      return `rgb(${darker(r)}, ${darker(g)}, ${darker(b)})`;
    }
    if (color.startsWith('rgb')) {
      const parts = color.replace(/rgba?\(|\)/g, '').split(',').map((v) => parseFloat(v.trim()));
      if (parts.length >= 3) {
        const [r, g, b, a] = parts;
        const darker = (value) => Math.max(0, Math.min(255, Math.round(value * 0.55)));
        return typeof a === 'number' ? `rgba(${darker(r)}, ${darker(g)}, ${darker(b)}, ${a})` : `rgb(${darker(r)}, ${darker(g)}, ${darker(b)})`;
      }
    }
    return 'rgba(0,0,0,0.22)';
  };

  const edgeColor = customEdgeColor || getDarkerColor(backgroundColor);

  const handlePressIn = () => {
    Animated.parallel([
      Animated.timing(pressScale, {
        toValue: 0.96,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(depth, {
        toValue: 2,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.timing(pressScale, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(depth, {
        toValue: 6,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <AnimatedView
      style={[
        styles.wrapper,
        wrapperStyles,
        { transform: [{ scale: pressScale }] },
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={1}
        style={styles.touchable}
      >
        <AnimatedView
          style={[
            styles.edge,
            {
              borderRadius,
              backgroundColor: edgeColor,
              transform: [{ translateY: depth }],
            },
          ]}
        />
        <View
          style={[
            styles.face,
            {
              borderRadius,
              backgroundColor,
              padding,
              paddingVertical,
              paddingHorizontal,
              paddingTop,
              paddingBottom,
              paddingLeft,
              paddingRight,
              alignItems,
              justifyContent,
            },
          ]}
        >
          {children}
        </View>
      </TouchableOpacity>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  touchable: {
    overflow: 'visible',
  },
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  face: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// import React, { useRef } from 'react';
// import { Animated, TouchableOpacity } from 'react-native';

// const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

// export default function Button3D({ 
//   onPress, 
//   style, 
//   children, 
//   disabled = false
// }) {
//   const scaleAnim = useRef(new Animated.Value(1)).current;
//   const translateYAnim = useRef(new Animated.Value(0)).current;

//   const handlePressIn = () => {
//     Animated.parallel([
//       Animated.timing(scaleAnim, {
//         toValue: 0.92,
//         duration: 80,
//         useNativeDriver: true,
//       }),
//       Animated.timing(translateYAnim, {
//         toValue: 4,
//         duration: 80,
//         useNativeDriver: true,
//       }),
//     ]).start();
//   };

//   const handlePressOut = () => {
//     Animated.parallel([
//       Animated.timing(scaleAnim, {
//         toValue: 1,
//         duration: 120,
//         useNativeDriver: true,
//       }),
//       Animated.timing(translateYAnim, {
//         toValue: 0,
//         duration: 120,
//         useNativeDriver: true,
//       }),
//     ]).start();
//   };

//   return (
//     <AnimatedTouchableOpacity
//       onPress={onPress}
//       onPressIn={handlePressIn}
//       onPressOut={handlePressOut}
//       disabled={disabled}
//       activeOpacity={1}
//       style={[
//         style,
//         {
//           transform: [
//             { scale: scaleAnim },
//             { translateY: translateYAnim },
//           ],
//         },
//       ]}
//     >
//       {children}
//     </AnimatedTouchableOpacity>
//   );
// }
