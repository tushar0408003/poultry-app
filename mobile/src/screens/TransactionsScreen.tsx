import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '../api/client';
import { useSalesInfinite } from '../api/hooks';
import type { CustomerSummary, PaymentStatus } from '../api/types';
import { CustomerPicker } from '../components/CustomerPicker';
import { DateField } from '../components/DateField';
import { SaleRow } from '../components/ledger';
import { Chip, EmptyState, ErrorState, Input, Loading } from '../components/ui';
import type { TabScreenProps } from '../navigation/types';
import { colors, font, spacing } from '../theme';
import { todayString } from '../utils/dates';
import { useDebounced } from '../utils/useDebounced';

const STATUS_OPTIONS: { value: PaymentStatus | undefined; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'UNPAID', label: 'Unpaid' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'PAID', label: 'Paid' },
];

export function TransactionsScreen({ navigation }: TabScreenProps<'Transactions'>) {
  const [search, setSearch] = useState('');
  const [date, setDate] = useState<string | undefined>();
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [status, setStatus] = useState<PaymentStatus | undefined>();
  const debouncedSearch = useDebounced(search.trim());

  const query = useMemo(
    () => ({ search: debouncedSearch || undefined, date, customerId: customer?.id, status }),
    [debouncedSearch, date, customer, status],
  );
  const { data, isLoading, error, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSalesInfinite(query);
  const sales = data?.pages.flatMap((p) => p.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;
  const hasFilters = !!(debouncedSearch || date || customer || status);

  const header = (
    <View style={styles.filters}>
      <Input value={search} onChangeText={setSearch} placeholder="Search customer name or phone" returnKeyType="search" clearButtonMode="while-editing" />
      <View style={styles.filterRow}>
        <View style={{ flex: 1 }}>
          {date ? (
            <View style={styles.inline}>
              <View style={{ flex: 1 }}>
                <DateField value={date} onChange={setDate} compact />
              </View>
              <ClearButton onPress={() => setDate(undefined)} />
            </View>
          ) : (
            <Chip label="Filter by date" onPress={() => setDate(todayString())} />
          )}
        </View>
      </View>
      <View style={styles.inline}>
        <View style={{ flex: 1 }}>
          <CustomerPicker value={customer} onChange={setCustomer} placeholder="All customers" />
        </View>
        {customer && <ClearButton onPress={() => setCustomer(null)} />}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.md }}>
        {STATUS_OPTIONS.map((o) => (
          <Chip key={o.label} label={o.label} active={status === o.value} onPress={() => setStatus(o.value)} />
        ))}
      </ScrollView>
      {!isLoading && !error && (
        <Text style={styles.count}>
          {total} sale{total === 1 ? '' : 's'}
          {hasFilters ? ' found' : ''}
        </Text>
      )}
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      data={sales}
      keyExtractor={(s) => s.id}
      ListHeaderComponent={header}
      renderItem={({ item }) => (
        <SaleRow
          sale={item}
          onPress={() => navigation.navigate('SaleDetail', { id: item.id })}
          onEdit={() => navigation.navigate('EditSale', { id: item.id })}
        />
      )}
      onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
      onEndReachedThreshold={0.4}
      refreshing={isRefetching && !isFetchingNextPage}
      onRefresh={refetch}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={
        isLoading ? (
          <Loading />
        ) : error ? (
          <ErrorState message={errorMessage(error)} onRetry={refetch} />
        ) : (
          <EmptyState message={hasFilters ? 'No sales match these filters.' : 'No sales recorded yet.'} />
        )
      }
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={{ margin: spacing.lg }} /> : undefined}
    />
  );
}

function ClearButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.clear} accessibilityLabel="Clear filter" hitSlop={8}>
      <Text style={styles.clearText}>Clear</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filters: { padding: spacing.lg, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  filterRow: { flexDirection: 'row' },
  inline: { flexDirection: 'row', alignItems: 'center' },
  clear: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  clearText: { color: colors.primary, fontWeight: '700', fontSize: font.body },
  count: { color: colors.textMuted, fontSize: font.small },
});
