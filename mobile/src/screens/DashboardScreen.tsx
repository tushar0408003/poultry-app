import { Ionicons } from '@expo/vector-icons';
import { useLayoutEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { errorMessage } from '../api/client';
import { useDashboard } from '../api/hooks';
import { useAuth } from '../auth/AuthContext';
import { DateField } from '../components/DateField';
import { RecentActivity } from '../components/RecentActivity';
import { Screen } from '../components/Screen';
import { StatCard, StatGrid } from '../components/StatCard';
import { Button, ErrorState, IconButton, Loading, SectionTitle } from '../components/ui';
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
      headerLeft: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Customers and suppliers"
          hitSlop={8}
          onPress={() => navigation.navigate('Customers')}
          style={({ pressed }) => [styles.people, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="people" size={22} color={colors.primary} />
        </Pressable>
      ),
      headerRight: () => (
        <View style={{ flexDirection: 'row', marginRight: spacing.sm }}>
          <IconButton icon="key-outline" label="Change password" onPress={() => navigation.navigate('ChangePassword')} />
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

          <SectionTitle>Recent activity</SectionTitle>
          <RecentActivity
            sales={data.recentSales}
            payments={data.recentPayments}
            onOpenSale={(id) => navigation.navigate('SaleDetail', { id })}
            onSeeAllSales={() => navigation.navigate('Transactions')}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Tinted round button so it reads as tappable, with room before the title.
  people: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.salesBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.lg,
    marginRight: spacing.md,
  },
});
