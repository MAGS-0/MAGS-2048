import { db } from '../../firebaseConfig';
import { 
  collection, 
  doc,
  setDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp 
} from 'firebase/firestore';

// 1. Submit a score to the global leaderboard (Overwrites to prevent name duplicates!)
export const submitGlobalScore = async (username, score, gridType = '4x4') => {
  try {
    // Reference a unique document named EXACTLY after the username inside the collection
    const docRef = doc(db, 'leaderboards', username);
    
    // Check if this player already has a score stored in the database
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const existingData = docSnap.data();
      // Only overwrite if the new score is higher than their previous history record
      if (parseInt(score) <= existingData.score) {
        console.log("Current score isn't higher than previous personal best. Skipping update.");
        return;
      }
    }

    // Set doc cleanly ensures one record per username exists globally
    await setDoc(docRef, {
      username,
      score: parseInt(score),
      gridType,
      timestamp: serverTimestamp(),
    });
    console.log("Score submitted successfully (Leaderboard updated/cleaned)!");
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
export const fetchUserRank = async (username, gridType = '4x4') => {
  try {
    const userQuery = query(
      collection(db, 'leaderboards'),
      where('username', '==', username),
      where('gridType', '==', gridType),
      orderBy('score', 'desc'),
      limit(1)
    );
    const userSnap = await getDocs(userQuery);

    if (userSnap.empty) return null;

    const userDoc = userSnap.docs[0].data();

    const rankQuery = query(
      collection(db, 'leaderboards'),
      where('gridType', '==', gridType),
      where('score', '>', userDoc.score)
    );
    const rankSnap = await getDocs(rankQuery);

    return { 
      ...userDoc, 
      rank: rankSnap.size + 1 
    };
  } catch (e) {
    console.error("Error fetching rank:", e);
    return null;
  }
};
// Add this to the very bottom of your src/utils/firebase.js file
import { ref, get } from 'firebase/database';

export const fetchRemoteBaseCoins = async () => {
  try {
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