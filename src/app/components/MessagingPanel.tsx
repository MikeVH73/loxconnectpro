import React, { useState, useEffect, useRef, KeyboardEvent } from "react";
import { storage } from "@/firebaseClient";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type { FirebaseStorage } from "firebase/storage";
import type { Timestamp } from "firebase/firestore";

interface Message {
  id: string;
  text: string;
  createdAt: Timestamp;
  sender: string;
  senderCountry: string;
}

interface QuoteFile {
  name: string;
  url: string;
  type: string;
  size?: number;
  uploadedBy?: string;
  uploadedAt?: Date;
}

interface MessagingPanelProps {
  messages: Message[];
  currentUser: string;
  currentCountry: string;
  onSendMessage: (text: string) => Promise<void>;
  quoteTitle?: string;
  onBack?: () => void;
  quoteRequestFiles?: QuoteFile[];
  onFilesChange?: (files: QuoteFile[]) => void;
  readOnly?: boolean;
}

export default function MessagingPanel({
  messages = [],
  currentUser = "",
  currentCountry = "",
  onSendMessage,
  quoteTitle = "",
  onBack,
  quoteRequestFiles = [],
  onFilesChange,
  readOnly = false
}: MessagingPanelProps) {
  const [messageText, setMessageText] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMounted = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    if (isMounted.current) {
      console.log('Messages updated:', messages);
      console.log('Current user:', currentUser);
      console.log('Current country:', currentCountry);
      scrollToBottom();
    }
  }, [messages, currentUser, currentCountry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSending || !messageText.trim() || !isMounted.current) return;

    try {
      if (isMounted.current) {
        setIsSending(true);
        setError(null);
      }
      
      console.log('Submitting message:', {
        text: messageText,
        user: currentUser,
        country: currentCountry
      });
      
      await onSendMessage(messageText);
      if (isMounted.current) {
        setMessageText("");
      }
    } catch (err) {
      console.error('Error sending message:', err);
      if (isMounted.current) {
        setError('Failed to send message. Please try again.');
      }
    } finally {
      if (isMounted.current) {
        setIsSending(false);
      }
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      console.log('Enter key pressed, sending message:', messageText);
      handleSubmit(e);
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || !onFilesChange || !storage || !isMounted.current) return;

    if (isMounted.current) {
      setIsUploading(true);
      setError(null);
    }

    try {
      const newFiles: QuoteFile[] = [];

      for (let i = 0; i < files.length; i++) {
        if (!isMounted.current) break;

        const file = files[i];
        if (file.size > 3 * 1024 * 1024) { // 3MB limit
          throw new Error(`File ${file.name} exceeds 3MB limit`);
        }

        // Upload to Firebase Storage
        const storageRef = ref(storage as FirebaseStorage, `quote-files/${Date.now()}-${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);

        newFiles.push({
          name: file.name,
          url,
          type: file.type,
          size: file.size,
          uploadedBy: currentUser,
          uploadedAt: new Date()
        });
      }

      if (isMounted.current && onFilesChange) {
        onFilesChange([...quoteRequestFiles, ...newFiles]);
      }
    } catch (err: any) {
      console.error('Error uploading files:', err);
      if (isMounted.current) {
        setError(err.message || 'Failed to upload files');
      }
    } finally {
      if (isMounted.current) {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    }
  };

  if (!currentUser || !currentCountry) {
    return (
      <div className="flex flex-col h-full w-[400px] bg-white items-center justify-center">
        <p className="text-gray-500">Please log in to send messages.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Headers */}
      <div className="flex-none">
        <div className="h-12 border-b flex items-center justify-between px-4">
          <h2 className="text-base font-medium text-gray-900">Messaging</h2>
          {onBack && (
            <button
              onClick={onBack}
              className="text-gray-500 hover:text-gray-700"
            >
              Back
            </button>
          )}
        </div>
        {quoteTitle && (
          <div className="h-12 border-b">
            <h2 className="px-4 py-3 text-base font-medium text-gray-900 truncate">
              {quoteTitle}
            </h2>
          </div>
        )}
      </div>

      {/* Quote Files Section */}
      {quoteRequestFiles && quoteRequestFiles.length > 0 && (
        <div className="flex-none border-b">
          <div className="p-4">
            <div className="text-sm font-medium text-gray-700 mb-2">
              Attached Files ({quoteRequestFiles.length})
            </div>
            <div className="grid grid-cols-4 gap-2">
              {quoteRequestFiles.map((file, index) => (
                <div
                  key={index}
                  className="group relative bg-gray-50 rounded overflow-hidden cursor-pointer"
                  onClick={() => setPreviewUrl(file.url)}
                >
                  <div className="aspect-square w-16 h-16">
                    <img
                      src={file.url}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-white bg-black bg-opacity-50 p-1 rounded text-sm hover:bg-opacity-70"
                        title="Open in new tab"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                      <a
                        href={file.url}
                        download={file.name}
                        onClick={(e) => e.stopPropagation()}
                        className="text-white bg-black bg-opacity-50 p-1 rounded text-sm hover:bg-opacity-70"
                        title="Download"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </a>
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-1">
                    <p className="text-white text-xs truncate px-1">
                      {file.name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Messages Section */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.sender === currentUser ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[70%] rounded-lg p-3 ${
                message.sender === currentUser
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100"
              }`}
            >
              <div className="text-xs text-gray-500 mb-1">
                {message.sender} ({message.senderCountry})
              </div>
              <div className="break-words">{message.text}</div>
              <div className="text-xs mt-1 text-right">
                {message.createdAt.toDate().toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Section */}
      {!readOnly && (
        <div className="flex-none p-4 border-t">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSending}
            />
            <button
              type="submit"
              disabled={isSending || !messageText.trim()}
              className={`px-4 py-2 rounded-lg ${
                isSending || !messageText.trim()
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-blue-500 hover:bg-blue-600 text-white"
              }`}
            >
              {isSending ? "Sending..." : "Send"}
            </button>
          </form>
          {error && (
            <div className="text-red-500 text-sm mt-2">{error}</div>
          )}
        </div>
      )}

      {/* Preview Modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="max-w-4xl max-h-[90vh] p-4 relative">
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute top-0 right-0 -mt-10 -mr-10 text-white hover:text-gray-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={previewUrl}
              alt="Preview"
              className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}