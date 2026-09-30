import React, { useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import InventoryEntryScreen from './src/screens/InventoryEntryScreen';
import InventoryListScreen from './src/screens/InventoryListScreen';
import InventoryExitScreen from './src/screens/InventoryExitScreen';
import MovementHistoryScreen from './src/screens/MovementHistoryScreen';
import CollaboratorScreen from './src/screens/CollaboratorScreen';
import LocationScreen from './src/screens/LocationScreen';
import UserManagementScreen from './src/screens/UserManagementScreen';
import InventoryReturnScreen from './src/screens/InventoryReturnScreen';
import InventoryMaintenanceScreen from './src/screens/InventoryMaintenanceScreen';
import ToolLifeCycleScreen from './src/screens/ToolLifeCycleScreen';
import BusinessLineScreen from './src/screens/BusinessLineScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { Colors } from './src/theme/colors';
import { StatusBar } from 'expo-status-bar';

const Navigation = () => {
  const { user, loading, initError } = useAuth();
  const [currentScreen, setCurrentScreen] = useState('dashboard');

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (initError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: Colors.background }}>
        <View style={{ backgroundColor: '#fff', padding: 25, borderRadius: 15, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 }}>
          <Text style={{ color: Colors.error, fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 }}>
            Error de Base de Datos
          </Text>
          <Text style={{ color: Colors.secondary, textAlign: 'center', marginBottom: 20 }}>
            {initError}
          </Text>
          <Text style={{ color: Colors.textSecondary, fontSize: 12, textAlign: 'center' }}>
            Por favor, cierre la aplicación y vuelva a intentarlo o contacte a soporte.
          </Text>
        </View>
      </View>
    );
  }

  if (!user) return <LoginScreen />;

  if (currentScreen === 'inventory_entry') {
    return <InventoryEntryScreen onBack={() => setCurrentScreen('dashboard')} />;
  }

  if (currentScreen === 'inventory_exit') {
    return <InventoryExitScreen onBack={() => setCurrentScreen('dashboard')} />;
  }

  if (currentScreen === 'inventory_list') {
    return <InventoryListScreen onBack={() => setCurrentScreen('dashboard')} />;
  }

  if (currentScreen === 'collaborators') {
    return <CollaboratorScreen onBack={() => setCurrentScreen('dashboard')} />;
  }

  if (currentScreen === 'locations') {
    return <LocationScreen onBack={() => setCurrentScreen('dashboard')} />;
  }

  if (currentScreen === 'movement_history') {
    return <MovementHistoryScreen onBack={() => setCurrentScreen('dashboard')} />;
  }

  if (currentScreen === 'business_lines') {
    return <BusinessLineScreen onBack={() => setCurrentScreen('dashboard')} />;
  }

  if (currentScreen === 'inventory_return') {
    return <InventoryReturnScreen onBack={() => setCurrentScreen('dashboard')} />;
  }

  if (currentScreen === 'maintenance') {
    return <InventoryMaintenanceScreen onBack={() => setCurrentScreen('dashboard')} />;
  }

  if (currentScreen === 'lifecycle') {
    return <ToolLifeCycleScreen onBack={() => setCurrentScreen('dashboard')} />;
  }

  if (currentScreen === 'settings') {
    return <SettingsScreen onBack={() => setCurrentScreen('dashboard')} />;
  }

  if (currentScreen === 'user_management' && user?.rol === 'admin') {
    return <UserManagementScreen onBack={() => setCurrentScreen('dashboard')} />;
  }

  return <DashboardScreen onNavigate={setCurrentScreen} />;
};

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Navigation />
    </AuthProvider>
  );
}
