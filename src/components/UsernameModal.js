import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Modal, 
  Dimensions,
  Image,
  ScrollView,
} from 'react-native';
import Button3D from '../components/Button3D';
import { saveUsername, saveUserAvatar } from '../utils/storage';

const { width, height } = Dimensions.get('window');

const AVAILABLE_AVATARS = [
  { id: 'avatar_1', source: require('../assets/avatar1.png'), label: 'Avatar 1' },
  { id: 'avatar_2', source: require('../assets/avatar2.png'), label: 'Avatar 2' },
  { id: 'avatar_3', source: require('../assets/avatar3.png'), label: 'Avatar 3' },
  { id: 'avatar_4', source: require('../assets/avatar4.png'), label: 'Avatar 4' },
  { id: 'avatar_5', source: require('../assets/avatar5.png'), label: 'Avatar 5' },
  { id: 'avatar_6', source: require('../assets/avatar6.png'), label: 'Avatar 6' },
  { id: 'avatar_7', source: require('../assets/avatar7.png'), label: 'Avatar 7' },
  { id: 'avatar_8', source: require('../assets/avatar8.png'), label: 'Avatar 8' },
  { id: 'avatar_9', source: require('../assets/avatar9.png'), label: 'Avatar 9' },
  { id: 'avatar_10', source: require('../assets/avatar10.png'), label: 'Avatar 10' },
  { id: 'avatar_11', source: require('../assets/avatar11.png'), label: 'Avatar 11' },
  { id: 'avatar_12', source: require('../assets/avatar12.png'), label: 'Avatar 12' },
  { id: 'avatar_13', source: require('../assets/avatar13.png'), label: 'Avatar 13' },
  { id: 'avatar_14', source: require('../assets/avatar14.png'), label: 'Avatar 14' },
  { id: 'avatar_15', source: require('../assets/avatar15.png'), label: 'Avatar 15' },
];

export default function UsernameModal({ visible, onSave, initialName = '', initialAvatar = 'avatar_1' }) {
  const [name, setName] = useState(initialName || '');
  const [selectedAvatar, setSelectedAvatar] = useState(initialAvatar || 'avatar_1');

  useEffect(() => {
    if (visible) {
      setName(initialName || '');
      setSelectedAvatar(initialAvatar || 'avatar_1');
    }
  }, [visible, initialName, initialAvatar]);

  const handleSave = async () => {
    if (name.trim().length > 2) {
      const trimmedName = name.trim();
      
      await saveUsername(trimmedName);
      await saveUserAvatar(selectedAvatar);
      
      onSave(trimmedName, selectedAvatar);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>Give Your Profile a Name!</Text>
          <Text style={styles.subtitle}>Enter a name and choose your profile picture</Text>
          
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.avatarScrollContent}
          >
            {AVAILABLE_AVATARS.map((avatar) => {
              const isSelected = avatar.id === selectedAvatar;
              return (
                <TouchableOpacity
                  key={avatar.id}
                  style={[styles.avatarWrapper, isSelected && styles.avatarWrapperSelected]}
                  onPress={() => setSelectedAvatar(avatar.id)}
                  activeOpacity={0.7}
                >
                  <Image source={avatar.source} style={styles.avatarImage} />
                  {isSelected && (
                    <View style={styles.selectedCheckBadge}>
                      <Text style={styles.checkText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <Text style={styles.avatarScrollHint}>Swipe to see more avatars →</Text>

          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#9BA7B0"
            value={name}
            onChangeText={setName}
            maxLength={15}
            autoFocus
          />

          <Button3D 
            style={[styles.button, styles.elevated, { opacity: name.trim().length > 2 ? 1 : 0.9 }]} 
            onPress={handleSave}
            disabled={name.trim().length <= 2}
          >
            <Text style={styles.buttonText}>SAVE</Text>
          </Button3D>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width - 40,
    backgroundColor: '#faf8ef',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    maxHeight: height * 0.78,
    overflow: 'hidden',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#776e65',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#9BA7B0',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  avatarScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingRight: 26,
    marginBottom: 8,
  },
  avatarScrollHint: {
    width: '100%',
    textAlign: 'right',
    color: '#9BA7B0',
    fontSize: 11,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  avatarWrapper: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#eee4da',
    padding: 4,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
    marginRight: 14,
  },
  avatarWrapperSelected: {
    borderColor: '#e1b024',
    backgroundColor: '#f2b179',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    resizeMode: 'cover',
  },
  selectedCheckBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#e1b024',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#faf8ef',
  },
  checkText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#776e65',
    borderWidth: 2,
    borderColor: '#eee4da',
    marginBottom: 20,
  },
  button: {
    width: '100%',
    height: 50,
    backgroundColor: '#8f7a66',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  elevated: {
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});


// import React, { useState } from 'react';
// import { 
//   StyleSheet, 
//   View, 
//   Text, 
//   TextInput, 
//   TouchableOpacity, 
//   Modal, 
//   Dimensions 
// } from 'react-native';
// import { saveUsername } from '../utils/storage'; // ADD THIS LINE

// const { width } = Dimensions.get('window');

// export default function UsernameModal({ visible, onSave }) {
//   const [name, setName] = useState('');

//   const handleSave = async () => { // ADD async
//     if (name.trim().length > 2) {
//       const trimmedName = name.trim();
//       await saveUsername(trimmedName); // SAVE TO LOCAL STORAGE
//       onSave(trimmedName); // SEND TO FIREBASE
//       setName(''); // RESET FOR NEXT TIME
//     }
//   };

//   return (
//     <Modal visible={visible} transparent animationType="fade">
//       <View style={styles.overlay}>
//         <View style={styles.modalContainer}>
//           <Text style={styles.title}>New High Score!</Text>
//           <Text style={styles.subtitle}>Enter a name for the global leaderboard</Text>
          
//           <TextInput
//             style={styles.input}
//             placeholder="Username"
//             placeholderTextColor="#9BA7B0"
//             value={name}
//             onChangeText={setName}
//             maxLength={15}
//             autoFocus
//           />

//           <TouchableOpacity 
//             style={[styles.button, { opacity: name.trim().length > 2 ? 1 : 0.5 }]} 
//             onPress={handleSave}
//             disabled={name.trim().length <= 2}
//           >
//             <Text style={styles.buttonText}>SAVE NAME</Text>
//           </TouchableOpacity>
//         </View>
//       </View>
//     </Modal>
//   );
// }

// // ... styles remain exactly the same

// const styles = StyleSheet.create({
//   overlay: {
//     flex: 1,
//     backgroundColor: 'rgba(0,0,0,0.5)',
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   modalContainer: {
//     width: width - 60,
//     backgroundColor: '#faf8ef',
//     borderRadius: 20,
//     padding: 25,
//     alignItems: 'center',
//     elevation: 10,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.3,
//     shadowRadius: 4,
//   },
//   title: {
//     fontSize: 24,
//     fontWeight: 'bold',
//     color: '#776e65',
//     marginBottom: 10,
//   },
//   subtitle: {
//     fontSize: 14,
//     color: '#9BA7B0',
//     textAlign: 'center',
//     marginBottom: 20,
//   },
//   input: {
//     width: '100%',
//     height: 50,
//     backgroundColor: '#eee4da',
//     borderRadius: 10,
//     paddingHorizontal: 15,
//     fontSize: 18,
//     color: '#776e65',
//     marginBottom: 20,
//   },
//   button: {
//     backgroundColor: '#8f7a66',
//     paddingVertical: 12,
//     paddingHorizontal: 30,
//     borderRadius: 25,
//   },
//   buttonText: {
//     color: '#ffffff',
//     fontWeight: 'bold',
//     fontSize: 16,
//   },
// });