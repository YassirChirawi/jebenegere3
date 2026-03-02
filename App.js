import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Audio } from 'expo-av';

import HomeScreen from './src/screens/HomeScreen';
import LobbyScreen from './src/screens/LobbyScreen';
import GameScreen from './src/screens/GameScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [sound, setSound] = useState(null);

  useEffect(() => {
    let currentSound = null;

    async function playBackgroundMusic() {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
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

    return () => {
      if (currentSound) {
        currentSound.unloadAsync();
      }
    };
  }, []);

  return (
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
  );
}
