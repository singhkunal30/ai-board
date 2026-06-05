import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';
import { NoteView, WORLD } from './NoteView';
import { colors } from '../theme';
import type { BoardEdge, BoardObjectBase } from '../types';

/**
 * Native infinite-ish canvas: one-finger drag on empty space pans, two-finger
 * pinch zooms, and notes are individually draggable. The "world" is a large
 * fixed surface with board (0,0) at its centre.
 */
export function Canvas({
  objects,
  edges,
  onMove,
  onPressNote,
}: {
  objects: BoardObjectBase[];
  edges: BoardEdge[];
  onMove: (id: string, x: number, y: number) => void;
  onPressNote: (id: string) => void;
}) {
  const byId = new Map(objects.map((o) => [o.id, o]));
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  // Pan/zoom transform of the world.
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const centered = useSharedValue(false);

  // Centre board (0,0) in the viewport once we know its size.
  const onLayout = (w: number, h: number) => {
    setViewport({ w, h });
    if (!centered.value) {
      tx.value = w / 2 - WORLD / 2;
      ty.value = h / 2 - WORLD / 2;
      centered.value = true;
    }
  };

  const bgPan = Gesture.Pan()
    .onStart(() => {
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = startX.value + e.translationX;
      ty.value = startY.value + e.translationY;
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((e) => {
      const next = startScale.value * e.scale;
      scale.value = Math.min(Math.max(next, 0.25), 3);
    });

  const worldStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={pinch}>
      <View
        style={styles.viewport}
        onLayout={(e) => onLayout(e.nativeEvent.layout.width, e.nativeEvent.layout.height)}
      >
        <Animated.View style={[styles.world, worldStyle]}>
          {/* Background catcher: one-finger pan over empty space pans the canvas. */}
          <GestureDetector gesture={bgPan}>
            <View style={styles.background} />
          </GestureDetector>

          {/* Connectors between linked objects. */}
          <Svg style={StyleSheet.absoluteFill} width={WORLD} height={WORLD} pointerEvents="none">
            {edges.map((e) => {
              const s = byId.get(e.source);
              const t = byId.get(e.target);
              if (!s || !t) return null;
              return (
                <Line
                  key={e.id}
                  x1={s.position.x + WORLD / 2 + s.size.width / 2}
                  y1={s.position.y + WORLD / 2 + s.size.height / 2}
                  x2={t.position.x + WORLD / 2 + t.size.width / 2}
                  y2={t.position.y + WORLD / 2 + t.size.height / 2}
                  stroke="#64748b"
                  strokeWidth={2}
                />
              );
            })}
          </Svg>

          {[...objects]
            .sort((a, b) => a.zIndex - b.zIndex)
            .map((obj) => (
              <NoteView
                key={obj.id}
                object={obj}
                scale={scale}
                onMove={onMove}
                onPress={onPressNote}
              />
            ))}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden', backgroundColor: colors.bg },
  world: { width: WORLD, height: WORLD },
  background: {
    position: 'absolute',
    width: WORLD,
    height: WORLD,
    // Subtle grid-ish surface.
    backgroundColor: '#0d1322',
  },
});
