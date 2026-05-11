import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AdProvider } from './src/context/AdContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import HomeScreen from './src/screens/HomeScreen';
import GameScreen from './src/screens/GameScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AdProvider>
        <NavigationContainer>
          <Stack.Navigator 
            initialRouteName="Home" 
            screenOptions={{ headerShown: false }}
          >
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Game" component={GameScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </AdProvider>
    </GestureHandlerRootView>
  );
}