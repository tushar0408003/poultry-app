import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { Loading } from '../components/ui';
import { AddPaymentScreen } from '../screens/AddPaymentScreen';
import { AddSaleScreen } from '../screens/AddSaleScreen';
import { CollectPaymentScreen } from '../screens/CollectPaymentScreen';
import { CustomerDetailScreen } from '../screens/CustomerDetailScreen';
import { CustomerFormScreen } from '../screens/CustomerFormScreen';
import { CustomersScreen } from '../screens/CustomersScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { EditSaleScreen } from '../screens/EditSaleScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { SaleDetailScreen } from '../screens/SaleDetailScreen';
import { TransactionsScreen } from '../screens/TransactionsScreen';
import { colors } from '../theme';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ICONS: Record<keyof TabParamList, keyof typeof Ionicons.glyphMap> = {
  Dashboard: 'home',
  AddSale: 'add-circle',
  Transactions: 'list',
  Reports: 'bar-chart',
};

function MainTabs() {
  // A fixed tabBar height drops the system nav-bar inset, so add it back.
  const { bottom } = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
        tabBarStyle: { height: 64 + bottom, paddingTop: 6, paddingBottom: bottom },
        headerTitleStyle: { fontSize: 20, fontWeight: '700' },
        headerShadowVisible: false,
        tabBarIcon: ({ color, focused }) => (
          <Ionicons
            name={focused ? TAB_ICONS[route.name] : (`${TAB_ICONS[route.name]}-outline` as keyof typeof Ionicons.glyphMap)}
            size={26}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="AddSale" component={AddSaleScreen} options={{ title: 'Add Sale' }} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="Reports" component={ReportsScreen} />
    </Tab.Navigator>
  );
}

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background, primary: colors.primary } };

export function RootNavigator() {
  const { status } = useAuth();
  if (status === 'loading') return <Loading />;

  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator screenOptions={{ headerShadowVisible: false, headerTitleStyle: { fontWeight: '700' } }}>
        {status === 'signedOut' ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="SaleDetail" component={SaleDetailScreen} options={{ title: 'Sale details' }} />
            <Stack.Screen name="EditSale" component={EditSaleScreen} options={{ title: 'Edit sale' }} />
            <Stack.Screen name="AddPayment" component={AddPaymentScreen} options={{ title: 'Add payment' }} />
            <Stack.Screen name="Customers" component={CustomersScreen} />
            <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} options={{ title: 'Customer' }} />
            <Stack.Screen name="CustomerForm" component={CustomerFormScreen} options={{ title: 'Customer' }} />
            <Stack.Screen name="CollectPayment" component={CollectPaymentScreen} options={{ title: 'Receive payment' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
