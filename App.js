import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from './src/screens/HomeScreen';
import GameScreen from './src/screens/GameScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import { AdProvider } from './src/context/AdContext';

const Stack = createStackNavigator();

export default function App() {
  return (
    <AdProvider>
      <NavigationContainer>
        <Stack.Navigator 
          initialRouteName="Home"
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Game" component={GameScreen} />
          <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AdProvider>
  );
}