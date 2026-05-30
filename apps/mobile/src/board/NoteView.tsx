import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { objectText, type BoardObjectBase } from '../types';

const WORLD = 6000;

export function NoteView({
  object,
  scale,
  onMove,
  onPress,
}: {
  object: BoardObjectBase;
  scale: SharedValue<number>;
  onMove: (id: string, x: number, y: number) => void;
  onPress: (id: string) => void;
}) {
  const ox = useSharedValue(0);
  const oy = useSharedValue(0);
  const px = object.position.x;
  const py = object.position.y;

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      ox.value = e.translationX / scale.value;
      oy.value = e.translationY / scale.value;
    })
    .onEnd(() => {
      runOnJS(onMove)(object.id, px + ox.value, py + oy.value);
      ox.value = 0;
      oy.value = 0;
    });

  const tap = Gesture.Tap()
    .maxDistance(10)
    .onEnd(() => runOnJS(onPress)(object.id));

  const gesture = Gesture.Race(pan, tap);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: ox.value }, { translateY: oy.value }],
  }));

  const bg = (object.style?.background as string) ?? '#fde68a';
  const isText = object.type === 'text';

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.note,
          {
            left: px + WORLD / 2,
            top: py + WORLD / 2,
            width: object.size.width,
            height: object.size.height,
            backgroundColor: isText ? 'transparent' : bg,
          },
          animStyle,
        ]}
      >
        <Text
          style={[styles.text, isText && styles.textHeading]}
          numberOfLines={isText ? 2 : 8}
        >
          {objectText(object) || '—'}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}

export { WORLD };

const styles = StyleSheet.create({
  note: {
    position: 'absolute',
    borderRadius: 10,
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  text: { color: '#111827', fontSize: 14 },
  textHeading: { color: '#e5e7eb', fontSize: 18, fontWeight: '700' },
});
