"use client";
import React, { useState, useEffect, useRef } from "react";
import { collection, getDocs, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, doc, deleteDoc, deleteField, updateDoc, arrayRemove } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAuth } from "../AuthProvider";
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { getDownloadURL, ref as storageRef, deleteObject } from "firebase/storage";
import { storage } from "../../firebaseClient";
import DashboardFileSharing from "../components/DashboardFileSharing";

dayjs.extend(relativeTime);

// Reusable FilePreview component
function FilePreview({ file, messageId, canDelete, onDelete }: { file: any, messageId: string, canDelete: boolean, onDelete: () => void }) {
  const [downloadUrl, setDownloadUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    const path = file.storagePath || file.url;
    getDownloadURL(storageRef(storage, path))
      .then((url) => { if (isMounted) setDownloadUrl(url); })
      .catch(() => { if (isMounted) { setDownloadUrl(null); setError('Could not load file preview'); } })
      .finally(() => { if (isMounted) setLoading(false); });
    return () => { isMounted = false; };
  }, [file]);

  const handleDelete = async () => {
    if (!file.storagePath || !messageId) return;
    setDeleting(true);
    try {
      await deleteObject(storageRef(storage, file.storagePath));
      await onDelete();
    } catch (e) {
      setError('Failed to delete file');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="relative">
      {loading && (
        <div className="w-full h-32 flex items-center justify-center">
          <span className="loader" />
        </div>
      )}
      {!loading && !downloadUrl && (
        <div className="text-xs text-red-500 flex items-center justify-between">
          Could not load file preview
          {canDelete && (
            <button onClick={handleDelete} disabled={deleting} className="ml-2 text-red-600 hover:text-red-800 font-bold text-lg">✖</button>
          )}
        </div>
      )}
      {!loading && downloadUrl && (
        <>
          {file.type?.startsWith("image/") ? (
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
              <img src={downloadUrl} alt={file.name} className="object-cover w-full h-32 rounded border" />
            </a>
          ) : (
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
              <span className="text-2xl">📄</span>
              <span className="truncate">{file.name}</span>
            </a>
          )}
          {canDelete && (
            <button onClick={handleDelete} disabled={deleting} className="absolute top-1 right-1 text-red-600 hover:text-red-800 font-bold text-lg bg-white bg-opacity-80 rounded-full w-7 h-7 flex items-center justify-center">✖</button>
          )}
        </>
      )}
      {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
    </div>
  );
}

// Modal Component for Full Chat Experience
const ChatModal = ({ isOpen, onClose, selectedQuoteRequestId, quoteRequests, userCountries, customers, userProfile, unreadCounts, lastMessageTimes, onSelectConversation }: any) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm" />
      <div
        ref={modalRef}
        className="relative bg-white rounded-2xl shadow-2xl w-[95vw] h-[90vh] max-w-7xl mx-4 overflow-hidden border border-gray-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Team Messaging</h2>
            <p className="text-sm text-gray-600 mt-1">
              Communicate seamlessly across countries
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <svg
              className="w-6 h-6 text-gray-400 hover:text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Body */}
        <div className="flex h-[calc(90vh-88px)]">
          {/* Left: Conversations */}
          <div className="w-[420px] border-r border-gray-200 bg-gray-50">
            {/* ... your QuoteRequestList here ... */}
          </div>
          {/* Right: ChatWindow */}
          <div className="flex-1">
            {/* ... ChatWindow logic as before ... */}
          </div>
        </div>
      </div>
    </div>
  );
};

// Chat Window Component  
const ChatWindow = ({ quoteRequestId, userCountries, userProfile, onBack, isModal = false }: any) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages in real-time
  useEffect(() => {
    if (!quoteRequestId) return;
    const messagesRef = collection(db, "quoteRequests", quoteRequestId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(messagesList);
    });
    return () => unsubscribe();
  }, [quoteRequestId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !quoteRequestId || loading) return;
    setLoading(true);
    try {
      const messagesRef = collection(db, "quoteRequests", quoteRequestId, "messages");
      await addDoc(messagesRef, {
        senderCountry: userCountries[0],
        text: newMessage.trim(),
        timestamp: serverTimestamp(),
        status: 'delivered'
      });
      setNewMessage("");
    } catch (error) {
      alert("Error sending message");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileShared = async (fileData: any) => {
    if (!quoteRequestId) return;
    try {
      const messagesRef = collection(db, "quoteRequests", quoteRequestId, "messages");
      await addDoc(messagesRef, {
        senderCountry: userCountries[0],
        text: `📎 Shared a file: ${fileData.name}`,
        timestamp: serverTimestamp(),
        status: 'delivered',
        file: {
          id: fileData.id,
          name: fileData.name,
          storagePath: fileData.storagePath,
          type: fileData.type,
          size: fileData.size,
        },
      });
    } catch (error) {
      alert("Failed to share file. Please try again.");
    }
  };

  const handleDeleteFile = async (messageId: string, file: any) => {
    if (!file.storagePath) return;
    
    try {
      // Delete from Storage
      await deleteObject(storageRef(storage, file.storagePath));
      
      // Update Firestore document to remove the specific file
      const messageRef = doc(db, "quoteRequests", quoteRequestId, "messages", messageId);
      await updateDoc(messageRef, {
        files: arrayRemove(file)
      });
      
      // Success notification
      console.log("File deleted successfully");
    } catch (error) {
      console.error("Error deleting file:", error);
      alert("Failed to delete file. Please try again.");
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="text-gray-500">Loading messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-2xl mb-2">💬</div>
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="flex">
              <div className="max-w-[70%] rounded-lg px-4 py-2 bg-white border border-gray-200 text-gray-900">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium opacity-75">
                    {message.senderCountry}
                  </span>
                </div>
                {message.file && (
                  <FilePreview
                    file={message.file}
                    messageId={message.id}
                    canDelete={message.file.uploadedBy === userProfile.displayName}
                    onDelete={async () => {
                      await handleDeleteFile(message.id, message.file);
                    }}
                  />
                )}
                {!message.file && (
                  <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 bg-white border-t flex-shrink-0">
        <div className="flex gap-3">
          <div className="flex-1">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type your message..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#e40115] resize-none"
              rows={2}
            />
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || loading}
              className="px-4 py-2 bg-[#e40115] text-white rounded-md hover:bg-[#c7010e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Send
            </button>
            <DashboardFileSharing 
              onFileShared={handleFileShared}
              currentUser={userProfile?.displayName || "User"}
              currentCountry={userCountries[0]}
              disabled={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Component
interface DashboardMessagingPanelProps {
  selectedQuoteId: string | null;
}

export default function MessagingPanel({ selectedQuoteId }: DashboardMessagingPanelProps) {
  const userCountries = ["Netherlands"];
  const userProfile = { displayName: "User" };

  if (!selectedQuoteId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        Select a Quote Request above to start chatting…
      </div>
    );
  }

  return (
    <ChatWindow
      quoteRequestId={selectedQuoteId}
      userCountries={userCountries}
      userProfile={userProfile}
      onBack={() => {}}
      isModal={false}
    />
  );
}
