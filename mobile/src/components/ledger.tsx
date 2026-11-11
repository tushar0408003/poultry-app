import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Payment, PaymentStatus, Sale } from '../api/types';
import { colors, font, radius, spacing } from '../theme';
import { formatDateShort } from '../utils/dates';
import { formatINR, formatKg, paiseToINR, saleDuePaise } from '../utils/money';

const STATUS_STYLE: Record<PaymentStatus, { fg: string; bg: string; label: string }> = {
  PAID: { fg: colors.received, bg: colors.receivedBg, label: 'Paid' },
  PARTIAL: { fg: colors.partial, bg: colors.partialBg, label: 'Partial' },
  UNPAID: { fg: colors.danger, bg: colors.dangerBg, label: 'Unpaid' },
};

export function StatusBadge({ status }: { status: PaymentStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeText, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

/** One sale in a list: customer, date, weight x rate, total, received, balance. */
export function SaleRow({ sale, onPress, showCustomer = true }: { sale: Sale; onPress: () => void; showCustomer?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}>
      <View style={styles.rowTop}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {showCustomer ? (sale.customer?.ownerName ?? 'Unknown customer') : formatDateShort(sale.saleDate)}
        </Text>
        <Text style={styles.amount}>{formatINR(sale.totalAmount)}</Text>
      </View>
      <View style={styles.rowTop}>
        <Text style={styles.sub}>
          {showCustomer ? `${formatDateShort(sale.saleDate)} · ` : ''}
          {formatKg(sale.weight)}
        </Text>
        <StatusBadge status={sale.status} />
      </View>
      <View style={styles.money}>
        <Text style={styles.moneyText}>
          Cash <Text style={styles.green}>{formatINR(sale.cashReceived)}</Text>
        </Text>
        <Text style={styles.moneyText}>
          Online <Text style={styles.green}>{formatINR(sale.onlineReceived)}</Text>
        </Text>
        <Text style={styles.moneyText}>
          Due <Text style={saleDuePaise(sale) > 0 ? styles.due : styles.green}>{paiseToINR(saleDuePaise(sale))}</Text>
        </Text>
      </View>
    </Pressable>
  );
}

export function PaymentRow({
  payment,
  showCustomer,
  onDelete,
}: {
  payment: Payment;
  showCustomer?: boolean;
  onDelete?: () => void;
}) {
  const online = payment.paymentMode === 'ONLINE';
  return (
    <View style={styles.paymentRow}>
      <View style={[styles.modeIcon, { backgroundColor: online ? '#F4F3FF' : colors.receivedBg }]}>
        <Ionicons name={online ? 'phone-portrait-outline' : 'cash-outline'} size={20} color={online ? colors.online : colors.received} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {showCustomer ? (payment.customer?.ownerName ?? 'Unknown customer') : online ? 'Online' : 'Cash'}
        </Text>
        <Text style={styles.sub}>
          {formatDateShort(payment.paymentDate)}
          {showCustomer ? ` · ${online ? 'Online' : 'Cash'}` : ''}
          {payment.source === 'SALE_ENTRY' ? ' · with sale' : ''}
          {payment.transactionReference ? ` · Ref ${payment.transactionReference}` : ''}
        </Text>
      </View>
      <Text style={[styles.amount, styles.green]}>+{formatINR(payment.amount)}</Text>
      {onDelete && (
        <Pressable onPress={onDelete} hitSlop={10} accessibilityLabel="Delete payment" style={{ marginLeft: spacing.sm }}>
          <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  badgeText: { fontSize: 12, fontWeight: '700' },
  row: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  rowTitle: { fontSize: font.body + 1, fontWeight: '700', color: colors.text, flex: 1, marginRight: spacing.sm },
  amount: { fontSize: font.body + 1, fontWeight: '700', color: colors.text },
  sub: { fontSize: font.small, color: colors.textMuted, flex: 1 },
  money: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  moneyText: { fontSize: font.small, color: colors.textMuted },
  green: { color: colors.received, fontWeight: '700' },
  due: { color: colors.due, fontWeight: '700' },
  paymentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modeIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
});
