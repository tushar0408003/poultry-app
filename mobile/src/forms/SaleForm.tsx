import { zodResolver } from '@hookform/resolvers/zod';
import { useRef } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, Text, TextInputInstance, View } from 'react-native';
import { CustomerPicker } from '../components/CustomerPicker';
import { DateField } from '../components/DateField';
import { Button, Card, Chip, Divider, Field, Input, Row } from '../components/ui';
import { colors, font, spacing } from '../theme';
import { paiseToINR } from '../utils/money';
import { calculateSale, SaleFormValues, saleFormSchema } from './saleSchema';

/**
 * Sale entry form used by both "Add Sale" and "Edit Sale".
 * Totals recalculate on every keystroke; `onSubmit` returning true resets the form.
 */
export function SaleForm({
  defaultValues,
  onSubmit,
  submitLabel,
  isEdit = false,
  resetAfterSubmit,
}: {
  defaultValues: SaleFormValues;
  onSubmit: (values: SaleFormValues) => Promise<boolean>;
  submitLabel: string;
  isEdit?: boolean;
  /** Values to keep after a successful create (e.g. date and today's rate). */
  resetAfterSubmit?: (submitted: SaleFormValues) => SaleFormValues;
}) {
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SaleFormValues>({ resolver: zodResolver(saleFormSchema), defaultValues, mode: 'onTouched' });

  const values = useWatch({ control }) as SaleFormValues;
  const calc = calculateSale(values);

  const rateRef = useRef<TextInputInstance>(null);
  const cashRef = useRef<TextInputInstance>(null);
  const onlineRef = useRef<TextInputInstance>(null);

  const submit = handleSubmit(async (v) => {
    const ok = await onSubmit(v);
    if (ok && resetAfterSubmit) reset(resetAfterSubmit(v));
  });

  const fillFull = (field: 'cashReceived' | 'onlineReceived') => {
    const due = calc.totalPaise - values.laterPaymentsPaise;
    if (due <= 0) return;
    const other = field === 'cashReceived' ? 'onlineReceived' : 'cashReceived';
    setValue(field, (due / 100).toString(), { shouldValidate: true });
    setValue(other, '', { shouldValidate: true });
  };

  return (
    <View>
      <Field label="Shop / Customer" error={errors.customer?.message}>
        <Controller
          control={control}
          name="customer"
          render={({ field }) => <CustomerPicker value={field.value} onChange={field.onChange} error={!!errors.customer} />}
        />
      </Field>

      <Field label="Sale date">
        <Controller
          control={control}
          name="saleDate"
          render={({ field }) => <DateField value={field.value} onChange={field.onChange} />}
        />
      </Field>

      <View style={styles.twoCol}>
        <View style={styles.col}>
          <Field label="Weight" error={errors.weight?.message}>
            <Controller
              control={control}
              name="weight"
              render={({ field }) => (
                <Input
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  suffix="kg"
                  returnKeyType="next"
                  onSubmitEditing={() => rateRef.current?.focus()}
                  error={!!errors.weight}
                  accessibilityLabel="Weight in kg"
                />
              )}
            />
          </Field>
        </View>
        <View style={styles.col}>
          <Field label="Rate per kg" error={errors.ratePerKg?.message}>
            <Controller
              control={control}
              name="ratePerKg"
              render={({ field }) => (
                <Input
                  ref={rateRef}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  prefix="₹"
                  returnKeyType="next"
                  onSubmitEditing={() => cashRef.current?.focus()}
                  error={!!errors.ratePerKg}
                  accessibilityLabel="Rate per kg in rupees"
                />
              )}
            />
          </Field>
        </View>
      </View>

      <View style={styles.totalBox}>
        <Text style={styles.totalLabel}>Total amount</Text>
        <Text style={styles.totalValue}>{paiseToINR(calc.totalPaise)}</Text>
      </View>

      {isEdit && (
        <Text style={styles.hint}>
          Cash and online below are what was received at the time of sale. Use “Add payment” for later payments.
        </Text>
      )}

      <View style={styles.twoCol}>
        <View style={styles.col}>
          <Field label="Cash received" error={errors.cashReceived?.message}>
            <Controller
              control={control}
              name="cashReceived"
              render={({ field }) => (
                <Input
                  ref={cashRef}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  prefix="₹"
                  returnKeyType="next"
                  onSubmitEditing={() => onlineRef.current?.focus()}
                  error={!!errors.cashReceived}
                  accessibilityLabel="Cash received in rupees"
                />
              )}
            />
          </Field>
        </View>
        <View style={styles.col}>
          <Field label="Online received" error={errors.onlineReceived?.message}>
            <Controller
              control={control}
              name="onlineReceived"
              render={({ field }) => (
                <Input
                  ref={onlineRef}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  prefix="₹"
                  error={!!errors.onlineReceived}
                  accessibilityLabel="Online payment received in rupees"
                />
              )}
            />
          </Field>
        </View>
      </View>

      <View style={styles.chips}>
        <Chip label="Full cash" onPress={() => fillFull('cashReceived')} />
        <Chip label="Full online" onPress={() => fillFull('onlineReceived')} />
        <Chip
          label="Not paid"
          onPress={() => {
            setValue('cashReceived', '', { shouldValidate: true });
            setValue('onlineReceived', '', { shouldValidate: true });
          }}
        />
      </View>

      {(toNumber(values.onlineReceived) > 0) && (
        <Field label="Online reference (optional)">
          <Controller
            control={control}
            name="onlineReference"
            render={({ field }) => (
              <Input value={field.value} onChangeText={field.onChange} placeholder="UPI / transaction ID" autoCapitalize="characters" />
            )}
          />
        </Field>
      )}

      <Card style={styles.summary}>
        <Row label="Total amount" value={paiseToINR(calc.totalPaise)} />
        <Row label="Cash received" value={paiseToINR(calc.cashPaise)} color={colors.received} />
        <Row label="Online received" value={paiseToINR(calc.onlinePaise)} color={colors.received} />
        {values.laterPaymentsPaise > 0 && (
          <Row label="Later payments" value={paiseToINR(values.laterPaymentsPaise)} color={colors.received} />
        )}
        <Divider />
        <Row label="Total payment received" value={paiseToINR(calc.paidPaise)} color={colors.received} bold />
        <Row
          label="Remaining balance"
          value={paiseToINR(calc.remainingPaise)}
          color={calc.remainingPaise > 0 ? colors.due : calc.remainingPaise < 0 ? colors.danger : colors.received}
          bold
        />
      </Card>

      <Field label="Notes (optional)" error={errors.notes?.message}>
        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <Input value={field.value} onChangeText={field.onChange} placeholder="Anything to remember" multiline />
          )}
        />
      </Field>

      <Button title={submitLabel} onPress={submit} loading={isSubmitting} icon="checkmark" />
    </View>
  );
}

const toNumber = (s?: string) => Number(s) || 0;

const styles = StyleSheet.create({
  twoCol: { flexDirection: 'row', gap: spacing.md },
  col: { flex: 1 },
  totalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.salesBg,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  totalLabel: { fontSize: font.body, color: colors.sales, fontWeight: '600' },
  totalValue: { fontSize: font.big, color: colors.sales, fontWeight: '800' },
  hint: { fontSize: font.small, color: colors.textMuted, marginBottom: spacing.md },
  chips: { flexDirection: 'row', marginTop: -spacing.sm, marginBottom: spacing.lg },
  summary: { marginBottom: spacing.lg },
});
