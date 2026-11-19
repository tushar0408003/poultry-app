import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Image, KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInputInstance, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Button, Field, Input, PasswordInput } from '../components/ui';
import { colors, font, radius, spacing } from '../theme';

// Khata brand colours (the rest of the app keeps the theme colours).
const BRAND_RED = '#B91C1C';
const BRAND_CREAM = '#FFF4E0';

const schema = z.object({
  username: z.string().trim().min(1, 'Enter your username'),
  password: z.string().min(1, 'Enter your password'),
});
type LoginValues = z.infer<typeof schema>;

export function LoginScreen() {
  const { login } = useAuth();
  const passwordRef = useRef<TextInputInstance>(null);
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(schema), defaultValues: { username: '', password: '' } });

  const submit = handleSubmit(async ({ username, password }) => {
    try {
      await login(username, password);
    } catch (e) {
      setError('root', { message: errorMessage(e) });
    }
  });

  return (
    <SafeAreaView style={styles.safe}>
      {/* Android is edge-to-edge (window no longer resizes), so padding is needed on both platforms. */}
      <KeyboardAvoidingView behavior="padding" style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Image source={require('../../assets/icon.png')} style={styles.logo} accessibilityIgnoresInvertColors />
            <Text style={styles.title}>Khata</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome back</Text>
            <Text style={styles.cardSubtitle}>Log in to continue</Text>

            {errors.root?.message && <Banner tone="error" message={errors.root.message} />}

            <Field label="Username" error={errors.username?.message}>
              <Controller
                control={control}
                name="username"
                render={({ field }) => (
                  <Input
                    icon="person-outline"
                    value={field.value}
                    onChangeText={field.onChange}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username"
                    textContentType="username"
                    placeholder="Your username"
                    returnKeyType="next"
                    submitBehavior="submit"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    error={!!errors.username}
                  />
                )}
              />
            </Field>
            <Field label="Password" error={errors.password?.message}>
              <Controller
                control={control}
                name="password"
                render={({ field }) => (
                  <PasswordInput
                    ref={passwordRef}
                    value={field.value}
                    onChangeText={field.onChange}
                    autoComplete="password"
                    textContentType="password"
                    placeholder="Your password"
                    returnKeyType="go"
                    onSubmitEditing={() => submit()}
                    error={!!errors.password}
                  />
                )}
              />
            </Field>
            <Button title="Log in" onPress={submit} loading={isSubmitting} style={styles.loginButton} />
          </View>

          <View style={styles.footer}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.textMuted} />
            <Text style={styles.footerText}>Your session is stored securely on this device</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND_CREAM },
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  brand: { alignItems: 'center', marginBottom: spacing.xl },
  logo: { width: 80, height: 80, borderRadius: 18, marginBottom: spacing.lg },
  title: { fontSize: font.big + 2, fontWeight: '800', color: BRAND_RED },
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.xl,
    elevation: 3,
    shadowColor: '#101828',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  loginButton: { backgroundColor: BRAND_RED, borderColor: BRAND_RED },
  cardTitle: { fontSize: font.title, fontWeight: '700', color: colors.text },
  cardSubtitle: { fontSize: font.small + 1, color: colors.textMuted, marginTop: 2, marginBottom: spacing.lg },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.xl },
  footerText: { fontSize: font.small, color: colors.textMuted },
});
