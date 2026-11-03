import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';
import type { PaymentInput, PaymentMode } from '../api/types';
import { DateField } from '../components/DateField';
import { Banner, Button, Chip, Field, Input, Segmented } from '../components/ui';
import { colors, font, spacing } from '../theme';
import { todayString } from '../utils/dates';
import { paiseToINR, toPaise } from '../utils/money';

function makeSchema(maxPaise: number) {
  return z.object({
    amount: z
      .string()
      .trim()
      .min(1, 'Enter the amount')
      .refine((v) => (toPaise(v) ?? 0) > 0, 'Enter a valid amount (up to 2 decimals)')
      .refine((v) => (toPaise(v) ?? 0) <= maxPaise, `Amount cannot be more than the balance due (${paiseToINR(maxPaise)})`),
    paymentMode: z.enum(['CASH', 'ONLINE']),
    paymentDate: z.string(),
    transactionReference: z.string().trim().max(100),
  });
}
type PaymentFormValues = z.infer<ReturnType<typeof makeSchema>>;

/** Amount + cash/online + date form, used for a single sale and for lump-sum customer payments. */
export function PaymentForm({
  duePaise,
  minimumDate,
  onSubmit,
  submitError,
  submitLabel = 'Save payment',
}: {
  duePaise: number;
  minimumDate?: string;
  onSubmit: (input: PaymentInput) => Promise<void>;
  submitError?: string;
  submitLabel?: string;
}) {
  const {
    control,
    handleSubmit,
    setValue,

    formState: { errors, isSubmitting },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(makeSchema(duePaise)),
    defaultValues: { amount: '', paymentMode: 'CASH', paymentDate: todayString(), transactionReference: '' },
  });
  const mode = useWatch({ control, name: 'paymentMode' });
  const amountPaise = toPaise(useWatch({ control, name: 'amount' })) ?? 0;

  const submit = handleSubmit(async (v) =>
    onSubmit({
      amount: Number(v.amount),
      paymentMode: v.paymentMode,
      paymentDate: v.paymentDate,
      transactionReference: v.transactionReference || undefined,
    }),
  );

  return (
    <View>
      <View style={styles.dueBox}>
        <Text style={styles.dueLabel}>Balance due</Text>
        <Text style={styles.dueValue}>{paiseToINR(duePaise)}</Text>
      </View>

      {submitError && <Banner tone="error" message={submitError} />}

      <Field label="Amount received" error={errors.amount?.message}>
        <Controller
          control={control}
          name="amount"
          render={({ field }) => (
            <Input
              autoFocus
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              keyboardType="decimal-pad"
              prefix="₹"
              placeholder="0"
              error={!!errors.amount}
            />
          )}
        />
      </Field>
      <View style={styles.chips}>
        <Chip label="Full balance" onPress={() => setValue('amount', (duePaise / 100).toString(), { shouldValidate: true })} />
      </View>

      <Field label="Payment mode">
        <Controller
          control={control}
          name="paymentMode"
          render={({ field }) => (
            <Segmented<PaymentMode>
              value={field.value}
              onChange={field.onChange}
              options={[
                { value: 'CASH', label: 'Cash' },
                { value: 'ONLINE', label: 'Online' },
              ]}
            />
          )}
        />
      </Field>

      <Field label="Payment date">
        <Controller
          control={control}
          name="paymentDate"
          render={({ field }) => <DateField value={field.value} onChange={field.onChange} minimumDate={minimumDate} />}
        />
      </Field>

      {mode === 'ONLINE' && (
        <Field label="Transaction reference (optional)">
          <Controller
            control={control}
            name="transactionReference"
            render={({ field }) => (
              <Input value={field.value} onChangeText={field.onChange} placeholder="UPI / bank reference" autoCapitalize="characters" />
            )}
          />
        </Field>
      )}

      {amountPaise > 0 && amountPaise <= duePaise && (
        <Text style={styles.after}>
          Balance after this payment: <Text style={{ color: colors.due, fontWeight: '700' }}>{paiseToINR(duePaise - amountPaise)}</Text>
        </Text>
      )}

      <Button title={submitLabel} variant="success" icon="checkmark" onPress={submit} loading={isSubmitting} />
    </View>
  );
}

const styles = StyleSheet.create({
  dueBox: {
    backgroundColor: colors.dueBg,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dueLabel: { fontSize: font.body, color: colors.due, fontWeight: '600' },
  dueValue: { fontSize: font.big, color: colors.due, fontWeight: '800' },
  chips: { flexDirection: 'row', marginTop: -spacing.sm, marginBottom: spacing.lg },
  after: { fontSize: font.body, color: colors.textMuted, marginBottom: spacing.lg },
});
