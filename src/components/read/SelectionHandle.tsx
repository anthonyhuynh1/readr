import React, { useRef } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { theme } from '../../constants/theme';

interface SelectionHandleProps {
  type: 'start' | 'end';
  onDragStart?: () => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd?: () => void;
}

/**
 * Custom drag handle for text selection (mimics native iOS/Kindle text selection handles).
 * Renders an absolute positioned hit area with a visible line and dot.
 */
export function SelectionHandle({
  type,
  onDragStart,
  onDragMove,
  onDragEnd,
}: SelectionHandleProps) {
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => onDragStart?.(),
      onPanResponderMove: (e) => onDragMove(e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderRelease: () => onDragEnd?.(),
      onPanResponderTerminate: () => onDragEnd?.(),
    }),
  ).current;

  return (
    <View
      {...panResponder.panHandlers}
      style={[
        styles.handleArea,
        type === 'start' ? styles.startArea : styles.endArea,
      ]}
    >
      <View style={styles.line} />
      <View
        style={[
          styles.dot,
          type === 'start' ? styles.dotTop : styles.dotBottom,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  handleArea: {
    position: 'absolute',
    top: -8,
    bottom: -8,
    width: 32, // wide enough to easily grab
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startArea: {
    left: -16, // center line on the left edge of the word
  },
  endArea: {
    right: -16, // center line on the right edge of the word
  },
  line: {
    width: 2,
    height: '60%',
    backgroundColor: theme.colors.brandOrange,
  },
  dot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.brandOrange,
  },
  dotTop: {
    top: '15%',
  },
  dotBottom: {
    bottom: '15%',
  },
});
