import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Button, Field, Input } from '../components/ui';
import { colors, font, spacing } from '../theme';

const schema = z.object({
  username: z.string().trim().min(1, 'Enter your username'),
  password: z.string().min(1, 'Enter your password'),
});
type LoginValues = z.infer<typeof schema>;

export function LoginScreen() {
  const { login } = useAuth();
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <View style={styles.brand}>
          <Text style={styles.title}>Sales Ledger</Text>
          <Text style={styles.subtitle}>Sales, payments and dues — simply.</Text>
        </View>

        {errors.root?.message && <Banner tone="error" message={errors.root.message} />}

        <Field label="Username" error={errors.username?.message}>
          <Controller
            control={control}
            name="username"
            render={({ field }) => (
              <Input
                value={field.value}
                onChangeText={field.onChange}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                placeholder="admin"
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
              <Input
                value={field.value}
                onChangeText={field.onChange}
                secureTextEntry
                autoComplete="password"
                placeholder="••••••••"
                returnKeyType="go"
                onSubmitEditing={() => submit()}
                error={!!errors.password}
              />
            )}
          />
        </Field>
        <Button title="Log in" onPress={submit} loading={isSubmitting} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  brand: { marginBottom: spacing.xxl },
  title: { fontSize: 32, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: font.body, color: colors.textMuted, marginTop: spacing.xs },
});
