import { useCallback, useState } from 'react';

/**
 * Spinner state for pull-to-refresh that only reflects the user's own pull,
 * so background refetches (e.g. on tab switch) update data silently.
 */
export function usePullToRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);
  return { refreshing, onRefresh };
}
