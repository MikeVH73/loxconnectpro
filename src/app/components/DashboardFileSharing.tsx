import React, { useRef } from 'react';
import { ref, uploadBytes } from 'firebase/storage';
import { storage } from '../../firebaseClient';

interface FileData {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
  uploadedBy: string;
  uploadedByCountry: string;
  storagePath: string;
}

interface DashboardFileSharingProps {
  onFileShared: (file: FileData) => void;
  currentUser: string;
  currentCountry: string;
  disabled?: boolean;
}

export default function DashboardFileSharing({
  onFileShared,
  currentUser,
  currentCountry,
  disabled = false
}: DashboardFileSharingProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (selectedFiles: FileList | null) => {
    window.alert('Uploading file...');
    if (!selectedFiles || disabled) return;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      if (file.size > 5 * 1024 * 1024) {
        alert(`File ${file.name} is too large. Maximum size is 5MB.`);
        continue;
      }

      try {
        // Upload file to Firebase Storage
        const storageRef = ref(storage, `uploads/${Date.now()}_${file.name}`);
        console.log('[UPLOAD] Attempting upload to storage path:', storageRef.fullPath);
        console.log('[UPLOAD] Storage bucket:', storage.app.options.storageBucket);
        const uploadResult = await uploadBytes(storageRef, file);
        console.log('[UPLOAD] Success! Upload result:', uploadResult);
        const fileData: FileData = {
          id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          type: file.type,
          size: file.size,
          uploadedAt: new Date(),
          uploadedBy: currentUser,
          uploadedByCountry: currentCountry,
          storagePath: storageRef.fullPath
        };
        onFileShared(fileData);
      } catch (error) {
        console.error('[UPLOAD] Error uploading file:', file.name, error);
        alert(`Failed to upload ${file.name}: ${error?.message || error}`);
      }
    }

    // Reset file input zodat dezelfde file opnieuw gekozen kan worden
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex gap-4 justify-center items-center mb-3">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        disabled={disabled}
      />

      <button
        type="button"
        onClick={() => {
          if (fileInputRef.current) {
            fileInputRef.current.accept = 'image/*';
            fileInputRef.current.click();
          }
        }}
        className="flex flex-col items-center justify-center px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition min-w-[80px] min-h-[64px] text-lg"
        disabled={disabled}
        title="Upload Photos"
      >
        <svg className="mb-1" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3.17a2 2 0 0 0 1.41-.59l1.83-1.82A2 2 0 0 1 10.83 2h2.34a2 2 0 0 1 1.42.59l1.83 1.82A2 2 0 0 0 17.83 5H21a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        <span className="text-xs font-medium">Photos</span>
      </button>

      <button
        type="button"
        onClick={() => {
          if (fileInputRef.current) {
            fileInputRef.current.accept = '.pdf';
            fileInputRef.current.click();
          }
        }}
        className="flex flex-col items-center justify-center px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition min-w-[80px] min-h-[64px] text-lg"
        disabled={disabled}
        title="Upload PDF"
      >
        <svg className="mb-1" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" fill="none"/><path d="M7 8h10M7 12h10M7 16h6" stroke="#374151" strokeWidth="2"/></svg>
        <span className="text-xs font-medium">PDF</span>
      </button>

      <button
        type="button"
        onClick={() => {
          if (fileInputRef.current) {
            fileInputRef.current.accept = '.doc,.docx,.xls,.xlsx';
            fileInputRef.current.click();
          }
        }}
        className="flex flex-col items-center justify-center px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition min-w-[80px] min-h-[64px] text-lg"
        disabled={disabled}
        title="Upload Docs"
      >
        <svg className="mb-1" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" fill="none"/><path d="M7 8h10M7 12h10M7 16h6" stroke="#374151" strokeWidth="2"/></svg>
        <span className="text-xs font-medium">Docs</span>
      </button>
    </div>
  );
}
