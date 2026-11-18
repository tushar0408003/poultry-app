import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Alert } from 'react-native';
import { z } from 'zod';
import { errorMessage } from '../api/client';
import { useCreatePurchase, useDeletePurchase, usePurchase, useSupplier, useUpdatePurchase } from '../api/hooks';
import { DateField } from '../components/DateField';
import { Screen } from '../components/Screen';
import { Banner, Button, Card, Field, Input, Loading, Row } from '../components/ui';
import type { RootScreenProps } from '../navigation/types';
import { colors, spacing } from '../theme';
import { todayString } from '../utils/dates';
import { paiseToINR, toGrams, toInputString, toPaise } from '../utils/money';

const optionalAmount = z
  .string()
  .trim()
  .refine((v) => v === '' || toPaise(v) !== null, 'Enter a valid amount (up to 2 decimals)');

const schema = z
  .object({
    purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    weight: z
      .string()
      .trim()
      .min(1, 'Enter the weight')
      .refine((v) => (toGrams(v) ?? 0) > 0, 'Weight must be more than 0 (up to 3 decimals)'),
    rate: z
      .string()
      .trim()
      .min(1, 'Enter the rate')
      .refine((v) => (toPaise(v) ?? 0) > 0, 'Rate must be more than 0 (up to 2 decimals)'),
    cashPaid: optionalAmount,
    onlinePaid: optionalAmount,
    notes: z.string().trim().max(500, 'Notes are too long'),
  })
  .superRefine((v, ctx) => {
    const { totalPaise, paidPaise } = calculate(v);
    if (totalPaise > 0 && paidPaise > totalPaise) {
      ctx.addIssue({ code: 'custom', path: ['cashPaid'], message: 'Amount paid cannot be more than the purchase amount' });
    }
  });
type PurchaseFormValues = z.infer<typeof schema>;

/** Same rounding as the server: grams x paise-per-kg / 1000, to the nearest paisa. */
function calculate(v: Pick<PurchaseFormValues, 'weight' | 'rate' | 'cashPaid' | 'onlinePaid'>) {
  const grams = toGrams(v.weight) ?? 0;
  const ratePaise = toPaise(v.rate) ?? 0;
  const totalPaise = Math.round((grams * ratePaise) / 1000);
  const paidPaise = (toPaise(v.cashPaid || '0') ?? 0) + (toPaise(v.onlinePaid || '0') ?? 0);
  return { totalPaise, paidPaise, remainingPaise: Math.max(totalPaise - paidPaise, 0) };
}

export function PurchaseFormScreen({ route, navigation }: RootScreenProps<'PurchaseForm'>) {
  const { supplierId, id } = route.params;
  const supplier = useSupplier(supplierId);
  const existing = usePurchase(id ?? '');
  const create = useCreatePurchase();
  const update = useUpdatePurchase(id ?? '');
  const remove = useDeletePurchase();
  const rateFilled = useRef(false);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<PurchaseFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { purchaseDate: todayString(), weight: '', rate: '', cashPaid: '', onlinePaid: '', notes: '' },
  });
  const values = useWatch({ control });
  const calc = calculate({
    weight: values.weight ?? '',
    rate: values.rate ?? '',
    cashPaid: values.cashPaid ?? '',
    onlinePaid: values.onlinePaid ?? '',
  });

  useLayoutEffect(() => {
    const name = supplier.data?.ownerName;
    navigation.setOptions({ title: id ? 'Edit purchase' : name ? `Buy from ${name}` : 'New purchase' });
  }, [navigation, id, supplier.data?.ownerName]);

  // New purchase: start from the supplier's current rate (still editable).
  useEffect(() => {
    if (id || rateFilled.current || !supplier.data) return;
    rateFilled.current = true;
    if (supplier.data.rate > 0 && getValues('rate') === '') setValue('rate', toInputString(supplier.data.rate));
  }, [id, supplier.data, getValues, setValue]);

  // Edit: load the purchase as saved, including the rate it was made at.
  useEffect(() => {
    const p = existing.data;
    if (!p) return;
    reset({
      purchaseDate: p.purchaseDate,
      weight: toInputString(p.weight),
      rate: toInputString(p.rate),
      cashPaid: p.cashPaid ? toInputString(p.cashPaid) : '',
      onlinePaid: p.onlinePaid ? toInputString(p.onlinePaid) : '',
      notes: p.notes,
    });
  }, [existing.data, reset]);

  if (supplier.isLoading || (id && existing.isLoading)) return <Loading />;

  const submit = handleSubmit(async (v) => {
    const input = {
      supplierId,
      purchaseDate: v.purchaseDate,
      weight: Number(v.weight),
      rate: Number(v.rate),
      cashPaid: v.cashPaid ? Number(v.cashPaid) : 0,
      onlinePaid: v.onlinePaid ? Number(v.onlinePaid) : 0,
      notes: v.notes,
    };
    try {
      if (id) await update.mutateAsync(input);
      else await create.mutateAsync(input);
      navigation.goBack();
    } catch (e) {
      setError('root', { message: errorMessage(e) });
    }
  });

  const confirmDelete = () =>
    Alert.alert('Delete purchase?', 'This purchase will be removed from the supplier balance. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove.mutateAsync(id!);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Could not delete', errorMessage(e));
          }
        },
      },
    ]);

  const text = (
    name: Exclude<keyof PurchaseFormValues, 'purchaseDate'>,
    label: string,
    props: Partial<React.ComponentProps<typeof Input>> = {},
    hint?: string,
  ) => (
    <Field label={label} error={errors[name]?.message} hint={hint}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Input value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={!!errors[name]} {...props} />
        )}
      />
    </Field>
  );

  const supplierRate = supplier.data?.rate ?? 0;

  return (
    <Screen>
      {errors.root?.message && <Banner tone="error" message={errors.root.message} />}
      <Field label="Date" error={errors.purchaseDate?.message}>
        <Controller control={control} name="purchaseDate" render={({ field }) => <DateField value={field.value} onChange={field.onChange} />} />
      </Field>
      {text('weight', 'Weight (kg)', { keyboardType: 'decimal-pad', autoFocus: !id, placeholder: 'e.g. 250.5' })}
      {text(
        'rate',
        'Rate ₹ per kg',
        { keyboardType: 'decimal-pad' },
        supplierRate > 0 ? `Supplier rate: ${paiseToINR(Math.round(supplierRate * 100))}/kg` : 'This supplier has no rate set',
      )}
      {text('cashPaid', 'Cash paid ₹ (optional)', { keyboardType: 'decimal-pad', placeholder: '0' })}
      {text('onlinePaid', 'Online paid ₹ (optional)', { keyboardType: 'decimal-pad', placeholder: '0' })}

      <Card style={{ marginBottom: spacing.lg }}>
        <Row label="Total amount" value={paiseToINR(calc.totalPaise)} bold />
        <Row label="Paid" value={paiseToINR(calc.paidPaise)} color={colors.received} />
        <Row label="To pay" value={paiseToINR(calc.remainingPaise)} color={calc.remainingPaise > 0 ? colors.due : colors.received} bold />
      </Card>

      {text('notes', 'Notes (optional)', { multiline: true })}
      <Button title={id ? 'Save changes' : 'Add purchase'} icon="checkmark" onPress={submit} loading={isSubmitting} />
      {id && (
        <Button
          title="Delete purchase"
          variant="danger"
          icon="trash-outline"
          onPress={confirmDelete}
          loading={remove.isPending}
          style={{ marginTop: spacing.xl }}
        />
      )}
    </Screen>
  );
}
