import { useLayoutEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '../api/client';
import { useDashboard } from '../api/hooks';
import type { PeriodSummary } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { DateField } from '../components/DateField';
import { PaymentRow, SaleRow } from '../components/ledger';
import { Screen } from '../components/Screen';
import { StatCard, StatGrid } from '../components/StatCard';
import { Button, Card, Divider, EmptyState, ErrorState, IconButton, Loading, Row, SectionTitle } from '../components/ui';
import type { TabScreenProps } from '../navigation/types';
import { colors, spacing } from '../theme';
import { formatDate, todayString } from '../utils/dates';
import { formatINR, formatKg } from '../utils/money';

export function DashboardScreen({ navigation }: TabScreenProps<'Dashboard'>) {
  const { logout } = useAuth();
  const [date, setDate] = useState(todayString());
  const { data, isLoading, error, refetch, isRefetching } = useDashboard(date);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', marginRight: spacing.sm }}>
          <IconButton icon="people-outline" label="Customers" onPress={() => navigation.navigate('Customers')} />
          <IconButton
            icon="log-out-outline"
            label="Log out"
            onPress={() =>
              Alert.alert('Log out?', 'You will need your password to log in again.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Log out', style: 'destructive', onPress: () => void logout() },
              ])
            }
          />
        </View>
      ),
    });
  }, [navigation, logout]);

  const isToday = date === todayString();
  const dayWord = isToday ? "Today's" : formatDate(date);

  return (
    <Screen onRefresh={refetch} refreshing={isRefetching}>
      <DateField value={date} onChange={setDate} />
      <View style={{ height: spacing.lg }} />

      {isLoading ? (
        <Loading />
      ) : error || !data ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : (
        <>
          <StatGrid>
            <StatCard label={`${dayWord} weight sold`} value={formatKg(data.day.totalWeight)} icon="scale-outline" footnote={`${data.day.salesCount} sale${data.day.salesCount === 1 ? '' : 's'}`} />
            <StatCard label={`${dayWord} sales`} value={formatINR(data.day.totalSales)} tone="sales" icon="trending-up" />
            <StatCard label="Cash received" value={formatINR(data.day.cashReceived)} tone="received" icon="cash-outline" />
            <StatCard label="Online received" value={formatINR(data.day.onlineReceived)} tone="received" icon="phone-portrait-outline" />
            <StatCard label="Total received" value={formatINR(data.day.totalReceived)} tone="received" icon="wallet-outline" footnote="Includes old dues paid" />
            <StatCard
              label="Outstanding (all time)"
              value={formatINR(data.currentOutstanding.amount)}
              tone="due"
              icon="alert-circle-outline"
              footnote={`${data.currentOutstanding.customers} customer${data.currentOutstanding.customers === 1 ? '' : 's'}`}
            />
          </StatGrid>

          <View style={{ height: spacing.lg }} />
          <Button title="Add sale" icon="add" onPress={() => navigation.navigate('AddSale')} />

          <SectionTitle>This week</SectionTitle>
          <PeriodCard summary={data.week} />

          <SectionTitle>This month</SectionTitle>
          <PeriodCard summary={data.month} />

          <SectionTitle
            right={<Text style={styles.link} onPress={() => navigation.navigate('Transactions')}>See all</Text>}
          >
            Recent sales
          </SectionTitle>
          <Card style={styles.listCard}>
            {data.recentSales.length === 0 ? (
              <EmptyState message="No sales yet. Tap “Add sale” to record your first sale." />
            ) : (
              data.recentSales.map((s) => (
                <SaleRow key={s.id} sale={s} onPress={() => navigation.navigate('SaleDetail', { id: s.id })} />
              ))
            )}
          </Card>

          {data.recentPayments.length > 0 && (
            <>
              <SectionTitle>Recent payments</SectionTitle>
              <Card style={{ paddingVertical: 0 }}>
                {data.recentPayments.map((p) => (
                  <PaymentRow key={p.id} payment={p} showCustomer />
                ))}
              </Card>
            </>
          )}
        </>
      )}
    </Screen>
  );
}

function PeriodCard({ summary }: { summary: PeriodSummary }) {
  return (
    <Card>
      <Text style={styles.period}>
        {formatDate(summary.from)} – {formatDate(summary.to)}
      </Text>
      <Row label="Weight sold" value={formatKg(summary.sales.totalWeight)} />
      <Row label="Sales" value={formatINR(summary.sales.totalAmount)} color={colors.sales} />
      <Divider />
      <Row label="Cash collected" value={formatINR(summary.collections.cash)} color={colors.received} />
      <Row label="Online collected" value={formatINR(summary.collections.online)} color={colors.received} />
      <Row label="Total collected" value={formatINR(summary.collections.total)} color={colors.received} bold />
    </Card>
  );
}

const styles = StyleSheet.create({
  link: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  listCard: { padding: 0, overflow: 'hidden' },
  period: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.xs },
});
