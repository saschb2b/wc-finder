import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, PanResponder, StyleSheet, View, TouchableOpacity } from "react-native";
import { t } from "../i18n";
import { useThemedStyles, type Colors } from "../theme";

export interface BottomSheetHandle { snapTo: (index: number) => void }

interface BottomSheetProps {
  /** Visible heights in px, ascending (peek, half, full). */
  snapPoints: number[];
  /** Rendered above the sheet surface, over the map; moves with the sheet. */
  overlay?: ReactNode;
  /** Drag surface: handle + always-visible summary. */
  header: ReactNode;
  children?: ReactNode;
  onIndexChange?: (index: number) => void;
}

/**
 * Persistent, draggable sheet built on Animated + PanResponder only, so it runs
 * in Expo Go without reanimated. The drag gesture lives on the header; the body
 * keeps normal scrolling.
 */
export const BottomSheet = forwardRef<BottomSheetHandle, BottomSheetProps>(function BottomSheet(
  { snapPoints, overlay, header, children, onIndexChange }, ref,
) {
  const styles = useThemedStyles(makeStyles);
  const maxHeight = snapPoints[snapPoints.length - 1];
  const minHeight = snapPoints[0];
  const [index, setIndex] = useState(0);
  const translateY = useRef(new Animated.Value(maxHeight - minHeight)).current;
  const offset = useRef(maxHeight - minHeight);
  const dragStart = useRef(0);

  const animateTo = useCallback((i: number) => {
    const target = Math.max(0, maxHeight - snapPoints[i]);
    offset.current = target;
    setIndex(i);
    onIndexChange?.(i);
    Animated.spring(translateY, { toValue: target, useNativeDriver: true, damping: 24, stiffness: 220, mass: 0.8 }).start();
  }, [maxHeight, snapPoints, translateY, onIndexChange]);

  // Re-settle when snap points change (rotation, insets, measured header).
  const previous = useRef(snapPoints.join(","));
  if (previous.current !== snapPoints.join(",")) {
    previous.current = snapPoints.join(",");
    const target = Math.max(0, maxHeight - snapPoints[index]);
    offset.current = target;
    translateY.setValue(target);
  }

  useImperativeHandle(ref, () => ({ snapTo: animateTo }), [animateTo]);

  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderGrant: () => { dragStart.current = offset.current; },
    onPanResponderMove: (_, g) => {
      translateY.setValue(Math.min(maxHeight - minHeight, Math.max(0, dragStart.current + g.dy)));
    },
    onPanResponderRelease: (_, g) => {
      const height = maxHeight - (dragStart.current + g.dy);
      let target: number;
      if (g.vy < -0.4) target = Math.min(snapPoints.length - 1, snapPoints.findIndex(p => p > height + 1));
      else if (g.vy > 0.4) target = Math.max(0, snapPoints.findLastIndex(p => p < height - 1));
      else target = snapPoints.reduce((best, p, i) => Math.abs(p - height) < Math.abs(snapPoints[best] - height) ? i : best, 0);
      animateTo(target < 0 ? snapPoints.length - 1 : target);
    },
    onPanResponderTerminate: () => animateTo(index),
  }), [maxHeight, minHeight, snapPoints, translateY, animateTo, index]);

  const expanded = index > 0;
  return (
    <Animated.View style={[styles.container, { height: maxHeight, transform: [{ translateY }] }]} pointerEvents="box-none">
      {overlay}
      <View style={styles.surface}>
        <View {...pan.panHandlers}>
          <TouchableOpacity
            style={styles.handleArea}
            onPress={() => animateTo(expanded ? 0 : 1)}
            accessibilityRole="button"
            accessibilityLabel={expanded ? t("sheet.collapse") : t("sheet.expand")}
            accessibilityState={{ expanded }}
          >
            <View style={styles.handle} />
          </TouchableOpacity>
          {header}
        </View>
        <View style={styles.body}>{children}</View>
      </View>
    </Animated.View>
  );
});

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { position: "absolute", left: 0, right: 0, bottom: 0 },
  surface: {
    flex: 1,
    backgroundColor: c.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: c.shadowOpacity,
    shadowRadius: 6,
    elevation: 8,
  },
  handleArea: { alignItems: "center", paddingVertical: 10 },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: c.handle },
  body: { flex: 1 },
});
