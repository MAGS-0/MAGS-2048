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
      
      // 1. Get and Log Local Name
      const rawName = await getUsername();
      // const rawName = "Sum";
      const cleanName = rawName ? rawName.trim() : null;
      setCurrentUsername(cleanName);
      
      console.log("DEBUG: Local Username found is:", `"${cleanName}"`);

      // 2. Fetch Leaderboard
      const data = await fetchLeaderboard('4x4');
      setLeaderboard(data || []);
      
      if (data && data.length > 0) {
        console.log("DEBUG: First name in DB is:", `"${data[0].username}"`);
      }

      // 3. Fetch specific user rank
      if (cleanName) {
        const rankData = await fetchUserRank(cleanName, '4x4');
        setUserRank(rankData);
        console.log("DEBUG: User Rank Data:", rankData);
      }
    } catch (error) {
      console.error("Leaderboard Load Error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Helper to check if two names match regardless of case or spaces
  const isMatch = (dbName) => {
    if (!currentUsername || !dbName) return false;
    return dbName.trim().toLowerCase() === currentUsername.toLowerCase();
  };

  const renderPodiumItem = (item, rank) => {
    if (!item) return <View style={styles.podiumColumn} />;
    const me = isMatch(item.username);
    
    return (
      <View style={[styles.podiumColumn, rank === 1 ? styles.firstPlace : {}]}>
        <View style={[styles.avatarContainer, me && styles.myAvatar]}>
           <Text style={styles.podiumEmoji}>{rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}</Text>
        </View>
        <Text style={[styles.podiumName, me && styles.myNameText]} numberOfLines={1}>
          {item.username} {me ? "(You)" : ""}
        </Text>
        <View style={styles.podiumScoreBadge}>
          <Text style={styles.podiumScoreText}>{item.score}</Text>
        </View>
        <View style={[styles.podiumStep, { height: rank === 1 ? 80 : rank === 2 ? 60 : 40 }]}>
          <Text style={styles.stepNumber}>{rank}</Text>
        </View>
      </View>
    );
  };

  const renderItem = ({ item, index }) => {
    if (index < 3) return null;
    const me = isMatch(item.username);
    const rank = index + 1;

    return (
      <View style={[styles.row, me && styles.myRow]}>
        <View style={styles.rankContainer}>
          <Text style={styles.rankText}>{rank}</Text>
        </View>
        <Text style={[styles.nameText, me && styles.myNameText]} numberOfLines={1}>
          {item.username} {me ? "(You)" : ""}
        </Text>
        <Text style={styles.scoreText}>{item.score}</Text>
      </View>
    );
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
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
          <View style={styles.center}><ActivityIndicator size="large" color="#8f7a66" /></View>
        ) : (
          <View style={{ flex: 1 }}>
            <FlatList
              data={leaderboard}
              renderItem={renderItem}
              keyExtractor={(item, index) => `rank-${index}`}
              contentContainerStyle={styles.listContent}
              ListHeaderComponent={() => (
                <View style={styles.podiumContainer}>
                  {renderPodiumItem(leaderboard[1], 2)}
                  {renderPodiumItem(leaderboard[0], 1)}
                  {renderPodiumItem(leaderboard[2], 3)}
                </View>
              )}
            />
            
            {/* Show footer if rank > 10 OR if you aren't in the top 10 names list */}
            {userRank && (userRank.rank > 10) && (
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#776e65' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 150 },
  podiumContainer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', marginVertical: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#eee4da' },
  podiumColumn: { alignItems: 'center', width: width * 0.28 },
  firstPlace: { transform: [{ translateY: -15 }] },
  avatarContainer: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#eee4da', justifyContent: 'center', alignItems: 'center', marginBottom: 5, borderWidth: 2, borderColor: '#bbada0' },
  myAvatar: { borderColor: '#8f7a66', borderWidth: 3 },
  podiumEmoji: { fontSize: 30 },
  podiumName: { fontSize: 13, fontWeight: 'bold', color: '#776e65', marginBottom: 5 },
  podiumScoreBadge: { backgroundColor: '#8f7a66', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 12, marginBottom: 10 },
  podiumScoreText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  podiumStep: { width: '90%', backgroundColor: '#bbada0', borderTopLeftRadius: 8, borderTopRightRadius: 8, justifyContent: 'center', alignItems: 'center' },
  stepNumber: { fontSize: 22, fontWeight: 'bold', color: 'rgba(255,255,255,0.5)' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eee4da', padding: 15, borderRadius: 10, marginBottom: 10 },
  myRow: { backgroundColor: '#ede0c8', borderWidth: 2, borderColor: '#8f7a66' },
  rankContainer: { width: 45 },
  rankText: { fontSize: 16, fontWeight: 'bold', color: '#776e65' },
  rankTextWhite: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  nameText: { flex: 1, fontSize: 16, color: '#776e65', fontWeight: '600' },
  nameTextWhite: { flex: 1, fontSize: 16, color: '#fff', fontWeight: 'bold' },
  myNameText: { color: '#8f7a66', fontWeight: 'bold' },
  scoreText: { fontSize: 16, fontWeight: 'bold', color: '#776e65' },
  scoreTextWhite: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  stickyFooter: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#faf8ef', padding: 20, borderTopWidth: 2, borderTopColor: '#bbada0' },
  myStickyRow: { backgroundColor: '#8f7a66', marginBottom: 0, elevation: 5 }
});