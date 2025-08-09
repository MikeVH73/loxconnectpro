import React, { useState, useRef, useEffect } from 'react';
import { doc, updateDoc, arrayUnion, collection, addDoc, serverTimestamp, onSnapshot, query, where, orderBy, Timestamp, getDocs, Firestore } from 'firebase/firestore';
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

interface Message {
  id: string;
  text: string;
  createdAt: Timestamp;
  sender: string;
  senderCountry: string;
  files?: {
    name: string;
    url: string;
    type: string;
    size: number;
  }[];
  isArchived?: boolean;
}

interface MessagingWithFilesProps {
  quoteRequestId: string;
  currentUser: string;
  currentCountry: string;
}

export default function MessagingWithFiles({ quoteRequestId, currentUser, currentCountry }: MessagingWithFilesProps) {
  const { messages, loading, error, sendMessage } = useMessages(quoteRequestId);
  const [messageText, setMessageText] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedMessages, setArchivedMessages] = useState<Message[]>([]);
  const [isLoadingArchived, setIsLoadingArchived] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);

  const loadArchivedMessages = async () => {
    if (!quoteRequestId || isLoadingArchived) return;

    setIsLoadingArchived(true);
    try {
      const firestore = db as Firestore;
      const archivedRef = collection(firestore, 'archivedMessages', quoteRequestId, 'messages');
      const q = query(archivedRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);

      const archived = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        isArchived: true
      })) as Message[];

      setArchivedMessages(archived);
    } catch (err) {
      console.error('Error loading archived messages:', err);
    } finally {
      setIsLoadingArchived(false);
    }
  };

  useEffect(() => {
    if (showArchived) {
      loadArchivedMessages();
    }
  }, [showArchived, quoteRequestId]);

  const handleFileSelect = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || !currentUser || !currentCountry || uploadingFiles) return;

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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSending || (!messageText.trim() && !selectedFiles.length)) return;

    try {
      setIsSending(true);
      await sendMessage(messageText, currentUser, currentCountry);
      setMessageText('');
      setSelectedFiles([]);
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await handleSendMessage(e as any);
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
    if (!currentUser && !currentCountry && !uploadingFiles) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const allMessages = showArchived 
    ? [...messages, ...archivedMessages].sort((a, b) => 
        a.createdAt.seconds - b.createdAt.seconds
      )
    : messages;

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center p-4 border-b">
        <h2 className="text-lg font-semibold">Messages</h2>
        <button
          onClick={() => setShowArchived(!showArchived)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          {showArchived ? 'Hide Archived' : 'Show Archived'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading || isLoadingArchived ? (
          <div className="text-center">Loading messages...</div>
        ) : error ? (
          <div className="text-red-600 text-center">{error}</div>
        ) : allMessages.length === 0 ? (
          <div className="text-center text-gray-500">No messages yet</div>
        ) : (
          allMessages.map((message) => (
            <div
              key={message.id}
              className={`flex flex-col ${
                message.sender === currentUser ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-3 ${
                  message.sender === currentUser
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-900'
                } ${message.isArchived ? 'opacity-75' : ''}`}
              >
                <div className="text-sm font-medium mb-1">
                  {message.sender} ({message.senderCountry})
                  {message.isArchived && (
                    <span className="ml-2 text-xs">(Archived)</span>
                  )}
              </div>
                <div className="break-words">{message.text}</div>
                {Array.isArray(message.files) && message.files.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {message.files.map((file, index) => (
                      <a
                        key={index}
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm underline block"
                      >
                        {file.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messageEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="p-4 border-t">
        <div className="flex space-x-2">
          <input
            type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1 rounded-lg border p-2"
            disabled={isSending}
            />
            <button
            type="submit"
            disabled={isSending || (!messageText.trim())}
            className={`px-4 py-2 rounded-lg bg-blue-600 text-white ${
              isSending ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'
            }`}
          >
            {isSending ? 'Sending...' : 'Send'}
            </button>
        </div>
      </form>
    </div>
  );
} 