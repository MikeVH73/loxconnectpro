import React, { useState, useRef } from 'react';

interface FileData {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: Date;
  uploadedBy: string;
  uploadedByCountry: string;
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
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || disabled) return;

    setUploading(true);

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      
      // Check file size (limit to 5MB for dashboard sharing)
      if (file.size > 5 * 1024 * 1024) {
        alert(`File ${file.name} is too large. Maximum size is 5MB.`);
        continue;
      }

      try {
        // Convert file to base64 for storage
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const fileData: FileData = {
          id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          url: base64,
          type: file.type,
          size: file.size,
          uploadedAt: new Date(),
          uploadedBy: currentUser,
          uploadedByCountry: currentCountry
        };

        // Call the callback to handle the file
        onFileShared(fileData);
      } catch (error) {
        console.error('Error processing file:', file.name, error);
        alert(`Failed to process ${file.name}`);
      }
    }

    setUploading(false);
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
    if (!disabled) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  return (
    <div className="border-t pt-3">
      {/* File Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
          dragOver 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        } ${uploading || disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          disabled={disabled || uploading}
        />
        
        {uploading ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-2"></div>
            <span className="text-blue-600 font-medium text-sm">Processing files...</span>
          </div>
        ) : disabled ? (
          <div className="text-gray-400">
            <div className="text-2xl mb-1">📎</div>
            <p className="text-sm">File sharing disabled</p>
          </div>
        ) : (
          <div>
            <div className="text-2xl mb-2">📎</div>
            <p className="text-sm text-gray-600 mb-1">
              Drop files here or click to browse
            </p>
            <p className="text-xs text-gray-400">
              Images, PDF, Word, Excel • Max 5MB each
            </p>
          </div>
        )}
      </div>

      {/* Quick Access Buttons */}
      {!disabled && !uploading && (
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.accept = "image/*";
                fileInputRef.current.click();
              }
            }}
            className="flex-1 text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition"
          >
            📸 Photos
          </button>
          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.accept = ".pdf";
                fileInputRef.current.click();
              }
            }}
            className="flex-1 text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
          >
            📄 PDF
          </button>
          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.accept = ".doc,.docx,.xls,.xlsx";
                fileInputRef.current.click();
              }
            }}
            className="flex-1 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
          >
            📝 Docs
          </button>
        </div>
      )}
    </div>
  );
} 