import React, { useState, useRef, useEffect } from 'react';
import { doc, updateDoc, arrayUnion, collection, addDoc, serverTimestamp, onSnapshot, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../firebaseClient';
import dayjs from 'dayjs';
import { useMessages } from '../hooks/useMessages';

interface FileData {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: Date;
  uploadedBy: string;
}

interface MessageData {
  id: string;
  text?: string;
  files?: FileData[];
  sender: string;
  senderCountry: string;
  createdAt: Timestamp;
  type: 'text' | 'file' | 'both';
}

interface MessagingWithFilesProps {
  quoteRequestId: string;
  currentUser: string;
  currentCountry: string;
  isArchived?: boolean;
  readOnly?: boolean;
}

export default function MessagingWithFiles({
  quoteRequestId,
  currentUser,
  currentCountry,
  isArchived = false,
  readOnly = false
}: MessagingWithFilesProps) {
  const { messages, loading, error: messageError, sendMessage } = useMessages(quoteRequestId);
  const [messageText, setMessageText] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileSelect = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || readOnly || isArchived) return;

    setUploadingFiles(true);
    setError(null);
    const processedFiles: FileData[] = [];

    try {
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      
      // Check file size (limit to 3MB for messaging)
      if (file.size > 3 * 1024 * 1024) {
          throw new Error(`File ${file.name} is too large. Maximum size is 3MB for messaging.`);
      }

        // Convert file to base64 for storage
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        processedFiles.push({
          id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          url: base64,
          type: file.type,
          size: file.size,
          uploadedAt: new Date(),
          uploadedBy: currentUser
        });
    }

    if (processedFiles.length > 0) {
        await sendMessage('', currentUser, currentCountry, processedFiles);
    }
    } catch (error: any) {
      console.error('Error processing files:', error);
      setError(error.message || 'Failed to process files');
    } finally {
    setUploadingFiles(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || readOnly || isArchived) return;

    try {
      setError(null);
      await sendMessage(messageText, currentUser, currentCountry);
      setMessageText('');
    } catch (error: any) {
      console.error('Error sending message:', error);
      setError(error.message || 'Failed to send message');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
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
    if (!readOnly && !isArchived) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  if (loading) {
  return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
        </div>
    );
  }

  if (messageError) {
    return (
      <div className="flex items-center justify-center h-full text-red-500 p-4">
        {messageError}
      </div>
    );
  }

  return (
      <div 
      className={`flex flex-col h-full ${
        dragOver ? 'bg-blue-50' : 'bg-white'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
      {/* Messages Section */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <div className="text-4xl mb-2">💬</div>
            <p>No messages yet.</p>
            <p className="text-sm">Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="flex flex-col">
              {/* Message Header */}
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm text-gray-700">{message.sender}</span>
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                  {message.senderCountry}
                </span>
                <span className="text-xs text-gray-400">
                  {message.createdAt?.toDate ? dayjs(message.createdAt.toDate()).format('MMM D, HH:mm') : ''}
                </span>
              </div>

              {/* Message Content */}
                {message.text && (
                <div className="text-gray-800 break-words bg-gray-50 rounded-lg p-3">
                  {message.text}
                </div>
                )}

              {/* Files */}
                {message.files && message.files.length > 0 && (
                <div className="mt-2 space-y-2">
                  {message.files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg"
                    >
                      <span className="text-xl">
                        {file.type.startsWith('image/') ? '🖼️' : 
                         file.type.includes('pdf') ? '📄' :
                         file.type.includes('word') ? '📝' :
                         file.type.includes('excel') ? '📊' : '📎'}
                      </span>
                        <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-700 truncate">
                          {file.name}
                          </div>
                        <div className="text-xs text-gray-500">
                          {(file.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                      <a
                        href={file.url}
                        download={file.name}
                        className="text-blue-500 hover:text-blue-600"
                        onClick={(e) => e.stopPropagation()}
                      >
                        ⬇️
                      </a>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Section */}
      {!readOnly && !isArchived && (
        <div className="flex-none p-4 border-t space-y-2">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={uploadingFiles}
            />
            <button
              type="submit"
              disabled={!messageText.trim() || uploadingFiles}
              className={`px-4 py-2 rounded-lg ${
                !messageText.trim() || uploadingFiles
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-blue-500 hover:bg-blue-600 text-white"
              }`}
            >
              Send
            </button>
          </form>

          {/* File Upload */}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFiles}
              className={`text-sm px-3 py-1 rounded ${
                uploadingFiles
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {uploadingFiles ? "Uploading..." : "Attach Files"}
            </button>
            <span className="text-xs text-gray-500">
              Max size: 3MB per file
            </span>
          </div>

          {error && (
            <div className="text-sm text-red-500">{error}</div>
      )}
        </div>
      )}
    </div>
  );
} 