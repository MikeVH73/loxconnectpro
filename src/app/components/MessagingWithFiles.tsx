import React, { useState, useRef, useEffect } from 'react';
import { doc, updateDoc, arrayUnion, collection, addDoc, serverTimestamp, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../firebaseClient';
import dayjs from 'dayjs';

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
  author: string;
  authorCountry: string;
  timestamp: any;
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
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [messageText, setMessageText] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load messages from Firestore
  useEffect(() => {
    const q = query(
      collection(db, 'messages'), 
      where('quoteRequestId', '==', quoteRequestId),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedMessages: MessageData[] = [];
      snapshot.forEach((doc) => {
        loadedMessages.push({ id: doc.id, ...doc.data() } as MessageData);
      });
      setMessages(loadedMessages);
    });

    return () => unsubscribe();
  }, [quoteRequestId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileSelect = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || readOnly || isArchived) return;

    setUploadingFiles(true);
    const processedFiles: FileData[] = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      
      // Check file size (limit to 3MB for messaging)
      if (file.size > 3 * 1024 * 1024) {
        alert(`File ${file.name} is too large. Maximum size is 3MB for messaging.`);
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
          uploadedBy: currentUser
        };

        processedFiles.push(fileData);
      } catch (error) {
        console.error('Error processing file:', file.name, error);
        alert(`Failed to process ${file.name}`);
      }
    }

    if (processedFiles.length > 0) {
      await sendMessage('', processedFiles);
    }

    setUploadingFiles(false);
  };

  const sendMessage = async (text: string = '', files: FileData[] = []) => {
    if ((!text.trim() && files.length === 0) || readOnly || isArchived) return;

    setSending(true);
    try {
      const messageData = {
        quoteRequestId,
        text: text.trim() || null,
        files: files.length > 0 ? files : null,
        author: currentUser,
        authorCountry: currentCountry,
        timestamp: serverTimestamp(),
        type: text.trim() && files.length > 0 ? 'both' : (files.length > 0 ? 'file' : 'text')
      };

      await addDoc(collection(db, 'messages'), messageData);
      setMessageText('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(messageText);
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('doc')) return '📝';
    if (type.includes('excel') || type.includes('sheet')) return '📊';
    return '📎';
  };

  const isImageFile = (type: string) => {
    return type.startsWith('image/');
  };

  const downloadFile = (file: FileData) => {
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-white border rounded shadow">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Country Communication</h3>
          <p className="text-sm text-gray-600">Share messages and files between countries</p>
        </div>
        <div className="text-sm text-gray-500">
          {messages.length} message{messages.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Messages Area */}
      <div 
        className={`flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[400px] ${
          dragOver ? 'bg-blue-50 border-2 border-dashed border-blue-300' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <div className="text-4xl mb-2">💬</div>
            <p>No messages yet.</p>
            <p className="text-sm">Start the conversation between countries!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="flex flex-col">
              {/* Message Header */}
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm text-gray-700">{message.author}</span>
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                  {message.authorCountry}
                </span>
                <span className="text-xs text-gray-400">
                  {message.timestamp?.toDate ? dayjs(message.timestamp.toDate()).format('MMM D, HH:mm') : ''}
                </span>
              </div>

              {/* Message Content */}
              <div className="bg-gray-50 border rounded-lg p-3 ml-4">
                {/* Text Content */}
                {message.text && (
                  <div className="text-sm text-gray-800 mb-2">{message.text}</div>
                )}

                {/* File Content */}
                {message.files && message.files.length > 0 && (
                  <div className="space-y-2">
                    {message.files.map((file) => (
                      <div key={file.id} className="flex items-center gap-3 p-2 bg-white border rounded">
                        <div className="text-lg">{getFileIcon(file.type)}</div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{file.name}</span>
                            <span className="text-xs text-gray-400">
                              {formatFileSize(file.size)}
                            </span>
                          </div>
                        </div>

                        {/* Image Preview */}
                        {isImageFile(file.type) && (
                          <img 
                            src={file.url} 
                            alt={file.name}
                            className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80"
                            onClick={() => window.open(file.url, '_blank')}
                            title="Click to view full size"
                          />
                        )}

                        {/* Download Button */}
                        <button
                          onClick={() => downloadFile(file)}
                          className="text-blue-600 hover:text-blue-800 text-sm underline"
                        >
                          Download
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {!isArchived && !readOnly && (
        <div className="border-t p-4 space-y-3">
          {/* File Upload Area (when dragging) */}
          {dragOver && (
            <div className="text-center text-blue-600 py-2">
              <div className="text-2xl mb-1">📎</div>
              <p className="text-sm font-medium">Drop files to share</p>
            </div>
          )}

          {/* Text Input */}
          <div className="flex gap-2">
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message... (Press Enter to send, Shift+Enter for new line)"
              className="flex-1 border rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              disabled={sending || uploadingFiles}
            />
            <button
              onClick={() => sendMessage(messageText)}
              disabled={!messageText.trim() || sending || uploadingFiles}
              className="bg-[#e40115] text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? '...' : 'Send'}
            </button>
          </div>

          {/* File Upload Button */}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFiles}
              className="flex items-center gap-2 px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              <span>📎</span>
              {uploadingFiles ? 'Processing...' : 'Attach Files'}
            </button>
            <span className="text-xs text-gray-500">
              Images, PDF, Word, Excel • Max 3MB each
            </span>
          </div>
        </div>
      )}

      {/* Archived Notice */}
      {isArchived && (
        <div className="border-t p-4 text-center text-gray-400 text-sm">
          Messaging is disabled for archived Quote Requests.
        </div>
      )}
    </div>
  );
} 