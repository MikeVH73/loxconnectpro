import { collection, getDocs, doc, updateDoc, Firestore } from 'firebase/firestore';
import { db } from '../../firebaseClient';

interface DatabaseUserProfile {
  displayName?: string;
  name?: string;
  email: string;
  role: string;
  countries?: string[];
  businessUnit?: string;
  uid?: string;
  createdAt?: Date;
}

interface FixedUserProfile {
  displayName: string;
  name: string;
  email: string;
  role: string;
  countries: string[];
  businessUnit: string;
  uid: string;
  createdAt: Date;
}

export async function checkAndFixUserProfiles(): Promise<{
  totalUsers: number;
  fixedUsers: number;
  errors: string[];
}> {
  if (!db) {
    return { totalUsers: 0, fixedUsers: 0, errors: ['Firebase not initialized'] };
  }

  const results = {
    totalUsers: 0,
    fixedUsers: 0,
    errors: [] as string[]
  };

  try {
    console.log('Checking and fixing user profiles...');
    
    const usersRef = collection(db as Firestore, 'users');
    const querySnapshot = await getDocs(usersRef);
    
    results.totalUsers = querySnapshot.size;
    console.log(`Found ${results.totalUsers} user profiles to check`);

    for (const userDoc of querySnapshot.docs) {
      try {
        const userData = userDoc.data() as DatabaseUserProfile;
        const userId = userDoc.id;
        
        console.log(`Checking user ${userId}:`, userData);
        
        let needsUpdate = false;
        const updatedData: Partial<FixedUserProfile> = {};
        
        // Check and fix displayName/name fields
        if (!userData.displayName && !userData.name) {
          updatedData.displayName = userData.email.split('@')[0] || 'Unknown User';
          updatedData.name = updatedData.displayName;
          needsUpdate = true;
        } else if (userData.displayName && !userData.name) {
          updatedData.name = userData.displayName;
          needsUpdate = true;
        } else if (!userData.displayName && userData.name) {
          updatedData.displayName = userData.name;
          needsUpdate = true;
        }
        
        // Check and fix businessUnit field
        if (!userData.businessUnit && userData.countries && userData.countries.length > 0) {
          updatedData.businessUnit = userData.countries[0];
          needsUpdate = true;
        } else if (!userData.businessUnit) {
          updatedData.businessUnit = 'Unknown';
          needsUpdate = true;
        }
        
        // Ensure countries array exists
        if (!userData.countries) {
          updatedData.countries = [];
          needsUpdate = true;
        }
        
        // Ensure uid field exists
        if (!userData.uid) {
          updatedData.uid = userId;
          needsUpdate = true;
        }
        
        // Update the user profile if needed
        if (needsUpdate) {
          console.log(`Fixing user ${userId}:`, updatedData);
          await updateDoc(doc(db as Firestore, 'users', userId), updatedData);
          results.fixedUsers++;
        }
        
      } catch (error) {
        const errorMsg = `Error fixing user ${userDoc.id}: ${error}`;
        console.error(errorMsg);
        results.errors.push(errorMsg);
      }
    }
    
    console.log(`User profile check complete. Fixed ${results.fixedUsers} out of ${results.totalUsers} users.`);
    
  } catch (error) {
    const errorMsg = `Error checking user profiles: ${error}`;
    console.error(errorMsg);
    results.errors.push(errorMsg);
  }
  
  return results;
} 