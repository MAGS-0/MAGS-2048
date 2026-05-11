import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AdProvider } from './src/context/AdContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// We will import GameScreen here once recreated
// import GameScreen from './src/screens/GameScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AdProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {/* The stack will be empty until we add GameScreen back */}
          </Stack.Navigator>
        </NavigationContainer>
      </AdProvider>
    </GestureHandlerRootView>
  );
}