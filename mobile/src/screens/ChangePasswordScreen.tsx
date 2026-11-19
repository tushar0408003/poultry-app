import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Alert } from 'react-native';
import { z } from 'zod';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Screen } from '../components/Screen';
import { Banner, Button, Field, PasswordInput } from '../components/ui';
import type { RootScreenProps } from '../navigation/types';

// Mirrors the backend ChangePasswordDto (min 8, max 200).
const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters').max(200),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'Choose a different password' });
type Values = z.infer<typeof schema>;

export function ChangePasswordScreen({ navigation }: RootScreenProps<'ChangePassword'>) {
  const { changePassword } = useAuth();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { currentPassword: '', newPassword: '', confirm: '' } });

  const submit = handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await changePassword(currentPassword, newPassword);
      Alert.alert('Password changed', 'Other devices have been logged out.');
      navigation.goBack();
    } catch (e) {
      setError('root', { message: errorMessage(e) });
    }
  });

  const field = (name: keyof Values, label: string, hint?: string) => (
    <Field label={label} error={errors[name]?.message} hint={hint}>
      <Controller
        control={control}
        name={name}
        render={({ field: f }) => (
          <PasswordInput
            value={f.value}
            onChangeText={f.onChange}
            onBlur={f.onBlur}
            autoComplete={name === 'currentPassword' ? 'password' : 'new-password'}
            error={!!errors[name]}
          />
        )}
      />
    </Field>
  );

  return (
    <Screen>
      {errors.root?.message && <Banner tone="error" message={errors.root.message} />}
      {field('currentPassword', 'Current password')}
      {field('newPassword', 'New password', 'At least 8 characters')}
      {field('confirm', 'Confirm new password')}
      <Button title="Change password" icon="checkmark" onPress={submit} loading={isSubmitting} />
    </Screen>
  );
}
