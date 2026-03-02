import React, { useEffect, useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Audio } from 'expo-av';
import { AppState } from 'react-native';

import HomeScreen from './src/screens/HomeScreen';
import LobbyScreen from './src/screens/LobbyScreen';
import GameScreen from './src/screens/GameScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Stack = createNativeStackNavigator();

import { View, StyleSheet, Platform, Dimensions } from 'react-native';

export default function App() {
  const [sound, setSound] = useState(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    let currentSound = null;

    async function playBackgroundMusic() {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false, // Don't enforce playing in background
          shouldDuckAndroid: true,
        });

        const { sound: newSound } = await Audio.Sound.createAsync(
          require('./assets/FREE DYSTINCT X TIF X CHAABI TYPE BEAT - ZINA (1).mp3'),
          { shouldPlay: true, isLooping: true, volume: 0.05 }
        );
        currentSound = newSound;
        setSound(newSound);
      } catch (error) {
        console.error("Erreur lors du chargement de la musique:", error);
      }
    }

    playBackgroundMusic();

    // AppState listener to handle background / foreground transitions
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground, resume music
        if (currentSound) {
          currentSound.playAsync();
        }
      } else if (nextAppState.match(/inactive|background/)) {
        // App went to the background, pause music
        if (currentSound) {
          currentSound.pauseAsync();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
      if (currentSound) {
        currentSound.unloadAsync();
      }
    };
  }, []);

  return (
    <View style={styles.appContainer}>
      <View style={styles.mobileContainer}>
        <NavigationContainer>
          <StatusBar style="light" />
          <Stack.Navigator
            initialRouteName="Home"
            screenOptions={{
              headerStyle: { backgroundColor: '#1C0F13' },
              headerTintColor: '#D4AF37',
              headerTitleStyle: { fontWeight: 'bold' },
            }}
          >
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Jeben Gere3' }} />
            <Stack.Screen name="Lobby" component={LobbyScreen} options={{ title: 'Salon Privé' }} />
            <Stack.Screen name="Game" component={GameScreen} options={{ title: 'Partie en cours', headerShown: false }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Mon Profil', headerShown: false }} />
          </Stack.Navigator>
        </NavigationContainer>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: '#000', // Black background for the outer web area
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 500, // Typical phone width
    maxHeight: Platform.OS === 'web' ? 900 : '100%', // Limit height on web
    backgroundColor: '#1C0F13',
    ...Platform.select({
      web: {
        borderWidth: 1,
        borderColor: '#D4AF37',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 0 20px rgba(212, 175, 55, 0.3)',
      }
    })
  }
});
