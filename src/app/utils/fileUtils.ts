import { ref, getDownloadURL, uploadBytes, deleteObject } from 'firebase/storage';
import { storage } from '../../firebaseClient';

export interface FileData {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: Date;
  uploadedBy: string;
}

export async function moveFilesToQuoteRequest(
  tempFiles: FileData[], 
  quoteRequestId: string
): Promise<FileData[]> {
  const movedFiles: FileData[] = [];

  for (const file of tempFiles) {
    try {
      // Get the file from temp storage
      const tempRef = ref(storage, `temp-uploads/${file.id}_${file.name}`);
      const finalRef = ref(storage, `quote-requests/${quoteRequestId}/${file.id}_${file.name}`);

      // Download the file data
      const response = await fetch(file.url);
      const blob = await response.blob();

      // Upload to final location
      await uploadBytes(finalRef, blob);
      const newUrl = await getDownloadURL(finalRef);

      // Delete from temp storage
      await deleteObject(tempRef);

      // Update file data with new URL
      const movedFile: FileData = {
        ...file,
        url: newUrl
      };

      movedFiles.push(movedFile);
    } catch (error) {
      console.error(`Failed to move file ${file.name}:`, error);
      // Keep the original file data if move fails
      movedFiles.push(file);
    }
  }

  return movedFiles;
} 