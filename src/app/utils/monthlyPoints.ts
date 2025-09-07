// Monthly Points Management Utility
import { collection, query, where, getDocs, addDoc, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebaseClient';
import { MonthlyPoints } from '../types';

export const POINTS_PER_MONTH = 10;

/**
 * Ensures user has correct monthly points for current month
 * Resets unused points from previous months and gives fresh 10 points
 */
export async function ensureMonthlyPoints(userId: string): Promise<MonthlyPoints> {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  try {
    // Check if user has points for current month
    const pointsQuery = query(
      collection(db, 'monthlyPoints'),
      where('userId', '==', userId),
      where('month', '==', currentMonth),
      where('year', '==', currentYear)
    );

    const snapshot = await getDocs(pointsQuery);
    
    if (snapshot.docs.length > 0) {
      // User has points for current month, return them
      const pointsData = snapshot.docs[0].data() as MonthlyPoints;
      return { id: snapshot.docs[0].id, ...pointsData };
    } else {
      // User doesn't have points for current month, create fresh 10 points
      const newMonthlyPoints: Omit<MonthlyPoints, 'id'> = {
        userId: userId,
        month: currentMonth,
        year: currentYear,
        totalPoints: POINTS_PER_MONTH,
        usedPoints: 0,
        remainingPoints: POINTS_PER_MONTH,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await addDoc(collection(db, 'monthlyPoints'), newMonthlyPoints);
      return { id: docRef.id, ...newMonthlyPoints };
    }
  } catch (error) {
    console.error('Error ensuring monthly points:', error);
    throw error;
  }
}

/**
 * Updates monthly points after voting
 */
export async function updateMonthlyPoints(
  monthlyPointsId: string, 
  pointsDifference: number
): Promise<void> {
  try {
    const monthlyPointsRef = doc(db, 'monthlyPoints', monthlyPointsId);
    
    // Get current points using getDoc
    const docSnapshot = await getDoc(monthlyPointsRef);
    
    if (!docSnapshot.exists()) {
      throw new Error('Monthly points not found');
    }
    
    const currentData = docSnapshot.data() as MonthlyPoints;
    const newUsedPoints = Math.max(0, currentData.usedPoints + pointsDifference);
    const newRemainingPoints = Math.max(0, POINTS_PER_MONTH - newUsedPoints);
    
    console.log('Updating monthly points:', {
      monthlyPointsId,
      pointsDifference,
      currentUsedPoints: currentData.usedPoints,
      currentRemainingPoints: currentData.remainingPoints,
      newUsedPoints,
      newRemainingPoints
    });

    await updateDoc(monthlyPointsRef, {
      usedPoints: newUsedPoints,
      remainingPoints: newRemainingPoints,
      updatedAt: new Date()
    });
    
    console.log('Monthly points updated successfully');
  } catch (error) {
    console.error('Error updating monthly points:', error);
    throw error;
  }
}

/**
 * Checks if user can vote with given points
 */
export function canUserVote(
  monthlyPoints: MonthlyPoints | null, 
  pointsToVote: number, 
  currentVotePoints: number
): boolean {
  if (!monthlyPoints) return false;
  
  const pointsDifference = pointsToVote - currentVotePoints;
  return pointsDifference <= monthlyPoints.remainingPoints;
}

/**
 * Gets remaining points after a vote
 */
export function getRemainingPointsAfterVote(
  monthlyPoints: MonthlyPoints | null,
  pointsToVote: number,
  currentVotePoints: number
): number {
  if (!monthlyPoints) return 0;
  
  const pointsDifference = pointsToVote - currentVotePoints;
  return Math.max(0, monthlyPoints.remainingPoints - pointsDifference);
}
