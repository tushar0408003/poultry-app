import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useLayoutEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { errorMessage } from '../api/client';
import { useCreateCustomer, useCustomer, useUpdateCustomer } from '../api/hooks';
import { Screen } from '../components/Screen';
import { Banner, Button, Field, Input, Loading } from '../components/ui';
import type { RootScreenProps } from '../navigation/types';

const schema = z.object({
  shopName: z.string().trim().min(1, 'Shop name is required').max(120),
  ownerName: z.string().trim().max(120),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\+?\d[\d\s-]{6,18}\d$/.test(v), 'Enter a valid phone number'),
  address: z.string().trim().max(300),
});
type CustomerFormValues = z.infer<typeof schema>;

export function CustomerFormScreen({ route, navigation }: RootScreenProps<'CustomerForm'>) {
  const id = route.params?.id;
  const existing = useCustomer(id ?? '');
  const create = useCreateCustomer();
  const update = useUpdateCustomer(id ?? '');

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { shopName: '', ownerName: '', phone: '', address: '' },
  });

  useLayoutEffect(() => navigation.setOptions({ title: id ? 'Edit customer' : 'New customer' }), [navigation, id]);

  useEffect(() => {
    if (existing.data) {
      const { shopName, ownerName, phone, address } = existing.data;
      reset({ shopName, ownerName, phone, address });
    }
  }, [existing.data, reset]);

  if (id && existing.isLoading) return <Loading />;

  const submit = handleSubmit(async (values) => {
    try {
      if (id) {
        await update.mutateAsync(values);
        navigation.goBack();
      } else {
        const c = await create.mutateAsync(values);
        navigation.replace('CustomerDetail', { id: c.id });
      }
    } catch (e) {
      setError('root', { message: errorMessage(e) });
    }
  });

  const text = (name: keyof CustomerFormValues, label: string, props: Partial<React.ComponentProps<typeof Input>> = {}) => (
    <Field label={label} error={errors[name]?.message}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Input value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={!!errors[name]} {...props} />
        )}
      />
    </Field>
  );

  return (
    <Screen>
      {errors.root?.message && <Banner tone="error" message={errors.root.message} />}
      {text('shopName', 'Shop name', { autoCapitalize: 'words', placeholder: 'e.g. Sharma Chicken Centre', autoFocus: !id })}
      {text('ownerName', 'Owner name (optional)', { autoCapitalize: 'words' })}
      {text('phone', 'Phone number (optional)', { keyboardType: 'phone-pad' })}
      {text('address', 'Address (optional)', { multiline: true })}
      <Button title={id ? 'Save changes' : 'Add customer'} icon="checkmark" onPress={submit} loading={isSubmitting} />
    </Screen>
  );
}
