import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { useAds } from '../context/AdContext';
import { fetchLeaderboard, fetchUserRank } from '../utils/firebase';
import { getUsername, getUserId } from '../utils/storage';
import Button3D from '../components/Button3D';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const AVATAR_SOURCES = {
  avatar_1: require('../assets/avatar1.png'),
  avatar_2: require('../assets/avatar2.png'),
  avatar_3: require('../assets/avatar3.png'),
  avatar_4: require('../assets/avatar4.png'),
  avatar_5: require('../assets/avatar5.png'),
  avatar_6: require('../assets/avatar6.png'),
  avatar_7: require('../assets/avatar7.png'),
  avatar_8: require('../assets/avatar8.png'),
  avatar_9: require('../assets/avatar9.png'),
  avatar_10: require('../assets/avatar10.png'),
  avatar_11: require('../assets/avatar11.png'),
  avatar_12: require('../assets/avatar12.png'),
  avatar_13: require('../assets/avatar13.png'),
  avatar_14: require('../assets/avatar14.png'),
  avatar_15: require('../assets/avatar15.png'),
};

export default function LeaderboardScreen({ navigation }) {
  const { adsRemoved } = useAds();
  const [showAd, setShowAd] = useState(true);
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [currentUsername, setCurrentUsername] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const rawName = await getUsername();
      const cleanName = rawName ? rawName.trim() : null;
      setCurrentUsername(cleanName);

      const uid = await getUserId();
      setCurrentUserId(uid);
      
      const data = await fetchLeaderboard('4x4');
      setLeaderboard(data || []);
      
      if (uid) {
        const rankData = await fetchUserRank(uid, '4x4');
        setUserRank(rankData);
      }
    } catch (error) {
      console.error("Leaderboard Load Error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Check if item belongs to current user based on unique ID
  const isMatch = (item) => {
    if (!currentUserId || !item.userId) return false;
    return item.userId === currentUserId;
  };

  const renderPodiumItem = (item, rank) => {
    if (!item) return <View style={styles.podiumColumn} />;
    const me = isMatch(item);
    
    return (
      <View style={[styles.podiumColumn, rank === 1 ? styles.firstPlace : {}]}>
        <View style={[styles.avatarContainer, me && styles.myAvatar]}>
          <Image 
            source={AVATAR_SOURCES[item.avatarId] || AVATAR_SOURCES.avatar_1} 
            style={styles.podiumAvatarImage} 
          />
          <View style={styles.rankBadge}><Text style={styles.rankBadgeText}>{rank}</Text></View>
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
    const me = isMatch(item);
    const rank = index + 1;

    return (
      <View style={[styles.row, me && styles.myRow]}>
        <View style={styles.rankContainer}>
          <Text style={styles.rankText}>{rank}</Text>
        </View>
        <Image 
          source={AVATAR_SOURCES[item.avatarId] || AVATAR_SOURCES.avatar_1} 
          style={styles.rowAvatar} 
        />
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
          <Button3D onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="close" size={30} color="#776e65" />
          </Button3D>
          <Text style={styles.headerTitle}>LEADERBOARD</Text>
          <Button3D onPress={loadData} style={styles.backButton}>
            <Ionicons name="refresh" size={24} color="#776e65" />
          </Button3D>
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
  backButton: { padding: 8, borderRadius: 10, backgroundColor: '#ffffff', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.16, shadowRadius: 3 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#776e65' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 150 },
  podiumContainer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', marginVertical: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#eee4da' },
  podiumColumn: { alignItems: 'center', width: width * 0.28 },
  firstPlace: { transform: [{ translateY: -15 }] },
  avatarContainer: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#eee4da', justifyContent: 'center', alignItems: 'center', marginBottom: 5, borderWidth: 2, borderColor: '#bbada0', overflow: 'hidden' },
  myAvatar: { borderColor: '#8f7a66', borderWidth: 3 },
  podiumAvatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  rankBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#8f7a66', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rankBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  podiumName: { fontSize: 13, fontWeight: 'bold', color: '#776e65', marginBottom: 5 },
  podiumScoreBadge: { backgroundColor: '#8f7a66', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 12, marginBottom: 10 },
  podiumScoreText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  podiumStep: { width: '90%', backgroundColor: '#bbada0', borderTopLeftRadius: 8, borderTopRightRadius: 8, justifyContent: 'center', alignItems: 'center' },
  stepNumber: { fontSize: 22, fontWeight: 'bold', color: 'rgba(255,255,255,0.5)' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eee4da', padding: 15, borderRadius: 10, marginBottom: 10 },
  myRow: { backgroundColor: '#ede0c8', borderWidth: 2, borderColor: '#8f7a66' },
  rankContainer: { width: 45 },
  rowAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor: '#bbada0' },
  rankText: { fontSize: 16, fontWeight: 'bold', color: '#776e65' },
  rankTextWhite: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  nameText: { flex: 1, fontSize: 16, color: '#776e65', fontWeight: '600' },
  nameTextWhite: { flex: 1, fontSize: 16, color: '#fff', fontWeight: 'bold' },
  myNameText: { color: '#8f7a66', fontWeight: 'bold' },
  scoreText: { fontSize: 16, fontWeight: 'bold', color: '#776e65' },
  scoreTextWhite: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  stickyFooter: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#faf8ef', padding: 20, borderTopWidth: 2, borderTopColor: '#bbada0' },
  myStickyRow: { backgroundColor: '#8f7a66', marginBottom: 0, elevation: 5 },
  adWrapper: { width: width, minHeight: 50, marginVertical: 12, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 0 },
});