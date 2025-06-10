import React, { useState, useRef } from 'react';

interface FileData {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: Date;
  uploadedBy: string;
}

interface FileUploadSimpleProps {
  quoteRequestId: string;
  files: FileData[];
  onFilesChange: (files: FileData[]) => void;
  currentUser: string;
  readOnly?: boolean;
}

export default function FileUploadSimple({ 
  quoteRequestId, 
  files, 
  onFilesChange, 
  currentUser,
  readOnly = false 
}: FileUploadSimpleProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || readOnly) return;

    console.log('[FileUploadSimple] Converting files to base64 for temporary storage');
    setUploading(true);
    const newFiles: FileData[] = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      
      // Check file size (limit to 5MB for base64 storage)
      if (file.size > 5 * 1024 * 1024) {
        alert(`File ${file.name} is too large. Maximum size is 5MB.`);
        continue;
      }

      try {
        // Convert file to base64 for temporary storage (workaround for Firebase Storage issues)
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const fileData: FileData = {
          id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          url: base64, // Store as base64 temporarily
          type: file.type,
          size: file.size,
          uploadedAt: new Date(),
          uploadedBy: currentUser
        };

        newFiles.push(fileData);
        console.log('[FileUploadSimple] File converted to base64:', file.name);
        
      } catch (error) {
        console.error('[FileUploadSimple] Error processing file:', file.name, error);
        alert(`Failed to process ${file.name}`);
      }
    }

    const updatedFiles = [...files, ...newFiles];
    onFilesChange(updatedFiles);
    setUploading(false);
  };

  const handleFileDelete = (fileData: FileData) => {
    if (readOnly) return;
    const updatedFiles = files.filter(f => f.id !== fileData.id);
    onFilesChange(updatedFiles);
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

  const downloadFile = (fileData: FileData) => {
    // Create download link for base64 data
    const link = document.createElement('a');
    link.href = fileData.url;
    link.download = fileData.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
              <span className="text-blue-600 font-medium">Processing files...</span>
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
                Supports: Images, PDF, Word, Excel documents (Max 5MB each)
              </p>
              <p className="text-xs text-orange-600 mt-1">
                ⚠️ Temporary storage - files stored locally until Firebase Storage is configured
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
                    Added by {file.uploadedBy} • {new Date(file.uploadedAt).toLocaleDateString()}
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
                    onClick={() => downloadFile(file)}
                  >
                    Download
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