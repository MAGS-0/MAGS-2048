import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { fetchLeaderboard, fetchUserRank } from '../utils/firebase';
import { getUsername } from '../utils/storage';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function LeaderboardScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [currentUsername, setCurrentUsername] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // 1. Get local username
      const name = await getUsername();
      setCurrentUsername(name);

      // 2. Fetch Global Leaderboard
      const data = await fetchLeaderboard('4x4');
      setLeaderboard(data || []);

      // 3. Fetch specific user rank if name exists
      if (name) {
        const rankData = await fetchUserRank(name, '4x4');
        setUserRank(rankData);
      }
    } catch (error) {
      console.error("Leaderboard Load Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item, index }) => {
    const isMe = currentUsername && item.username === currentUsername;
    const rank = index + 1;

    return (
      <View style={[styles.row, isMe && styles.myRow]}>
        <View style={styles.rankContainer}>
          <Text style={styles.rankText}>
            {rank === 1 ? '👑1' : rank === 2 ? '👑2' : rank === 3 ? '👑3' : rank}
          </Text>
        </View>
        <Text style={[styles.nameText, isMe && styles.myNameText]} numberOfLines={1}>
          {item.username} {isMe ? "(You)" : ""}
        </Text>
        <Text style={styles.scoreText}>{item.score}</Text>
      </View>
    );
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="close" size={30} color="#776e65" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>LEADERBOARD</Text>
          <TouchableOpacity onPress={loadData} style={styles.backButton}>
            <Ionicons name="refresh" size={24} color="#776e65" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#8f7a66" />
            <Text style={styles.loadingText}>Loading Scores...</Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <FlatList
              data={leaderboard}
              renderItem={renderItem}
              keyExtractor={(item, index) => `rank-${index}`}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No scores yet. Be the first!</Text>
              }
            />
            
            {userRank && (
              <View style={styles.stickyFooter}>
                <View style={[styles.row, styles.myStickyRow]}>
                  <View style={styles.rankContainer}>
                    <Text style={styles.rankTextWhite}>#{userRank.rank}</Text>
                  </View>
                  <Text style={styles.nameTextWhite} numberOfLines={1}>
                    {userRank.username} (You)
                  </Text>
                  <Text style={styles.scoreTextWhite}>{userRank.score}</Text>
                </View>
              </View>
            )}
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf8ef' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee4da'
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#776e65' },
  backButton: { padding: 5 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#776e65', fontWeight: '500' },
  listContent: { paddingHorizontal: 20, paddingTop: 15, paddingBottom: 120 },
  row: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#eee4da', 
    padding: 15, 
    borderRadius: 10, 
    marginBottom: 10 
  },
  myRow: {
    backgroundColor: '#ede0c8',
    borderWidth: 2,
    borderColor: '#8f7a66'
  },
  rankContainer: { width: 55 },
  rankText: { fontSize: 18, fontWeight: 'bold', color: '#776e65' },
  rankTextWhite: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  nameText: { flex: 1, fontSize: 17, color: '#776e65', fontWeight: '600' },
  nameTextWhite: { flex: 1, fontSize: 17, color: '#fff', fontWeight: 'bold' },
  myNameText: { color: '#8f7a66' },
  scoreText: { fontSize: 18, fontWeight: 'bold', color: '#776e65' },
  scoreTextWhite: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#776e65' },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#faf8ef',
    padding: 15,
    borderTopWidth: 2,
    borderTopColor: '#bbada0'
  },
  myStickyRow: {
    backgroundColor: '#8f7a66',
    marginBottom: 0,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  }
});