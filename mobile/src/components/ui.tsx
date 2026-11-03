import { Ionicons } from '@expo/vector-icons';
import { ReactNode, Ref } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputInstance,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { colors, font, radius, spacing, touch } from '../theme';

// ---------- Text ----------

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

// ---------- Card ----------

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// ---------- Button ----------

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = {
    primary: { bg: colors.primary, fg: colors.primaryText, border: colors.primary },
    success: { bg: colors.received, fg: '#fff', border: colors.received },
    secondary: { bg: colors.background, fg: colors.text, border: colors.border },
    danger: { bg: colors.background, fg: colors.danger, border: colors.danger },
  }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: inactive ? 0.55 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={20} color={palette.fg} style={{ marginRight: spacing.sm }} />}
          <Text style={[styles.buttonText, { color: palette.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  color = colors.text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
  color?: string;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={10} style={styles.iconButton}>
      <Ionicons name={icon} size={24} color={color} />
    </Pressable>
  );
}

// ---------- Inputs ----------

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Input({
  error,
  prefix,
  suffix,
  style,
  ref,
  ...props
}: TextInputProps & { error?: boolean; prefix?: string; suffix?: string; ref?: Ref<TextInputInstance> }) {
  return (
    <View style={[styles.inputWrap, error && styles.inputError, props.editable === false && styles.inputDisabled]}>
      {prefix && <Text style={styles.affix}>{prefix}</Text>}
      <TextInput ref={ref} placeholderTextColor={colors.textMuted} style={[styles.input, style]} {...props} />
      {suffix && <Text style={styles.affix}>{suffix}</Text>}
    </View>
  );
}

// ---------- Segmented control / chips ----------

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]} accessibilityState={{ selected: active }}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

// ---------- Key/value rows ----------

export function Row({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.bold, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

// ---------- States ----------

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
      <Text style={[styles.muted, { textAlign: 'center', marginVertical: spacing.md }]}>{message}</Text>
      {onRetry && <Button title="Try again" variant="secondary" onPress={onRetry} />}
    </View>
  );
}

export function EmptyState({ message, icon = 'document-text-outline' }: { message: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={40} color={colors.border} />
      <Text style={[styles.muted, { textAlign: 'center', marginTop: spacing.md }]}>{message}</Text>
    </View>
  );
}

export function Banner({ message, tone }: { message: string; tone: 'success' | 'error' }) {
  const ok = tone === 'success';
  return (
    <View style={[styles.banner, { backgroundColor: ok ? colors.receivedBg : colors.dangerBg }]} accessibilityLiveRegion="polite">
      <Ionicons name={ok ? 'checkmark-circle' : 'alert-circle'} size={22} color={ok ? colors.received : colors.danger} />
      <Text style={[styles.bannerText, { color: ok ? colors.received : colors.danger }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: font.heading, fontWeight: '700', color: colors.text },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl, marginBottom: spacing.sm },
  sectionTitle: { fontSize: font.title - 2, fontWeight: '700', color: colors.text },
  muted: { fontSize: font.small, color: colors.textMuted },
  card: { backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  button: {
    minHeight: touch.minHeight,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: font.body + 1, fontWeight: '700' },
  iconButton: { padding: spacing.sm },
  field: { marginBottom: spacing.lg },
  label: { fontSize: font.label, fontWeight: '600', color: colors.text, marginBottom: spacing.xs + 2 },
  error: { color: colors.danger, fontSize: font.small, marginTop: spacing.xs },
  hint: { color: colors.textMuted, fontSize: font.small, marginTop: spacing.xs },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touch.minHeight,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
  },
  inputError: { borderColor: colors.danger },
  inputDisabled: { backgroundColor: colors.surface },
  input: { flex: 1, fontSize: font.body + 2, color: colors.text, paddingVertical: spacing.md },
  affix: { fontSize: font.body + 2, color: colors.textMuted, marginHorizontal: spacing.xs },
  segmented: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: 4 },
  segment: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.background, elevation: 1, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  segmentText: { fontSize: font.label, color: colors.textMuted, fontWeight: '600' },
  segmentTextActive: { color: colors.text },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, marginRight: spacing.sm },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontSize: font.small + 1, color: colors.text, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  rowLabel: { fontSize: font.body, color: colors.textMuted },
  rowValue: { fontSize: font.body, color: colors.text, fontWeight: '600' },
  bold: { fontWeight: '700', color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, minHeight: 200 },
  banner: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg },
  bannerText: { marginLeft: spacing.sm, fontSize: font.body, fontWeight: '600', flex: 1 },
});
