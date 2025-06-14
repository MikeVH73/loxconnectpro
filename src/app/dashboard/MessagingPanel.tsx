"use client";
import React, { useState, useEffect, useRef } from "react";
import { collection, getDocs, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAuth } from "../AuthProvider";
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { storage } from "../../firebaseClient";
import DashboardFileSharing from "../components/DashboardFileSharing";

dayjs.extend(relativeTime);

// Reusable FilePreview component
function FilePreview({ file }: { file: any }) {
  const [downloadUrl, setDownloadUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const path = file.storagePath || file.url; 
    getDownloadURL(storageRef(storage, path))
      .then((url) => { if (isMounted) setDownloadUrl(url); })
      .catch(() => { if (isMounted) setDownloadUrl(null); })
      .finally(() => { if (isMounted) setLoading(false); });

    return () => { isMounted = false; };
  }, [file]);

  if (loading) {
    return (
      <div className="w-full h-32 flex items-center justify-center">
        <span className="loader" />
      </div>
    );
  }

  if (!downloadUrl) {
    return <div className="text-xs text-red-500">Could not load file preview</div>;
  }

  if (file.type?.startsWith("image/")) {
    return (
      <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
        <img
          src={downloadUrl}
          alt={file.name}
          className="object-cover w-full h-32 rounded border"
        />
      </a>
    );
  }

  // Non-image file
  return (
    <a
      href={downloadUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2"
    >
      <span className="text-2xl">📄</span>
      <span className="truncate">{file.name}</span>
    </a>
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
  // ...other ChatWindow logic...

  // Example message rendering inside messages.map:
  // Replace the old file/text block with this:
  // {message.file && <FilePreview file={message.file} />}
  // {!message.file && (
  //   <p className="text-sm whitespace-pre-wrap">{message.text}</p>
  // )}

  // ...rest of ChatWindow unchanged...
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
