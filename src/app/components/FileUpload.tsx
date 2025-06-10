import React, { useState, useRef } from 'react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { storage, db } from '../../firebaseClient';

interface FileData {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: Date;
  uploadedBy: string;
}

interface FileUploadProps {
  quoteRequestId: string;
  files: FileData[];
  onFilesChange: (files: FileData[]) => void;
  currentUser: string;
  readOnly?: boolean;
}

export default function FileUpload({ 
  quoteRequestId, 
  files, 
  onFilesChange, 
  currentUser,
  readOnly = false 
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || readOnly) return;

    console.log('[FileUpload] Starting upload for', selectedFiles.length, 'files');
    setUploading(true);
    setUploadProgress('Initializing upload...');
    const newFiles: FileData[] = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      console.log('[FileUpload] Processing file:', file.name, 'Size:', file.size, 'Type:', file.type);
      setUploadProgress(`Processing file ${i + 1}/${selectedFiles.length}: ${file.name}`);
      
      // Check file size (limit to 10MB)
      if (file.size > 10 * 1024 * 1024) {
        console.error('[FileUpload] File too large:', file.name, file.size);
        alert(`File ${file.name} is too large. Maximum size is 10MB.`);
        continue;
      }
      
      // Check if storage is accessible
      try {
        // Test storage access first
        const testRef = ref(storage, 'test-connection');
        console.log('[FileUpload] Testing storage connection...');
        setUploadProgress(`Testing storage connection for ${file.name}...`);
        
        // If we reach here, storage is accessible
        console.log('[FileUpload] Storage accessible, proceeding with upload...');
        
        // Generate unique file ID
        const fileId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // For new quote requests, store files temporarily
        const storagePath = quoteRequestId === "new" 
          ? `temp-uploads/${fileId}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
          : `quote-requests/${quoteRequestId}/${fileId}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        
        console.log('[FileUpload] Storage path:', storagePath);
        setUploadProgress(`Uploading ${file.name} to storage...`);
        const fileRef = ref(storage, storagePath);

        // Upload with timeout and progress
        console.log('[FileUpload] Starting upload to Firebase Storage...');
        
        // Add timeout for upload
        const uploadPromise = uploadBytes(fileRef, file);
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Upload timeout after 30 seconds')), 30000)
        );
        
        await Promise.race([uploadPromise, timeoutPromise]);
        console.log('[FileUpload] Upload completed, getting download URL...');
        setUploadProgress(`Getting download URL for ${file.name}...`);
        
        // Add timeout for getting download URL
        const urlPromise = getDownloadURL(fileRef);
        const urlTimeoutPromise = new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error('Download URL timeout after 10 seconds')), 10000)
        );
        
        const downloadURL = await Promise.race([urlPromise, urlTimeoutPromise]);
        console.log('[FileUpload] Download URL obtained:', downloadURL);

        const fileData: FileData = {
          id: fileId,
          name: file.name,
          url: downloadURL,
          type: file.type,
          size: file.size,
          uploadedAt: new Date(),
          uploadedBy: currentUser
        };

        newFiles.push(fileData);

        // Only update Firestore if we have a real quote request ID
        if (quoteRequestId !== "new") {
          console.log('[FileUpload] Updating Firestore with file data...');
          setUploadProgress(`Saving ${file.name} to database...`);
          await updateDoc(doc(db, 'quoteRequests', quoteRequestId), {
            attachments: arrayUnion(fileData)
          });
          console.log('[FileUpload] Firestore updated successfully');
        }
        
        console.log('[FileUpload] File upload completed successfully:', file.name);
        setUploadProgress(`✅ ${file.name} uploaded successfully`);
        
      } catch (error) {
        console.error('[FileUpload] Error uploading file:', file.name, error);
        setUploadProgress(`❌ Failed to upload ${file.name}`);
        
        // Provide more specific error messages
        let errorMessage = 'Unknown error';
        if (error instanceof Error) {
          if (error.message.includes('permission-denied')) {
            errorMessage = 'Permission denied. Firebase Storage rules may be blocking uploads.';
          } else if (error.message.includes('timeout')) {
            errorMessage = 'Upload timed out. Please check your internet connection.';
          } else if (error.message.includes('network')) {
            errorMessage = 'Network error. Please check your internet connection.';
          } else {
            errorMessage = error.message;
          }
        }
        
        alert(`Failed to upload ${file.name}: ${errorMessage}`);
      }
    }

    console.log('[FileUpload] All uploads completed. New files:', newFiles.length);
    const updatedFiles = [...files, ...newFiles];
    onFilesChange(updatedFiles);
    setUploading(false);
    setUploadProgress('');
  };

  const handleFileDelete = async (fileData: FileData) => {
    if (readOnly) return;

    try {
      // Delete from Firebase Storage
      const storagePath = quoteRequestId === "new" 
        ? `temp-uploads/${fileData.id}_${fileData.name}`
        : `quote-requests/${quoteRequestId}/${fileData.id}_${fileData.name}`;
      
      const fileRef = ref(storage, storagePath);
      await deleteObject(fileRef);

      // Remove from Firestore only if we have a real quote request ID
      if (quoteRequestId !== "new") {
        await updateDoc(doc(db, 'quoteRequests', quoteRequestId), {
          attachments: arrayRemove(fileData)
        });
      }

      // Update local state
      const updatedFiles = files.filter(f => f.id !== fileData.id);
      onFilesChange(updatedFiles);
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Failed to delete file');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isImageFile = (type: string) => {
    return type.startsWith('image/');
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('doc')) return '📝';
    if (type.includes('excel') || type.includes('sheet')) return '📊';
    return '📎';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!readOnly) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {!readOnly && (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragOver 
              ? 'border-blue-400 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
          } ${uploading ? 'opacity-50' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          />
          
          {uploading ? (
            <div className="flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-2"></div>
              <span className="text-blue-600 font-medium">Uploading...</span>
              {uploadProgress && (
                <span className="text-sm text-gray-600 mt-1">{uploadProgress}</span>
              )}
            </div>
          ) : (
            <div>
              <div className="text-4xl mb-2">📎</div>
              <p className="text-gray-600 mb-2">
                Drag & drop files here or{' '}
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-800 underline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  browse
                </button>
              </p>
              <p className="text-xs text-gray-400">
                Supports: Images, PDF, Word, Excel documents (Max 10MB each)
              </p>
            </div>
          )}
        </div>
      )}

      {/* Files List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-gray-700">Attached Files ({files.length})</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {files.map((file) => (
              <div key={file.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded border">
                <div className="text-xl">{getFileIcon(file.type)}</div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{file.name}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Uploaded by {file.uploadedBy} • {new Date(file.uploadedAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Preview for images */}
                  {isImageFile(file.type) && (
                    <img 
                      src={file.url} 
                      alt={file.name}
                      className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80"
                      onClick={() => window.open(file.url, '_blank')}
                      title="Click to view full size"
                    />
                  )}
                  
                  {/* Download button */}
                  <button
                    type="button"
                    className="text-blue-600 hover:text-blue-800 text-sm underline"
                    onClick={() => window.open(file.url, '_blank')}
                  >
                    View
                  </button>
                  
                  {/* Delete button */}
                  {!readOnly && (
                    <button
                      type="button"
                      className="text-red-600 hover:text-red-800 text-sm"
                      onClick={() => handleFileDelete(file)}
                      title="Delete file"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {files.length === 0 && readOnly && (
        <div className="text-center text-gray-400 py-4">
          No attachments
        </div>
      )}
    </div>
  );
} 