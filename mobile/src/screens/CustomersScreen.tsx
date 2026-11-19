import { useLayoutEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '../api/client';
import { useCustomers } from '../api/hooks';
import { SuppliersList } from '../components/SuppliersList';
import { EmptyState, ErrorState, IconButton, Input, Loading, Segmented } from '../components/ui';
import type { RootScreenProps } from '../navigation/types';
import { colors, font, spacing } from '../theme';
import { formatINR } from '../utils/money';
import { useDebounced } from '../utils/useDebounced';
import { usePullToRefresh } from '../utils/usePullToRefresh';

type Section = 'customers' | 'suppliers';

/** Customers and suppliers in one place, switched with a two-way toggle at the top. */
export function CustomersScreen({ navigation, route }: RootScreenProps<'Customers'>) {
  const [section, setSection] = useState<Section>(route.params?.section ?? 'customers');

  useLayoutEffect(() => {
    const isSuppliers = section === 'suppliers';
    navigation.setOptions({
      title: isSuppliers ? 'Suppliers' : 'Customers',
      headerRight: () => (
        <IconButton
          icon="person-add-outline"
          label={isSuppliers ? 'Add supplier' : 'Add customer'}
          onPress={() => (isSuppliers ? navigation.navigate('SupplierForm', {}) : navigation.navigate('CustomerForm', {}))}
        />
      ),
    });
  }, [navigation, section]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.toggle}>
        <Segmented
          value={section}
          onChange={setSection}
          options={[
            { value: 'customers', label: 'Customers' },
            { value: 'suppliers', label: 'Suppliers' },
          ]}
        />
      </View>
      {section === 'customers' ? (
        <CustomersList onOpen={(id) => navigation.navigate('CustomerDetail', { id })} />
      ) : (
        <SuppliersList onOpen={(id) => navigation.navigate('SupplierDetail', { id })} />
      )}
    </View>
  );
}

function CustomersList({ onOpen }: { onOpen: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search.trim());
  const { data, isLoading, error, refetch } = useCustomers(debounced || undefined);
  const pull = usePullToRefresh(refetch);

  const totalDue = (data ?? []).reduce((s, c) => s + c.stats.outstandingBalance, 0);

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      data={data ?? []}
      keyExtractor={(c) => c.id}
      {...pull}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.header}>
          <Input value={search} onChangeText={setSearch} placeholder="Search name or phone" />
          {data && data.length > 0 && (
            <Text style={styles.summary}>
              {data.length} customer{data.length === 1 ? '' : 's'} · Total due{' '}
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
          <EmptyState icon="people-outline" message={debounced ? 'No customers match your search.' : 'No customers yet. Tap + to add one, or add one while entering a sale.'} />
        )
      }
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}
          onPress={() => onOpen(item.id)}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.ownerName}</Text>
            <Text style={styles.sub}>{item.phone || `${item.stats.salesCount} sales`}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.due, item.stats.outstandingBalance === 0 && { color: colors.received }]}>
              {item.stats.outstandingBalance > 0 ? formatINR(item.stats.outstandingBalance) : 'No dues'}
            </Text>
            {item.stats.outstandingBalance > 0 && <Text style={styles.sub}>due</Text>}
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  toggle: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  header: { padding: spacing.lg, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  summary: { color: colors.textMuted, fontSize: font.small },
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  name: { fontSize: font.body + 1, fontWeight: '700', color: colors.text },
  sub: { fontSize: font.small, color: colors.textMuted, marginTop: 2 },
  due: { fontSize: font.body + 1, fontWeight: '700', color: colors.due },
});
