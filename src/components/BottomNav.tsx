import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface BottomNavProps {
  /** Visible only at the very top of the screen (Zomato-style). */
  atTop: boolean;
  /** Count badge on the Crave pill; hidden when 0. */
  activeOrderCount?: number;
  /** Crave pill tap → Active Orders. */
  onActiveOrders?: () => void;
  /** false → Flix pill greyed out (system suspended). */
  flixEnabled?: boolean;
  /** Open Flix (only when enabled). */
  onFlix?: () => void;
  /** Tapped Flix while suspended → show the "suspended" toast. */
  onFlixSuspended?: () => void;
}

const GREEN = '#00B14F';
const PURPLE = '#7C4DFF';
const ORANGE = '#E8501C';

/**
 * Floating bottom overlay on the Crave (home) page — two edge-bound pills:
 *   • left pill  — "Crave" (green), flush to the left edge; tapping opens
 *                  Active Orders (with a live count badge)
 *   • right pill — "Flix" (purple), flush to the right edge
 *
 * Both show only at the very top: once the list scrolls the Crave pill slides
 * LEFT and the Flix pill slides RIGHT off-screen, returning only at the top.
 */
export const BottomNav: React.FC<BottomNavProps> = ({
  atTop,
  activeOrderCount = 0,
  onActiveOrders,
  flixEnabled = true,
  onFlix,
  onFlixSuspended,
}) => {
  const insets = useSafeAreaInsets();
  // Sit clear of the system nav bar (3-button nav has a tall bottom inset;
  // gesture nav ~0). A hardcoded bottom overlapped the nav buttons on some phones.
  const bottomInset = insets.bottom + 14;
  const hide = useRef(new Animated.Value(atTop ? 0 : 1)).current; // 0 shown, 1 hidden

  useEffect(() => {
    Animated.spring(hide, {
      toValue: atTop ? 0 : 1,
      useNativeDriver: true,
      friction: 10,
      tension: 65,
    }).start();
  }, [atTop]);

  const leftX = hide.interpolate({ inputRange: [0, 1], outputRange: [0, -180] });
  const rightX = hide.interpolate({ inputRange: [0, 1], outputRange: [0, 170] });
  const fade = hide.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  const hasActive = activeOrderCount > 0;

  return (
    <>
      {/* Left pill: Crave — bound to the left screen edge, opens Active Orders */}
      <Animated.View
        style={[
          styles.leftWrap,
          { bottom: bottomInset, opacity: fade, transform: [{ translateX: leftX }] },
        ]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={styles.cravePill}
          onPress={onActiveOrders}
          activeOpacity={0.85}
          testID="bottomnav-crave"
        >
          <MaterialIcons name="restaurant-menu" size={20} color="#FFFFFF" />
          <Text style={styles.craveLabel}>Crave</Text>
          {hasActive && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {activeOrderCount > 9 ? '9+' : activeOrderCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Right pill: Flix — bound to the right screen edge */}
      <Animated.View
        style={[
          styles.rightWrap,
          { bottom: bottomInset, opacity: fade, transform: [{ translateX: rightX }] },
        ]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={[styles.flixPill, !flixEnabled && styles.flixPillSuspended]}
          onPress={() => (flixEnabled ? onFlix?.() : onFlixSuspended?.())}
          activeOpacity={0.85}
          testID="bottomnav-flix"
        >
          <MaterialIcons
            name="play-circle-filled"
            size={20}
            color={flixEnabled ? '#FFFFFF' : '#D0D0D0'}
          />
          <Text style={[styles.flixLabel, !flixEnabled && styles.flixLabelSuspended]}>
            Flix
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  // Bound to the left edge: flush left, rounded only on the right.
  // `bottom` is set inline from the safe-area inset.
  leftWrap: { position: 'absolute', left: 0 },
  cravePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: GREEN,
    borderTopRightRadius: 26,
    borderBottomRightRadius: 26,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    paddingLeft: 18,
    paddingRight: 18,
    paddingVertical: 11,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 9,
  },
  craveLabel: {
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: 0.3,
    color: '#FFFFFF',
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginLeft: 2,
  },
  badgeText: {
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 11,
    color: '#FFFFFF',
  },
  // Bound to the right edge: flush right, rounded only on the left.
  // `bottom` is set inline from the safe-area inset.
  rightWrap: { position: 'absolute', right: 0 },
  flixPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: PURPLE,
    borderTopLeftRadius: 26,
    borderBottomLeftRadius: 26,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    paddingLeft: 18,
    paddingRight: 18,
    paddingVertical: 11,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 9,
  },
  flixPillSuspended: { backgroundColor: '#4A4A4A' },
  flixLabel: {
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: 0.3,
    color: '#FFFFFF',
  },
  flixLabelSuspended: { color: '#D0D0D0' },
});
