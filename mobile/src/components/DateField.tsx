import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing, touch } from '../theme';
import { formatDate, fromDateString, toDateString, todayString } from '../utils/dates';
import { Button } from './ui';

/** Tappable date box that opens the native date picker. Value is "YYYY-MM-DD". */
export function DateField({
  value,
  onChange,
  allowFuture = false,
  minimumDate,
  compact,
}: {
  value: string;
  onChange: (date: string) => void;
  allowFuture?: boolean;
  minimumDate?: string;
  compact?: boolean;
}) {
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState(fromDateString(value));
  const maximumDate = allowFuture ? undefined : fromDateString(todayString());
  const minDate = minimumDate ? fromDateString(minimumDate) : undefined;

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: fromDateString(value),
        mode: 'date',
        maximumDate,
        minimumDate: minDate,
        onChange: (event: DateTimePickerEvent, date?: Date) => {
          if (event.type === 'set' && date) onChange(toDateString(date));
        },
      });
    } else {
      setIosDraft(fromDateString(value));
      setIosOpen(true);
    }
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Date: ${formatDate(value)}. Tap to change`}
        onPress={open}
        style={[styles.box, compact && styles.compact]}
      >
        <Ionicons name="calendar-outline" size={20} color={colors.primary} />
        <Text style={styles.text}>{value === todayString() ? `Today, ${formatDate(value)}` : formatDate(value)}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>

      {Platform.OS === 'ios' && (
        <Modal visible={iosOpen} transparent animationType="fade" onRequestClose={() => setIosOpen(false)}>
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <DateTimePicker
                value={iosDraft}
                mode="date"
                display="inline"
                maximumDate={maximumDate}
                minimumDate={minDate}
                onChange={(_, d) => d && setIosDraft(d)}
              />
              <Button
                title="Done"
                onPress={() => {
                  onChange(toDateString(iosDraft));
                  setIosOpen(false);
                }}
              />
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touch.minHeight,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
  },
  compact: { minHeight: 44 },
  text: { flex: 1, fontSize: font.body + 1, color: colors.text, marginLeft: spacing.sm, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.lg },
  sheet: { backgroundColor: colors.background, borderRadius: radius.lg, padding: spacing.lg },
});
