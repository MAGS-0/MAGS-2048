import { db } from '../../firebaseConfig';
import { 
  collection, 
  doc,
  setDoc, 
  addDoc,
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp,
  deleteDoc,
  updateDoc,
  getCountFromServer
} from 'firebase/firestore';
import { AVATAR_IDS } from './storage';

// 1. Submit a score to the global leaderboard (Creates a new unique entry for every game result)
export const submitGlobalScore = async (userId, username, score, avatarId, gridType = '4x4') => {
  if (!userId) return;
  try {
    const docRef = doc(db, 'leaderboards', userId);
    const docSnap = await getDoc(docRef);
    
    const numericScore = parseInt(score);

    // Only update if the new score is higher than the existing record
    if (docSnap.exists()) {
      const existingData = docSnap.data();
      if (numericScore <= (existingData.score || 0)) {
        console.log("Score not higher than personal best. Skipping update.");
        return;
      }
    }

    await setDoc(docRef, {
      userId,
      username: username || 'Anonymous',
      score: numericScore,
      avatarId: avatarId || 'avatar_1',
      gridType,
      timestamp: serverTimestamp(),
    }, { merge: true });
    console.log("Personal best updated successfully!");
  } catch (e) {
    console.error("Error submitting score: ", e);
  }
};

// 2. Fetch the top 10 scores
export const fetchLeaderboard = async (gridType = '4x4') => {
  try {
    const q = query(
      collection(db, 'leaderboards'),
      where('gridType', '==', gridType),
      orderBy('score', 'desc'),
      limit(10)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data());
  } catch (e) {
    console.error("Error fetching leaderboard: ", e);
    return [];
  }
};

// 3. Fetch the rank of a specific user
export const fetchUserRank = async (userId, gridType = '4x4') => {
  try {
    const docRef = doc(db, 'leaderboards', userId);
    const userSnap = await getDoc(docRef);

    if (!userSnap.exists()) return null;
    const userDoc = userSnap.data();

    const rankQuery = query(
      collection(db, 'leaderboards'),
      where('gridType', '==', gridType),
      where('score', '>', userDoc.score)
    );
    const rankSnap = await getCountFromServer(rankQuery);

    return { 
      ...userDoc, 
      rank: rankSnap.data().count + 1 
    };
  } catch (e) {
    console.error("Error fetching rank:", e);
    return null;
  }
};
// Add this to the very bottom of your src/utils/firebase.js file
import { getDatabase, ref, get } from 'firebase/database';

export const fetchRemoteBaseCoins = async () => {
  try {
    const database = getDatabase();
    // Looks for a simple 'config/daily_base_coin' entry in your Realtime Database
    const dbRef = ref(database, 'config/daily_base_coin');
    const snapshot = await get(dbRef);
    if (snapshot.exists()) {
      return parseInt(snapshot.val(), 10);
    }
  } catch (error) {
    console.log("Firebase Remote Config offline, utilizing standard baseline fallback.");
  }
  return 1; // High-resilient fallback default
};

// Function to delete all entries in the leaderboard collection
export const clearLeaderboard = async () => {
  try {
    console.log("Attempting to clear leaderboard collection...");
    const leaderboardRef = collection(db, 'leaderboards');
    const querySnapshot = await getDocs(leaderboardRef);
    const deletePromises = [];
    querySnapshot.forEach((document) => {
      deletePromises.push(deleteDoc(doc(db, 'leaderboards', document.id)));
    });
    await Promise.all(deletePromises);
    console.log("Leaderboard collection cleared successfully.");
  } catch (e) {
    console.error("Error clearing leaderboard:", e);
  }
};

// Function to clean and seed the leaderboard with random players
export const seedLeaderboardWithRandomPlayers = async () => {
  try {
    await clearLeaderboard();
    console.log("Seeding leaderboard with 15 random players...");
    const playerNames = [
      "Alpha", "Beta", "Gamma", "Delta", "Echo", "Foxtrot", "Golf", "Hotel",
      "India", "Juliett", "Kilo", "Lima", "Mike", "November", "Oscar"
    ];

    const addPromises = [];
    for (let i = 0; i < 15; i++) {
      const username = `${playerNames[i % playerNames.length]}${Math.floor(Math.random() * 100)}`;
      const score = Math.floor(Math.random() * (50000 - 10000 + 1)) + 10000; // Scores between 10,000 and 50,000
      const avatarId = AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)];
      addPromises.push(submitGlobalScore(`bot_${i}`, username, score, avatarId, '4x4'));
    }
    await Promise.all(addPromises);
    console.log("15 random players added to the leaderboard.");
  } catch (e) {
    console.error("Error seeding leaderboard:", e);
  }
};

// Function to update the avatar for all historical entries of a specific username
export const updateLeaderboardAvatar = async (userId, avatarId) => {
  if (!userId || !avatarId) return;
  try {
    const docRef = doc(db, 'leaderboards', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      await updateDoc(docRef, { avatarId });
    }
  } catch (e) {
    console.error("Error updating leaderboard avatar:", e);
  }
};