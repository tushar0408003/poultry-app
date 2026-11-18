import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Payment, Sale } from '../api/types';
import { colors, font, radius, spacing } from '../theme';
import { formatDateShort } from '../utils/dates';
import { formatINR, formatKg } from '../utils/money';
import { StatusBadge } from './ledger';
import { EmptyState } from './ui';

type Tab = 'sales' | 'payments';

/**
 * Home-screen "Recent activity": recent sales and recent payments as two tabs
 * in one card, with compact, easy-to-scan rows.
 */
export function RecentActivity({
  sales,
  payments,
  onOpenSale,
  onSeeAllSales,
}: {
  sales: Sale[];
  payments: Payment[];
  onOpenSale: (id: string) => void;
  onSeeAllSales: () => void;
}) {
  const [tab, setTab] = useState<Tab>('sales');

  return (
    <View style={styles.card}>
      <View style={styles.tabs}>
        <TabButton label="Sales" count={sales.length} icon="receipt-outline" active={tab === 'sales'} onPress={() => setTab('sales')} />
        <TabButton label="Payments" count={payments.length} icon="wallet-outline" active={tab === 'payments'} onPress={() => setTab('payments')} />
      </View>

      {tab === 'sales' ? (
        sales.length === 0 ? (
          <EmptyState icon="receipt-outline" message="No sales yet. Tap “Add sale” to record your first sale." />
        ) : (
          <>
            {sales.map((s, i) => (
              <SaleItem key={s.id} sale={s} last={i === sales.length - 1} onPress={() => onOpenSale(s.id)} />
            ))}
            <Pressable onPress={onSeeAllSales} style={({ pressed }) => [styles.footer, pressed && styles.pressed]} accessibilityRole="button">
              <Text style={styles.footerText}>See all sales</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </Pressable>
          </>
        )
      ) : payments.length === 0 ? (
        <EmptyState icon="wallet-outline" message="No payments received yet." />
      ) : (
        payments.map((p, i) => <PaymentItem key={p.id} payment={p} last={i === payments.length - 1} />)
      )}
    </View>
  );
}

function TabButton({
  label,
  count,
  icon,
  active,
  onPress,
}: {
  label: string;
  count: number;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tab, active && styles.tabActive]}
    >
      <Ionicons name={icon} size={18} color={active ? colors.primary : colors.textMuted} />
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
      <View style={[styles.count, active && styles.countActive]}>
        <Text style={[styles.countText, active && styles.countTextActive]}>{count}</Text>
      </View>
    </Pressable>
  );
}

function Avatar({ name, bg, fg }: { name: string; bg: string; fg: string }) {
  return (
    <View style={[styles.avatar, { backgroundColor: bg }]}>
      <Text style={[styles.avatarText, { color: fg }]}>{name.trim().charAt(0).toUpperCase() || '?'}</Text>
    </View>
  );
}

function SaleItem({ sale, last, onPress }: { sale: Sale; last: boolean; onPress: () => void }) {
  const name = sale.customer?.ownerName ?? 'Unknown customer';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.item, !last && styles.divider, pressed && styles.pressed]}>
      <Avatar name={name} bg={colors.salesBg} fg={colors.sales} />
      <View style={styles.middle}>
        <Text style={styles.title} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {formatDateShort(sale.saleDate)} · {formatKg(sale.weight)}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.amount}>{formatINR(sale.totalAmount)}</Text>
        <StatusBadge status={sale.status} />
      </View>
    </Pressable>
  );
}

function PaymentItem({ payment, last }: { payment: Payment; last: boolean }) {
  const online = payment.paymentMode === 'ONLINE';
  return (
    <View style={[styles.item, !last && styles.divider]}>
      <View style={[styles.avatar, { backgroundColor: online ? '#F4F3FF' : colors.receivedBg }]}>
        <Ionicons name={online ? 'phone-portrait-outline' : 'cash-outline'} size={20} color={online ? colors.online : colors.received} />
      </View>
      <View style={styles.middle}>
        <Text style={styles.title} numberOfLines={1}>
          {payment.customer?.ownerName ?? 'Unknown customer'}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {formatDateShort(payment.paymentDate)} · {online ? 'Online' : 'Cash'}
          {payment.source === 'SALE_ENTRY' ? ' · with sale' : ''}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: colors.received }]}>+{formatINR(payment.amount)}</Text>
        {payment.transactionReference ? (
          <Text style={styles.ref} numberOfLines={1}>
            Ref {payment.transactionReference}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: radius.md,
  },
  tabActive: {
    backgroundColor: colors.background,
    shadowColor: '#101828',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  tabText: { fontSize: font.label, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.text, fontWeight: '700' },
  count: { minWidth: 22, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.pill, backgroundColor: colors.border, alignItems: 'center' },
  countActive: { backgroundColor: colors.salesBg },
  countText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  countTextActive: { color: colors.primary },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.md },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  pressed: { backgroundColor: colors.surface },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: font.body + 1, fontWeight: '800' },
  middle: { flex: 1 },
  title: { fontSize: font.body, fontWeight: '700', color: colors.text },
  sub: { fontSize: font.small, color: colors.textMuted, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 4, maxWidth: '40%' },
  amount: { fontSize: font.body, fontWeight: '800', color: colors.text },
  ref: { fontSize: 12, color: colors.textMuted },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: { color: colors.primary, fontWeight: '700', fontSize: font.label },
});
