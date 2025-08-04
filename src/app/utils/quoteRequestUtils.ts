import { deleteDoc, doc, Firestore } from 'firebase/firestore';
import { db } from '../../firebaseClient';
import { createNotification } from './notifications';

interface DeleteQuoteRequestParams {
  quoteRequestId: string;
  quoteRequestTitle: string;
  creatorCountry: string;
  involvedCountry: string;
  userEmail: string;
  userCountry: string;
}

export async function deleteQuoteRequest({
  quoteRequestId,
  quoteRequestTitle,
  creatorCountry,
  involvedCountry,
  userEmail,
  userCountry
}: DeleteQuoteRequestParams): Promise<{ success: boolean; error?: string }> {
  if (!db) {
    return { success: false, error: 'Firebase not initialized' };
  }

  // Check if user is the creator of the quote request
  if (userCountry !== creatorCountry) {
    return { 
      success: false, 
      error: 'Only the creator of the quote request can delete it' 
    };
  }

  try {
    console.log('[DELETE QUOTE REQUEST] Attempting to delete:', {
      quoteRequestId,
      quoteRequestTitle,
      creatorCountry,
      involvedCountry,
      userEmail,
      userCountry
    });

    // Delete the quote request from Firestore
    const quoteRequestRef = doc(db as Firestore, 'quoteRequests', quoteRequestId);
    await deleteDoc(quoteRequestRef);

    console.log('[DELETE QUOTE REQUEST] Successfully deleted quote request');

    // Create notification for the involved country
    if (involvedCountry && involvedCountry !== creatorCountry) {
      await createNotification({
        quoteRequestId,
        quoteRequestTitle,
        sender: userEmail,
        senderCountry: userCountry,
        targetCountry: involvedCountry,
        content: `Quote request "${quoteRequestTitle}" has been deleted by ${creatorCountry}`,
        notificationType: 'deletion'
      });
    }

    return { success: true };
  } catch (error) {
    console.error('[DELETE QUOTE REQUEST] Error deleting quote request:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete quote request' 
    };
  }
} 