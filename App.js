import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppState, View, StyleSheet, Platform, useWindowDimensions } from 'react-native';

import HomeScreen from './src/screens/HomeScreen';
import LobbyScreen from './src/screens/LobbyScreen';
import GameScreen from './src/screens/GameScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import audioService from './src/network/audioService';
import { DialogHost } from './src/components/Dialog';
import { theme } from './src/components/ui';

const Stack = createNativeStackNavigator();

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: theme.bg, card: theme.bg, primary: theme.gold, text: theme.gold, border: 'rgba(212,175,55,0.3)' },
};

export default function App() {
  const appState = useRef(AppState.currentState);
  const { width, height } = useWindowDimensions();
  // Web sur téléphone tenu en paysage : on utilise tout l'écran au lieu du cadre portrait
  const webLandscapePhone = Platform.OS === 'web' && width > height && height < 600;

  useEffect(() => {
    // Musique d'ambiance (gérée par audioService : mute, volume menu/jeu, autoplay web)
    audioService.ready.then(() => audioService.startMusic('menu'));

    const subscription = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        audioService.resumeMusic();
      } else if (next.match(/inactive|background/)) {
        audioService.pauseMusic();
        audioService.stopTickTock();
      }
      appState.current = next;
    });

    return () => subscription.remove();
  }, []);

  return (
    <View style={styles.appContainer}>
      <View style={[styles.mobileContainer, webLandscapePhone && styles.fullScreen]}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <NavigationContainer theme={navTheme}>
            <StatusBar style="light" />
            <Stack.Navigator
              initialRouteName="Home"
              screenOptions={{
                headerStyle: { backgroundColor: theme.bg },
                headerTintColor: theme.gold,
                headerTitleStyle: { fontWeight: '900' },
                headerShadowVisible: false,
                contentStyle: { backgroundColor: theme.bg },
                animation: 'fade',
              }}
            >
              <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Jeben Gere3', headerShown: false }} />
              <Stack.Screen name="Lobby" component={LobbyScreen} options={{ title: 'Salon Privé', headerShown: false }} />
              <Stack.Screen name="Game" component={GameScreen} options={{ title: 'Partie en cours', headerShown: false, gestureEnabled: false }} />
              <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Mon Profil', headerShown: false }} />
            </Stack.Navigator>
          </NavigationContainer>
          <DialogHost />
        </GestureHandlerRootView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    maxWidth: '100%',
    maxHeight: '100%',
    borderWidth: 0,
    borderRadius: 0,
  },
  appContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 500,
    maxHeight: Platform.OS === 'web' ? 920 : '100%',
    backgroundColor: theme.bg,
    ...Platform.select({
      web: {
        borderWidth: 1,
        borderColor: theme.gold,
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 0 40px rgba(212, 175, 55, 0.25)',
      },
    }),
  },
});
