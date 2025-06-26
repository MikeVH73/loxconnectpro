import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const ARCHIVE_THRESHOLD_DAYS = 30; // Messages older than this will be archived
const BATCH_SIZE = 500; // Firestore batch size limit

export const archiveOldMessages = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    const db = admin.firestore();
    
    // Calculate the cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_THRESHOLD_DAYS);
    
    try {
      // Query for old messages
      const snapshot = await db.collection('messages')
        .where('createdAt', '<', cutoffDate)
        .get();
      
      // Process in batches
      const batches = [];
      let batch = db.batch();
      let operationCount = 0;
      
      for (const doc of snapshot.docs) {
        const data = doc.data();
        
        // Create in archive collection
        const archiveRef = db.collection('archivedMessages')
          .doc(data.quoteRequestId)
          .collection('messages')
          .doc(doc.id);
          
        batch.set(archiveRef, {
          ...data,
          archivedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Delete from main collection
        batch.delete(doc.ref);
        
        operationCount++;
        
        // If we reach batch size limit, commit and start new batch
        if (operationCount === BATCH_SIZE) {
          batches.push(batch.commit());
          batch = db.batch();
          operationCount = 0;
        }
      }
      
      // Commit any remaining operations
      if (operationCount > 0) {
        batches.push(batch.commit());
      }
      
      // Wait for all batches to complete
      await Promise.all(batches);
      
      console.log(`Successfully archived ${snapshot.size} messages`);
      return null;
    } catch (error) {
      console.error('Error archiving messages:', error);
      throw error;
    }
  });