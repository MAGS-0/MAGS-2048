import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Modal, 
  Dimensions 
} from 'react-native';
import { saveUsername } from '../utils/storage'; // ADD THIS LINE

const { width } = Dimensions.get('window');

export default function UsernameModal({ visible, onSave }) {
  const [name, setName] = useState('');

  const handleSave = async () => { // ADD async
    if (name.trim().length > 2) {
      const trimmedName = name.trim();
      await saveUsername(trimmedName); // SAVE TO LOCAL STORAGE
      onSave(trimmedName); // SEND TO FIREBASE
      setName(''); // RESET FOR NEXT TIME
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>New High Score!</Text>
          <Text style={styles.subtitle}>Enter a name for the global leaderboard</Text>
          
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#9BA7B0"
            value={name}
            onChangeText={setName}
            maxLength={15}
            autoFocus
          />

          <TouchableOpacity 
            style={[styles.button, { opacity: name.trim().length > 2 ? 1 : 0.5 }]} 
            onPress={handleSave}
            disabled={name.trim().length <= 2}
          >
            <Text style={styles.buttonText}>SAVE NAME</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ... styles remain exactly the same

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width - 60,
    backgroundColor: '#faf8ef',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#776e65',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#9BA7B0',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: '#eee4da',
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 18,
    color: '#776e65',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#8f7a66',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});