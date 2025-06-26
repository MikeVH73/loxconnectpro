import { collection, query, where, getDocs, writeBatch, Timestamp, Firestore, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebaseClient';

const ARCHIVE_THRESHOLD_DAYS = 30; // Messages older than this will be archived

export async function archiveOldMessages() {
  const firestore = db as Firestore;
  const messagesRef = collection(firestore, "messages");
  const archivedMessagesRef = collection(firestore, "archivedMessages");

  // Calculate the cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_THRESHOLD_DAYS);

  // Query for old messages
  const q = query(
    messagesRef,
    where("createdAt", "<", Timestamp.fromDate(cutoffDate))
  );

  try {
    const snapshot = await getDocs(q);
    
    // Process in batches of 500 (Firestore limit)
    const batches: any[][] = [];
    let currentBatch: any[] = [];
    
    snapshot.docs.forEach(doc => {
      currentBatch.push({ id: doc.id, ...doc.data() });
      if (currentBatch.length === 500) {
        batches.push(currentBatch);
        currentBatch = [];
      }
    });
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    // Process each batch
    for (const batch of batches) {
      const writeBatchOp = writeBatch(firestore);
      
      for (const message of batch) {
        // Add to archived collection
        const archiveRef = collection(firestore, "archivedMessages", message.quoteRequestId, "messages");
        writeBatchOp.set(archiveRef.doc(), {
          ...message,
          archivedAt: serverTimestamp()
        });
        
        // Delete from main collection
        writeBatchOp.delete(messagesRef.doc(message.id));
      }
      
      await writeBatchOp.commit();
    }

    console.log(`Successfully archived ${snapshot.size} messages`);
  } catch (error) {
    console.error('Error archiving messages:', error);
    throw error;
  }
}