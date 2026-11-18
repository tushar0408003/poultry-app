import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useLayoutEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { errorMessage } from '../api/client';
import { useCreateSupplier, useSupplier, useUpdateSupplier } from '../api/hooks';
import { Screen } from '../components/Screen';
import { Banner, Button, Field, Input, Loading } from '../components/ui';
import type { RootScreenProps } from '../navigation/types';

const amount = (example: string) =>
  z
    .string()
    .trim()
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), `Enter an amount like ${example}`);

const schema = z.object({
  ownerName: z.string().trim().min(1, 'Supplier name is required').max(120),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\+?\d[\d\s-]{6,18}\d$/.test(v), 'Enter a valid phone number'),
  address: z.string().trim().max(300),
  rate: amount('95 or 95.50'),
  weight: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d+(\.\d{1,3})?$/.test(v), 'Enter a weight like 100 or 100.5'),
  outstanding: amount('0, 1500 or 1500.50'),
});
type SupplierFormValues = z.infer<typeof schema>;

export function SupplierFormScreen({ route, navigation }: RootScreenProps<'SupplierForm'>) {
  const id = route.params?.id;
  const existing = useSupplier(id ?? '');
  const create = useCreateSupplier();
  const update = useUpdateSupplier(id ?? '');

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { ownerName: '', phone: '', address: '', rate: '', weight: '', outstanding: '' },
  });

  useLayoutEffect(() => navigation.setOptions({ title: id ? 'Edit supplier' : 'New supplier' }), [navigation, id]);

  useEffect(() => {
    if (existing.data) {
      const { ownerName, phone, address, rate, weight, outstanding } = existing.data;
      reset({ ownerName, phone, address, rate: String(rate), weight: weight ? String(weight) : '', outstanding: String(outstanding) });
    }
  }, [existing.data, reset]);

  if (id && existing.isLoading) return <Loading />;

  const submit = handleSubmit(async ({ rate, weight, outstanding, ...rest }) => {
    const values = { ...rest, rate: Number(rate), weight: weight ? Number(weight) : 0, outstanding: Number(outstanding) };
    try {
      if (id) {
        await update.mutateAsync(values);
        navigation.goBack();
      } else {
        const s = await create.mutateAsync(values);
        navigation.replace('SupplierDetail', { id: s.id });
      }
    } catch (e) {
      setError('root', { message: errorMessage(e) });
    }
  });

  const text = (name: keyof SupplierFormValues, label: string, props: Partial<React.ComponentProps<typeof Input>> = {}) => (
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
      {text('ownerName', 'Supplier name', { autoCapitalize: 'words', autoFocus: !id })}
      {text('phone', 'Phone number (optional)', { keyboardType: 'phone-pad' })}
      {text('address', 'Address (optional)', { multiline: true })}
      {text('rate', 'Rate ₹ per kg', { keyboardType: 'decimal-pad', placeholder: 'e.g. 95' })}
      {text('weight', 'Weight kg (optional)', { keyboardType: 'decimal-pad', placeholder: 'e.g. 500' })}
      {text('outstanding', 'Outstanding ₹', { keyboardType: 'decimal-pad', placeholder: 'Old dues you owe them, 0 if none' })}
      <Button title={id ? 'Save changes' : 'Add supplier'} icon="checkmark" onPress={submit} loading={isSubmitting} />
    </Screen>
  );
}
