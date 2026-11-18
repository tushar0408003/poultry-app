import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '../api/client';
import { useSuppliers } from '../api/hooks';
import { colors, font, spacing } from '../theme';
import { formatINR, formatKg } from '../utils/money';
import { useDebounced } from '../utils/useDebounced';
import { EmptyState, ErrorState, Input, Loading } from './ui';

/** Searchable supplier list: rate, weight and balance owed. Used as the Suppliers section of the Customers screen. */
export function SuppliersList({ onOpen }: { onOpen: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search.trim());
  const { data, isLoading, error, refetch, isRefetching } = useSuppliers(debounced || undefined);

  const totalDue = (data ?? []).reduce((s, x) => s + x.stats.balance, 0);

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      data={data ?? []}
      keyExtractor={(s) => s.id}
      refreshing={isRefetching}
      onRefresh={refetch}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.header}>
          <Input value={search} onChangeText={setSearch} placeholder="Search name or phone" />
          {data && data.length > 0 && (
            <Text style={styles.summary}>
              {data.length} supplier{data.length === 1 ? '' : 's'} · Total to pay{' '}
              <Text style={{ color: colors.due, fontWeight: '700' }}>{formatINR(totalDue)}</Text>
            </Text>
          )}
        </View>
      }
      ListEmptyComponent={
        isLoading ? (
          <Loading />
        ) : error ? (
          <ErrorState message={errorMessage(error)} onRetry={refetch} />
        ) : (
          <EmptyState icon="cube-outline" message={debounced ? 'No suppliers match your search.' : 'No suppliers yet. Tap + to add one.'} />
        )
      }
      renderItem={({ item }) => (
        <Pressable style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]} onPress={() => onOpen(item.id)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.ownerName}</Text>
            <Text style={styles.sub}>
              {formatINR(item.rate)}/kg · {formatKg(item.weight)}
              {item.phone ? ` · ${item.phone}` : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.due, item.stats.balance <= 0 && { color: colors.received }]}>
              {item.stats.balance === 0 ? 'No dues' : formatINR(Math.abs(item.stats.balance))}
            </Text>
            {item.stats.balance !== 0 && <Text style={styles.sub}>{item.stats.balance > 0 ? 'to pay' : 'advance'}</Text>}
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  summary: { color: colors.textMuted, fontSize: font.small },
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  name: { fontSize: font.body + 1, fontWeight: '700', color: colors.text },
  sub: { fontSize: font.small, color: colors.textMuted, marginTop: 2 },
  due: { fontSize: font.body + 1, fontWeight: '700', color: colors.due },
});
