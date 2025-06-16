import React, { useState, useEffect, useRef } from "react";
import { getDownloadURL, ref as storageRef, deleteObject } from "firebase/storage";
import { storage } from "../../firebaseClient";
import { doc, updateDoc, arrayRemove } from "firebase/firestore";
import { db } from "../../firebaseClient";

interface Message {
  id: string;
  text: string;
  createdAt: Date;
  sender: string;
  senderCountry: string;
}

interface MessagingPanelProps {
  messages: Message[];
  currentUser: string;
  currentCountry: string;
  onSendMessage: (text: string, attachments?: File[]) => void;
  quoteTitle?: string;
  onBack?: () => void;
}

export default function MessagingPanel({
  messages = [],
  currentUser = "",
  currentCountry = "",
  onSendMessage = () => {},
  quoteTitle = "",
  onBack
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

  return (
    <div className="flex flex-col h-full w-[400px]">
      {/* General Header */}
      <div className="flex-none h-12 border-b bg-white">
        <h2 className="px-4 py-3 text-base font-medium text-gray-900">
          Messaging
        </h2>
      </div>

      {/* Quote Title Header */}
      <div className="flex-none h-12 border-b bg-white">
        <h2 className="px-4 py-3 text-base font-medium text-gray-900 truncate">
          {quoteTitle}
        </h2>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-4 space-y-4">
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
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                <div className="text-xs opacity-75 mb-1">
                  {message.sender} ({message.senderCountry})
                </div>
                <div className="break-words">{message.text}</div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="flex-none border-t bg-white">
        <form onSubmit={handleSubmit} className="p-3">
          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Type a message..."
            className="w-full p-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
          />
          <div className="flex justify-end mt-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}