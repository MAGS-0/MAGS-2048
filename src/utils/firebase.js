import { db } from '../../firebaseConfig';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp 
} from 'firebase/firestore';

// 1. Submit a score to the global leaderboard
export const submitGlobalScore = async (username, score, gridType = '4x4') => {
  try {
    await addDoc(collection(db, 'leaderboards'), {
      username,
      score: parseInt(score),
      gridType,
      timestamp: serverTimestamp(),
    });
    console.log("Score submitted successfully!");
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