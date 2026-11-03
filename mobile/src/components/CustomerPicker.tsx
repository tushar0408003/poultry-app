import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { errorMessage } from '../api/client';
import { useCreateCustomer, useCustomers } from '../api/hooks';
import type { CustomerSummary } from '../api/types';
import { colors, font, radius, spacing, touch } from '../theme';
import { formatINR } from '../utils/money';
import { useDebounced } from '../utils/useDebounced';
import { Banner, IconButton, Input } from './ui';

/**
 * Select a shop with search, or add a new one by just typing its name —
 * so a sale for a new customer still takes only a few seconds.
 */
export function CustomerPicker({
  value,
  onChange,
  error,
  placeholder = 'Select shop',
}: {
  value: CustomerSummary | null;
  onChange: (c: CustomerSummary | null) => void;
  error?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const { data, isFetching, error: loadError } = useCustomers(open ? debounced : undefined);
  const createCustomer = useCreateCustomer();

  const typed = search.trim();
  const exactMatch = data?.some((c) => c.shopName.toLowerCase() === typed.toLowerCase());

  const select = (c: CustomerSummary | null) => {
    onChange(c);
    setOpen(false);
    setSearch('');
    createCustomer.reset();
  };

  const addNew = async () => {
    try {
      const c = await createCustomer.mutateAsync({ shopName: typed });
      select(c);
    } catch {
      // error shown below via createCustomer.error
    }
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={value ? `Customer: ${value.shopName}. Tap to change` : placeholder}
        onPress={() => setOpen(true)}
        style={[styles.box, error && { borderColor: colors.danger }]}
      >
        <Ionicons name="storefront-outline" size={20} color={colors.primary} />
        <Text style={[styles.boxText, !value && { color: colors.textMuted, fontWeight: '400' }]} numberOfLines={1}>
          {value ? value.shopName : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Select shop</Text>
            <IconButton icon="close" label="Close" onPress={() => setOpen(false)} />
          </View>
          <Input
            autoFocus
            placeholder="Search or type a new shop name"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="words"
            returnKeyType="search"
          />

          {createCustomer.error && <View style={{ marginTop: spacing.md }}><Banner tone="error" message={errorMessage(createCustomer.error)} /></View>}
          {loadError && <View style={{ marginTop: spacing.md }}><Banner tone="error" message={errorMessage(loadError)} /></View>}

          {typed.length > 0 && !exactMatch && (
            <Pressable style={styles.addRow} onPress={addNew} disabled={createCustomer.isPending}>
              {createCustomer.isPending ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Ionicons name="add-circle" size={24} color={colors.primary} />
              )}
              <Text style={styles.addText}>Add new shop “{typed}”</Text>
            </Pressable>
          )}

          <FlatList
            data={data ?? []}
            keyExtractor={(c) => c.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              isFetching ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : <Text style={styles.empty}>No shops found</Text>
            }
            renderItem={({ item }) => (
              <Pressable style={[styles.item, value?.id === item.id && styles.itemActive]} onPress={() => select(item)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.shopName}</Text>
                  {(item.ownerName || item.phone) && (
                    <Text style={styles.itemSub}>{[item.ownerName, item.phone].filter(Boolean).join(' · ')}</Text>
                  )}
                </View>
                {item.stats.outstandingBalance > 0 && (
                  <Text style={styles.due}>Due {formatINR(item.stats.outstandingBalance)}</Text>
                )}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
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
  },
  boxText: { flex: 1, fontSize: font.body + 1, color: colors.text, marginLeft: spacing.sm, fontWeight: '600' },
  modal: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  headerTitle: { fontSize: font.title, fontWeight: '700', color: colors.text },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.salesBg,
    borderRadius: radius.md,
  },
  addText: { marginLeft: spacing.sm, fontSize: font.body, fontWeight: '700', color: colors.primary, flex: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemActive: { backgroundColor: colors.surface },
  itemTitle: { fontSize: font.body + 1, fontWeight: '600', color: colors.text },
  itemSub: { fontSize: font.small, color: colors.textMuted, marginTop: 2 },
  due: { fontSize: font.small, fontWeight: '700', color: colors.due },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl },
});
