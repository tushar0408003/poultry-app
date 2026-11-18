import { useIsFocused } from '@react-navigation/native';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, RefreshControl, ScrollView, ScrollViewInstance, StyleSheet, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

/** Space kept between the focused input and the keyboard, so its error/hint text stays visible too. */
const REVEAL_MARGIN = 72;

const RevealContext = createContext<() => void>(() => {});

/** Scrolls the focused input above the keyboard. Called by `Input` on focus; a no-op outside `Screen`. */
export const useRevealFocusedInput = () => useContext(RevealContext);

/**
 * Scrollable screen body with optional pull-to-refresh and keyboard handling.
 * Expo apps are edge-to-edge on Android, so the window does not resize for the keyboard:
 * we pad the content by the keyboard height and scroll the focused input into view ourselves.
 */
export function Screen({
  children,
  onRefresh,
  refreshing = false,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const { bottom } = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollY = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const reveal = useCallback(() => {
    // Wait a moment so the extra bottom padding is laid out before we scroll.
    setTimeout(() => {
      const top = keyboardTop.current;
      const input = TextInput.State.currentlyFocusedInput();
      if (top === null || !input) return;
      input.measureInWindow((_x, y, _w, height) => {
        const overlap = y + height + REVEAL_MARGIN - top;
        if (overlap > 0) scrollRef.current?.scrollTo({ y: scrollY.current + overlap, animated: true });
      });
    }, 60);
  }, []);

  useEffect(() => {
    // Tabs keep other screens mounted; only the visible one should react to the keyboard.
    if (!isFocused) return;
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      keyboardTop.current = e.endCoordinates.screenY;
      setKeyboardHeight(e.endCoordinates.height);
      reveal();
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      keyboardTop.current = null;
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [isFocused, reveal]);

  return (
    <RevealContext.Provider value={reveal}>
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: styles.content.paddingBottom + (keyboardHeight || bottom) }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onScroll={(e) => {
          scrollY.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
      >
        {children}
      </ScrollView>
    </RevealContext.Provider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
});
