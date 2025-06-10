import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseClient';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface Message {
  id: string;
  senderCountry: string;
  text: string;
  timestamp: any;
  status?: string;
  file?: {
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
  };
}

interface ArchivedMessagingProps {
  quoteRequestId: string;
  userCountries: string[];
  quoteRequest: any;
}

export default function ArchivedMessaging({ quoteRequestId, userCountries, quoteRequest }: ArchivedMessagingProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!quoteRequestId) return;

    const messagesRef = collection(db, "quoteRequests", quoteRequestId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messageList: Message[] = [];
      snapshot.forEach((doc) => {
        messageList.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(messageList);
      setLoading(false);
      
      // Scroll to bottom after messages load
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    return unsubscribe;
  }, [quoteRequestId]);

  const downloadFile = (file: any) => {
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('excel') || type.includes('sheet')) return '📊';
    return '📎';
  };

  const isImageFile = (type: string) => type.startsWith('image/');

  const getRelativeTime = (timestamp: any) => {
    if (!timestamp) return 'Unknown time';
    try {
      const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
      return dayjs(date).fromNow();
    } catch (error) {
      return 'Unknown time';
    }
  };

  const getAbsoluteTime = (timestamp: any) => {
    if (!timestamp) return 'Unknown time';
    try {
      const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
      return dayjs(date).format('YYYY-MM-DD HH:mm');
    } catch (error) {
      return 'Unknown time';
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading message history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">Message History</h3>
            <p className="text-sm text-gray-600">
              Conversation between {quoteRequest?.creatorCountry} & {quoteRequest?.involvedCountry}
            </p>
          </div>
          <div className="text-right">
            <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium border border-orange-200">
              📁 Archived
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-4">📁</div>
            <p className="text-lg font-medium mb-2">No message history</p>
            <p className="text-sm">No messages were exchanged for this quote request</p>
          </div>
        ) : (
          <>
            {/* Message count summary */}
            <div className="text-center py-2 mb-4">
              <span className="bg-white px-4 py-2 rounded-full text-sm text-gray-600 shadow-sm border">
                📊 {messages.length} message{messages.length !== 1 ? 's' : ''} in conversation
              </span>
            </div>
            
            {messages.map((message) => {
              const isMyCountry = userCountries.includes(message.senderCountry);
              return (
                <div
                  key={message.id}
                  className={`flex ${isMyCountry ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg shadow-sm border ${
                      isMyCountry
                        ? 'bg-blue-100 border-blue-200'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    {/* Sender info */}
                    <div className="text-xs text-gray-500 mb-2">
                      <span className="font-medium">{message.senderCountry}</span>
                      <span className="mx-1">•</span>
                      <span title={getAbsoluteTime(message.timestamp)}>
                        {getRelativeTime(message.timestamp)}
                      </span>
                    </div>
                    
                    {/* Message text */}
                    <div className="text-sm text-gray-800 mb-2 whitespace-pre-wrap break-words">
                      {message.text}
                    </div>
                    
                    {/* File attachment */}
                    {message.file && (
                      <div className="mt-3 border rounded p-3 bg-gray-50 border-gray-200">
                        {isImageFile(message.file.type) ? (
                          <div className="space-y-2">
                            <img 
                              src={message.file.url} 
                              alt={message.file.name}
                              className="max-w-full h-auto rounded cursor-pointer hover:opacity-90 border"
                              onClick={() => downloadFile(message.file)}
                              style={{ maxHeight: '200px' }}
                            />
                            <div className="text-xs text-gray-600">
                              📁 {message.file.name} • {formatFileSize(message.file.size)}
                            </div>
                          </div>
                        ) : (
                          <div 
                            className="flex items-center space-x-3 cursor-pointer hover:bg-gray-100 rounded p-2 transition"
                            onClick={() => downloadFile(message.file)}
                          >
                            <div className="text-2xl">{getFileIcon(message.file.type)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">
                                {message.file.name}
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatFileSize(message.file.size)} • Click to download
                              </div>
                            </div>
                            <div className="text-xs text-gray-400">
                              📥
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Footer info */}
      <div className="p-4 border-t bg-white">
        <div className="text-center text-xs text-gray-500">
          <div className="flex items-center justify-center space-x-4">
            <span>📁 Quote Request: {quoteRequest?.status}</span>
            <span>•</span>
            <span>💬 Message archive preserved</span>
            <span>•</span>
            <span>🔒 Read-only mode</span>
          </div>
        </div>
      </div>
    </div>
  );
} 