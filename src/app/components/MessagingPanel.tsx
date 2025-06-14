import React, { useState, useEffect, useRef } from "react";
import { getDownloadURL, ref as storageRef, deleteObject } from "firebase/storage";
import { storage } from "../../firebaseClient";
import { doc, deleteField, updateDoc } from "firebase/firestore";
import { db } from "../../firebaseClient";
import DashboardFileSharing from "./DashboardFileSharing";

interface Message {
  id: string;
  text: string;
  files?: {
    name: string;
    type: string;
    url: string;
    storagePath?: string;
    uploadedBy: string;
  }[];
  createdAt: Date;
  sender: string;
  senderCountry: string;
}

interface MessagingPanelProps {
  messages: Message[];
  currentUser: string;
  currentCountry: string;
  onSendMessage: (text: string) => void;
  onFileShared: (fileData: any) => void;
}

export default function MessagingPanel({
  messages,
  currentUser,
  currentCountry,
  onSendMessage,
  onFileShared
}: MessagingPanelProps) {
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageText.trim()) {
      onSendMessage(messageText);
      setMessageText("");
    }
  };

  const handleDeleteFile = async (messageId: string, file: any) => {
    if (!file.storagePath) return;
    
    try {
      // Delete from Storage
      await deleteObject(storageRef(storage, file.storagePath));
      
      // Update Firestore document
      const messageRef = doc(db, "messages", messageId);
      await updateDoc(messageRef, {
        files: deleteField()
      });
      
      // The UI will update automatically through the messages prop
    } catch (error) {
      console.error("Error deleting file:", error);
      alert("Failed to delete file. Please try again.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow">
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
              <div className="text-xs mb-1">
                {message.sender} ({message.senderCountry})
              </div>
              <div className="break-words">{message.text}</div>
              {message.files && message.files.length > 0 && (
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {message.files.map((file, index) => (
                    <div key={index} className="relative group">
                      {file.uploadedBy === currentUser && (
                        <button
                          onClick={() => handleDeleteFile(message.id, file)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          title="Delete file"
                        >
                          ×
                        </button>
                      )}
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={file.type.startsWith('image/') ? undefined : file.name}
                        className="flex flex-col items-center w-full"
                        title={file.name}
                      >
                        {file.type.startsWith('image/') ? (
                          <img src={file.url} alt={file.name} className="w-16 h-16 object-cover rounded mb-1 border" />
                        ) : file.type === 'application/pdf' ? (
                          <span className="text-4xl">📄</span>
                        ) : (
                          <span className="text-4xl">📝</span>
                        )}
                        <span className="text-xs text-center truncate w-full">{file.name}</span>
                      </a>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-xs mt-1 opacity-75">
                {message.createdAt.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t">
        <DashboardFileSharing
          onFileShared={onFileShared}
          currentUser={currentUser}
          currentCountry={currentCountry}
        />
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
} 