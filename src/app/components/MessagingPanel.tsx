import React, { useState, useEffect, useRef, KeyboardEvent } from "react";
import { Timestamp } from "firebase/firestore";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

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
  onSendMessage: (text: string) => Promise<void>;
  quoteTitle?: string;
  creatorCountry?: string;
  involvedCountry?: string;
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
  creatorCountry = "",
  involvedCountry = "",
  onBack,
  quoteRequestFiles = [],
  onFilesChange,
  readOnly = false
}: MessagingPanelProps) {
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);

    try {
      await onSendMessage(messageText);
      setMessageText("");
      setAutoScroll(true); // Enable auto-scroll when sending a new message
    } catch (err) {
      setError("Failed to send message. Please try again.");
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

  const formatTimestamp = (timestamp: Timestamp | null) => {
    if (!timestamp) return "";
    try {
      const date = timestamp.toDate();
      return dayjs(date).format("MMM D, YYYY HH:mm");
    } catch (err) {
      console.error("Error formatting timestamp:", err);
      return "";
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center space-x-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              ←
            </button>
          )}
          <div className="flex flex-col">
            <h2 className="font-semibold text-gray-800">{quoteTitle}</h2>
            {(creatorCountry || involvedCountry) && (
              <div className="text-sm text-gray-600 mt-1">
                {creatorCountry} → {involvedCountry || "..."}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages Section */}
      <div
        ref={messageListRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            No messages yet
          </div>
        ) : (
          messages.map((message) => (
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
                    : "bg-white border"
                }`}
              >
                <div
                  className={`text-xs ${
                    message.sender === currentUser
                      ? "text-blue-100"
                      : "text-gray-500"
                  } mb-1`}
                >
                  {message.sender} ({message.senderCountry})
                </div>
                <div className="break-words">{message.text}</div>
                {message.files && message.files.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {message.files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center space-x-2 text-sm"
                      >
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`underline ${
                            message.sender === currentUser
                              ? "text-blue-100"
                              : "text-blue-500"
                          }`}
                        >
                          {file.name}
                        </a>
                      </div>
                    ))}
                  </div>
                )}
                <div
                  className={`text-xs mt-1 ${
                    message.sender === currentUser
                      ? "text-blue-100"
                      : "text-gray-400"
                  }`}
                >
                  {formatTimestamp(message.createdAt)}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Section */}
      {!readOnly && (
        <div className="flex-none p-4 bg-white border-t">
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSending}
            />
            <button
              type="submit"
              disabled={isSending || !messageText.trim()}
              className={`px-6 py-2 rounded-lg font-medium ${
                isSending || !messageText.trim()
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-blue-500 hover:bg-blue-600 text-white"
              }`}
            >
              {isSending ? "Sending..." : "Send"}
            </button>
          </form>
          {error && (
            <div className="mt-2 text-sm text-red-500">{error}</div>
          )}
        </div>
      )}
    </div>
  );
}