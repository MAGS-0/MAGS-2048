import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, Dimensions } from 'react-native';
import { getLeaderboard } from '../utils/storage';

const { width } = Dimensions.get('window');

export default function LeaderboardScreen({ navigation }) {
  const [scores, setScores] = useState([]);

  useEffect(() => {
    const fetchScores = async () => {
      const data = await getLeaderboard();
      setScores(data);
    };
    fetchScores();
  }, []);

  const renderItem = ({ item, index }) => (
    <View style={styles.scoreRow}>
      <Text style={styles.rank}>{index + 1}</Text>
      <View style={styles.scoreInfo}>
        <Text style={styles.scoreText}>{item.score}</Text>
        <Text style={styles.dateText}>{item.date}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TOP SCORES</Text>

      {scores.length > 0 ? (
        <FlatList
          data={scores}
          renderItem={renderItem}
          keyExtractor={(item, index) => index.toString()}
          contentContainerStyle={styles.list}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No scores recorded yet. Play a game!</Text>
        </View>
      )}

      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>BACK TO MENU</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf8ef', paddingTop: 60, alignItems: 'center' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#776e65', marginBottom: 30 },
  list: { width: width - 40 },
  scoreRow: { 
    flexDirection: 'row', 
    backgroundColor: '#bbada0', 
    padding: 15, 
    borderRadius: 5, 
    marginBottom: 10, 
    alignItems: 'center' 
  },
  rank: { fontSize: 24, fontWeight: 'bold', color: '#ffffff', width: 40 },
  scoreInfo: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreText: { fontSize: 22, fontWeight: 'bold', color: '#ffffff' },
  dateText: { fontSize: 14, color: '#eee4da' },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  emptyText: { color: '#776e65', fontSize: 16 },
  backButton: { 
    backgroundColor: '#8f7a66', 
    padding: 15, 
    borderRadius: 5, 
    width: width * 0.7, 
    alignItems: 'center', 
    marginBottom: 40 
  },
  backButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' }
});