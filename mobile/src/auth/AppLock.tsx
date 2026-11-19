import * as LocalAuthentication from 'expo-local-authentication';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Image, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/ui';
import { brand, colors, font, spacing } from '../theme';
import { useAuth } from './AuthContext';

const RELOCK_AFTER_MS = 60_000;

/**
 * Asks for the phone's fingerprint / face / screen lock when the app opens with a saved session,
 * or comes back after more than a minute away, so a lost or borrowed phone doesn't open the khata.
 * Skipped on phones with no screen lock set up. Children stay mounted, so navigation state survives.
 */
export function AppLock({ children }: { children: ReactNode }) {
  const { status, logout } = useAuth();
  const [locked, setLocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [prevStatus, setPrevStatus] = useState(status);
  const backgroundAt = useRef<number | null>(null);
  const prompting = useRef(false);

  // Lock when a saved session is restored at startup; a fresh password login is already proof enough.
  if (status !== prevStatus) {
    setPrevStatus(status);
    setLocked(prevStatus === 'loading' && status === 'signedIn');
  }

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (prompting.current) return; // the PIN screen itself can background the app
      if (state === 'background') backgroundAt.current = Date.now();
      if (state === 'active' && backgroundAt.current !== null) {
        if (Date.now() - backgroundAt.current > RELOCK_AFTER_MS && status === 'signedIn') setLocked(true);
        backgroundAt.current = null;
      }
    });
    return () => sub.remove();
  }, [status]);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      if ((await LocalAuthentication.getEnrolledLevelAsync()) === LocalAuthentication.SecurityLevel.NONE) {
        setLocked(false); // no screen lock on this phone: nothing to check against
        return;
      }
      const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Khata' });
      setFailed(!res.success);
      if (res.success) setLocked(false);
    } catch {
      setFailed(true);
    } finally {
      prompting.current = false;
    }
  }, []);

  useEffect(() => {
    // unlock() opens the system prompt and only sets state after awaiting it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (locked) void unlock();
  }, [locked, unlock]);

  return (
    <View style={styles.fill}>
      {children}
      {locked && (
        <View style={styles.overlay}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} accessibilityIgnoresInvertColors />
          <Text style={styles.title}>Khata is locked</Text>
          <Text style={styles.subtitle}>{failed ? 'Not recognised. Try again.' : 'Unlock with your fingerprint or phone PIN'}</Text>
          <Button title="Unlock" icon="finger-print" onPress={() => void unlock()} style={styles.unlock} />
          <Button title="Log out" variant="secondary" onPress={() => void logout()} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: brand.cream,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  logo: { width: 80, height: 80, borderRadius: 18, alignSelf: 'center', marginBottom: spacing.sm },
  title: { fontSize: font.heading, fontWeight: '800', color: brand.red, textAlign: 'center' },
  subtitle: { fontSize: font.body, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg },
  unlock: { backgroundColor: brand.red, borderColor: brand.red },
});
