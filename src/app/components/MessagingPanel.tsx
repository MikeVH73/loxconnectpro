import React, { useState, useEffect, useRef, KeyboardEvent } from "react";
import { Timestamp } from "firebase/firestore";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

// Initialize dayjs plugins
dayjs.extend(relativeTime);

interface Message {
  id: string;
  text: string;
  createdAt: Timestamp;
  sender: string;
  senderCountry: string;
  files?: Array<{
    name: string;
    url: string;
    type: string;
    size: number;
  }>;
}

interface QuoteFile {
  name: string;
  url: string;
  type: string;
  size: number;
}

interface MessagingPanelProps {
  messages: Message[];
  currentUser: string;
  currentCountry: string;
  onSendMessage: (text: string, files?: Array<{ name: string; url: string; type: string; size: number; }>) => Promise<void>;
  quoteTitle?: string;
  onBack?: () => void;
  quoteRequestFiles?: QuoteFile[];
  onFilesChange?: (files: QuoteFile[]) => void;
  readOnly?: boolean;
  loading?: boolean;
  error?: string | null;
  isOffline?: boolean;
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
  readOnly = false,
  loading = false,
  error = null,
  isOffline = false
}: MessagingPanelProps) {
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoScroll]);

  // Handle scroll events to determine if we should auto-scroll
  useEffect(() => {
    const messageList = messageListRef.current;
    if (!messageList) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = messageList;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setAutoScroll(isNearBottom);
    };

    messageList.addEventListener("scroll", handleScroll);
    return () => messageList.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSending || !messageText.trim()) return;

    setIsSending(true);
    setLocalError(null);

    try {
      await onSendMessage(messageText, []);
        setMessageText("");
      setAutoScroll(true); // Enable auto-scroll when sending a new message
    } catch (err) {
      setLocalError("Failed to send message. Please try again.");
      console.error("Error sending message:", err);
    } finally {
        setIsSending(false);
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const formatTimestamp = (timestamp: Timestamp | Date | null) => {
    if (!timestamp) return "";
    try {
      const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      
      // If less than 24 hours ago, show relative time
      if (diff < 24 * 60 * 60 * 1000) {
        return dayjs(date).fromNow();
      }
      
      // Otherwise show date and time
      return dayjs(date).format("MMM D, HH:mm");
    } catch (err) {
      console.error("Error formatting timestamp:", err);
      return "";
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-medium text-gray-900 truncate">
            {quoteTitle}
          </h2>
        </div>
          {onBack && (
            <button
              onClick={onBack}
            className="ml-4 text-gray-400 hover:text-gray-500"
            >
            <span className="sr-only">Close panel</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            </button>
          )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 p-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 180px)' }}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 p-4">
            Error loading messages: {error}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-gray-500 text-center py-4">
            No messages yet
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
                  message.sender === currentUser ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
                  className={`rounded-lg px-4 py-2 max-w-[80%] ${
                message.sender === currentUser
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-900'
              }`}
            >
                  <div className="text-sm mb-1">
                    {message.sender === currentUser ? 'You' : message.senderCountry}
              </div>
              <div className="break-words">{message.text}</div>
                  {message.files && message.files.length > 0 && (
                <div className="mt-2 space-y-1">
                  {message.files.map((file, index) => (
                        <div key={index} className="flex items-center text-sm">
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                            className="underline hover:no-underline"
                      >
                        {file.name}
                      </a>
                          <span className="ml-2 text-xs opacity-75">
                            ({Math.round(file.size / 1024)}KB)
                          </span>
                    </div>
                  ))}
                </div>
              )}
                  <div className="text-xs mt-1 opacity-75">
                    {dayjs(message.createdAt).fromNow()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t p-4 bg-white">
        <div className="flex items-start space-x-4">
          <div className="flex-1">
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={2}
              disabled={readOnly}
            />
          </div>
            <button
            onClick={handleSubmit}
            disabled={!messageText.trim() || readOnly}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
            </button>
        </div>
      </div>
    </div>
  );
}