"use client";
import React, { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAuth } from "../AuthProvider";
import DashboardFileSharing from "../components/DashboardFileSharing";
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface Message {
  id: string;
  senderCountry: string;
  text: string;
  timestamp: any;
}

interface QuoteRequest {
  id: string;
  title: string;
  creatorCountry: string;
  involvedCountry: string;
  status: string;
}

interface DashboardMessagingPanelProps {
  selectedQuoteId: string | null;
}

export default function MessagingPanel({ selectedQuoteId }: DashboardMessagingPanelProps) {
  const { userProfile } = useAuth();
  const [quote, setQuote] = useState<QuoteRequest | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);

  // Fetch quote details
  useEffect(() => {
    if (!selectedQuoteId) return setQuote(null);
    setLoading(true);
    getDoc(doc(db, "quoteRequests", selectedQuoteId)).then((snap) => {
      if (snap.exists()) {
        setQuote({ id: snap.id, ...snap.data() } as QuoteRequest);
      } else {
        setQuote(null);
      }
      setLoading(false);
    });
  }, [selectedQuoteId]);

  // Fetch messages for this quote
  useEffect(() => {
    if (!selectedQuoteId) return setMessages([]);
    const q = query(collection(db, "quoteRequests", selectedQuoteId, "messages"), orderBy("timestamp"));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Message[]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    return () => unsub();
  }, [selectedQuoteId]);

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedQuoteId || !userProfile) return;
    await addDoc(collection(db, "quoteRequests", selectedQuoteId, "messages"), {
      text: newMessage,
      senderCountry: userProfile.countries?.[0] || "",
      timestamp: serverTimestamp(),
    });
    setNewMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Add file sending logic
  const handleFileShared = async (fileData: any) => {
    if (!selectedQuoteId || !userProfile) return;
    await addDoc(collection(db, "quoteRequests", selectedQuoteId, "messages"), {
      text: fileData.name,
      senderCountry: userProfile.countries?.[0] || "",
      timestamp: serverTimestamp(),
      file: fileData,
    });
    setUploadedFiles(prev => [...prev, fileData]);
  };

  // Remove file from uploadedFiles
  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  if (!selectedQuoteId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        Select a Quote Request above to start chatting…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white shadow-sm border-b p-4">
        {loading ? (
          <span className="text-gray-400">Loading…</span>
        ) : quote ? (
          <>
            <h3 className="font-bold text-gray-900 text-base">{quote.title}</h3>
            <div className="text-xs text-gray-500">
              {quote.creatorCountry} ↔ {quote.involvedCountry} | <span className="font-semibold">{quote.status}</span>
            </div>
          </>
        ) : (
          <span className="text-gray-400">Quote not found</span>
        )}
      </div>
      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400">No messages yet. Start the conversation!</div>
        ) : (
          messages.map(msg => {
            const isUser = userProfile?.countries?.includes(msg.senderCountry);
            return (
              <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[70%] rounded-lg px-4 py-2 ${isUser ? "bg-[#e40115] text-white" : "bg-white border border-gray-200 text-gray-900"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium opacity-75">{msg.senderCountry}</span>
                    <span className="text-xs opacity-60">{msg.timestamp?.toDate ? dayjs(msg.timestamp.toDate()).fromNow() : ""}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      {/* Input */}
      <div className="p-4 bg-white border-t flex-shrink-0">
        {/* Upload icons above input */}
        <DashboardFileSharing
          onFileShared={handleFileShared}
          currentUser={userProfile?.displayName || "User"}
          currentCountry={userProfile?.countries?.[0] || ""}
          disabled={!selectedQuoteId}
        />
        <div className="flex gap-3 mt-2">
          <textarea
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message…"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#e40115] resize-none"
            rows={2}
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim()}
            className="px-4 py-2 bg-[#e40115] text-white rounded-md hover:bg-[#c7010e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            Send
          </button>
        </div>
        {/* Uploaded files gallery/list below input */}
        {uploadedFiles.length > 0 && (
          <div className="mt-4 border rounded-lg p-2 bg-gray-50">
            <div className="font-semibold text-xs mb-2 text-gray-600">Uploaded Files</div>
            <div className="flex flex-wrap gap-3">
              {uploadedFiles.map((file, idx) => (
                <div key={file.id || idx} className="flex flex-col items-center w-24 relative group">
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(file.id)}
                    className="absolute -top-2 -right-2 bg-white border border-red-200 text-red-500 rounded-full w-6 h-6 flex items-center justify-center opacity-80 hover:bg-red-100 hover:opacity-100 transition z-10"
                    title="Remove file"
                  >
                    ❌
                  </button>
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
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
          </div>
        )}
      </div>
    </div>
  );
} 