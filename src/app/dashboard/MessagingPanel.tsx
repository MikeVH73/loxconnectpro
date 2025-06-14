"use client";
import React, { useState, useEffect, useRef } from "react";
import { collection, getDocs, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAuth } from "../AuthProvider";
import DashboardFileSharing from "../components/DashboardFileSharing";
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

// Modal Component for Full Chat Experience
const ChatModal = ({ isOpen, onClose, selectedQuoteRequestId, quoteRequests, userCountries, customers, userProfile, unreadCounts, lastMessageTimes, onSelectConversation }: any) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Dark backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"></div>
      
      {/* Modal content */}
      <div 
        ref={modalRef}
        className="relative bg-white rounded-2xl shadow-2xl w-[95vw] h-[90vh] max-w-7xl mx-4 overflow-hidden border border-gray-200"
      >
        {/* Modal header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Team Messaging</h2>
            <p className="text-sm text-gray-600 mt-1">Communicate seamlessly across countries</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200 group"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal body - Full messaging interface */}
        <div className="flex h-[calc(90vh-88px)]">
          {/* Left side - Conversations list */}
          <div className="w-[420px] border-r border-gray-200 bg-gray-50">
            <QuoteRequestList
              onSelect={onSelectConversation}
              selectedId={selectedQuoteRequestId}
              quoteRequests={quoteRequests}
              userCountries={userCountries}
              customers={customers}
              unreadCounts={unreadCounts}
              lastMessageTimes={lastMessageTimes}
              isModal={true}
            />
          </div>
          
          {/* Right side - Chat window */}
          <div className="flex-1">
            {selectedQuoteRequestId ? (
              <ChatWindow 
                quoteRequestId={selectedQuoteRequestId} 
                userCountries={userCountries}
                userProfile={userProfile}
                onBack={() => onSelectConversation(null)}
                isModal={true}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                <div className="text-center">
                  <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                    <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Select a Conversation</h3>
                  <p className="text-gray-600 max-w-md">Choose a Quote Request from the list to start messaging between countries and collaborate effectively.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface QuoteRequest {
  id: string;
  title: string;
  creatorCountry: string;
  involvedCountry: string;
  customer: string;
  status: string;
}

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

interface FileData {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: Date;
  uploadedBy: string;
  uploadedByCountry: string;
}

// GeneralMessage interface removed - no longer needed

// Quote Request List Component (Enhanced for modal)
const QuoteRequestList = ({ onSelect, selectedId, quoteRequests, userCountries, customers, unreadCounts, lastMessageTimes, isModal = false }: any) => {
  const getCountryCodes = (creatorCountry: string, involvedCountry: string) => {
    const codeMap: any = {
      'Netherlands': 'NL',
      'Germany': 'DE', 
      'France': 'FR',
      'Switzerland': 'CH',
      'UK': 'GB'
    };
    return {
      creator: codeMap[creatorCountry] || creatorCountry.substring(0, 2).toUpperCase(),
      involved: codeMap[involvedCountry] || involvedCountry.substring(0, 2).toUpperCase()
    };
  };

  const getCountryFlags = (creatorCountry: string, involvedCountry: string) => {
    const flagMap: any = {
      'Netherlands': '🇳🇱',
      'Germany': '🇩🇪', 
      'France': '🇫🇷',
      'Switzerland': '🇨🇭',
      'UK': '🇬🇧'
    };
    return {
      creator: flagMap[creatorCountry] || '🏳️',
      involved: flagMap[involvedCountry] || '🏳️'
    };
  };

  const getCustomerName = (customerId: string) => {
    const customer = customers.find((c: any) => c.id === customerId);
    return customer?.name || 'Unknown Customer';
  };

  const getRelativeTime = (timestamp: any) => {
    if (!timestamp) return 'No activity';
    
    try {
      const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
      return dayjs(date).fromNow();
    } catch (error) {
      return 'No activity';
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="p-5 border-b bg-white shadow-sm flex-shrink-0">
        <h3 className="font-bold text-gray-900 text-lg">Conversations</h3>
        <p className="text-sm text-gray-500 mt-1">{quoteRequests.length} active chats</p>
      </div>
      
      <div className="p-3 space-y-2 overflow-y-auto">
        {quoteRequests.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-2xl mb-2">💬</div>
            <p className="text-sm">No active conversations</p>
          </div>
        ) : (
          quoteRequests.map((qr: QuoteRequest) => {
            const countryCodes = getCountryCodes(qr.creatorCountry, qr.involvedCountry);
            const countryFlags = getCountryFlags(qr.creatorCountry, qr.involvedCountry);
            const isSelected = selectedId === qr.id;
            
            return (
              <div
                key={qr.id}
                onClick={() => onSelect(qr.id)}
                className={`
                  relative p-4 rounded-lg cursor-pointer transition-all duration-200 
                  border border-transparent hover:border-gray-200 hover:shadow-sm
                  ${isSelected 
                    ? 'bg-blue-50 border-blue-200 shadow-md ring-2 ring-blue-100' 
                    : 'bg-white hover:bg-gray-50'
                  }
                `}
              >
                {/* Header with title and countries */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h4 
                      className="font-semibold text-gray-900 text-sm leading-tight mb-1 pr-2"
                      title={qr.title}
                    >
                      {qr.title}
                    </h4>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      {getCustomerName(qr.customer)}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        {countryFlags.creator} {countryCodes.creator}
                      </span>
                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                      <span className="flex items-center gap-1">
                        {countryFlags.involved} {countryCodes.involved}
                      </span>
                    </div>
                  </div>
                 
                 {/* Status badge */}
                 <span className={`
                   flex-shrink-0 px-2 py-1 rounded-full text-xs font-medium ml-2
                   ${qr.status === 'In Progress' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 
                     qr.status === 'Snoozed' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                     'bg-gray-100 text-gray-700 border border-gray-200'
                   }
                 `}>
                   {qr.status === 'In Progress' ? '🟢' : qr.status === 'Snoozed' ? '😴' : '⏸️'} {qr.status}
                 </span>
               </div>

               {/* Footer with metadata */}
               <div className="flex items-center justify-between text-xs text-gray-500">
                 <span className="truncate">
                   Last activity: {getRelativeTime(lastMessageTimes[qr.id])}
                 </span>
                 <div className="flex items-center gap-2 flex-shrink-0">
                   {/* Unread indicator */}
                   {unreadCounts[qr.id] > 0 && (
                     <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] text-center">
                       {unreadCounts[qr.id]}
                     </span>
                   )}
                 </div>
               </div>

               {/* Selected indicator */}
               {isSelected && (
                 <div className="absolute left-0 top-4 bottom-4 w-1 bg-blue-500 rounded-r"></div>
               )}
             </div>
           );
         })
       )}
     </div>
   </div>
 );
};

// Chat Window Component  
const ChatWindow = ({ quoteRequestId, userCountries, userProfile, onBack, isModal = false }: any) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedQR, setSelectedQR] = useState<QuoteRequest | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [lastMessageCount, setLastMessageCount] = useState(0);

  // Determine user's country for sending messages
  const getUserSendingCountry = () => {
    if (!selectedQR || !userCountries.length) return userCountries[0] || "Unknown";
    
    // If user has both countries, prefer the one that matches the QR
    if (userCountries.includes(selectedQR.creatorCountry)) return selectedQR.creatorCountry;
    if (userCountries.includes(selectedQR.involvedCountry)) return selectedQR.involvedCountry;
    
    return userCountries[0]; // fallback
  };

  // Format timestamp to relative time
  const getRelativeTime = (timestamp: any) => {
    if (!timestamp) return 'Sending...';
    
    try {
      const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
      return dayjs(date).fromNow();
    } catch (error) {
      return 'Unknown time';
    }
  };

  // Play notification sound for new messages
  const playNotificationSound = () => {
    try {
      const notificationSound = new Audio("/notify.mp3");
      notificationSound.play().catch(error => {
        console.log("Audio notification blocked by browser:", error);
      });
    } catch (error) {
      console.log("Audio notification not available:", error);
    }
  };

  // Fetch Quote Request details
  useEffect(() => {
    if (!quoteRequestId) {
      setSelectedQR(null);
      return;
    }

    const fetchQR = async () => {
      try {
        const qrSnap = await getDocs(collection(db, "quoteRequests"));
        const qr = qrSnap.docs.find(doc => doc.id === quoteRequestId);
        if (qr) {
          setSelectedQR({ id: qr.id, ...qr.data() } as QuoteRequest);
        }
      } catch (error) {
        console.error("Error fetching quote request:", error);
      }
    };

    fetchQR();
  }, [quoteRequestId]);

  // Listen to messages in real-time
  useEffect(() => {
    if (!quoteRequestId) {
      setMessages([]);
      setLastMessageCount(0);
      return;
    }

    // Reset message count when switching conversations
    setLastMessageCount(0);
    
    const messagesRef = collection(db, "quoteRequests", quoteRequestId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"), limit(50));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      
      console.log(`📬 Real-time update: ${messagesList.length} messages loaded for QR ${quoteRequestId}`);
      console.log(`👥 User countries:`, userCountries);
      console.log(`💬 Messages:`, messagesList.map(m => `${m.senderCountry}: ${m.text}`));
      
      // Check for new messages from other countries and play notification
      if (lastMessageCount > 0 && messagesList.length > lastMessageCount) {
        const newMessages = messagesList.slice(lastMessageCount);
        const hasNewMessageFromOthers = newMessages.some(msg => 
          !userCountries.includes(msg.senderCountry)
        );
        
        if (hasNewMessageFromOthers) {
          console.log("🔊 Playing notification sound for new message");
          playNotificationSound();
        }
      }
      
      setMessages(messagesList);
      setLastMessageCount(messagesList.length);
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
      const messageData = {
        senderCountry: getUserSendingCountry(),
        text: newMessage.trim(),
        timestamp: serverTimestamp(),
        status: 'delivered' // Add delivery status
      };
      
      console.log(`📨 Sending message from ${messageData.senderCountry}:`, messageData.text);
      console.log(`📍 Firestore path: quoteRequests/${quoteRequestId}/messages`);
      
      await addDoc(messagesRef, messageData);
      setNewMessage("");
      
      console.log("✅ Message sent successfully");
    } catch (error) {
      console.error("❌ Error sending message:", error);
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

  const handleFileShared = async (fileData: FileData) => {
    if (!quoteRequestId) return;
    
    try {
      const messagesRef = collection(db, "quoteRequests", quoteRequestId, "messages");
      await addDoc(messagesRef, {
        senderCountry: getUserSendingCountry(),
        text: `📎 Shared a file: ${fileData.name}`,
        timestamp: serverTimestamp(),
        status: 'delivered',
        file: {
          id: fileData.id,
          name: fileData.name,
          url: fileData.url,
          type: fileData.type,
          size: fileData.size,
        },
      });
    } catch (error) {
      console.error("Error sharing file:", error);
      alert("Failed to share file. Please try again.");
    }
  };

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

  const isArchived = selectedQR && ['Won', 'Lost', 'Cancelled'].includes(selectedQR.status);

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Chat Header */}
      <div className="p-4 border-b bg-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">{selectedQR?.title}</h3>
            <p className="text-sm text-gray-600">
              {selectedQR?.creatorCountry} ↔ {selectedQR?.involvedCountry}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            selectedQR?.status === 'In Progress' ? 'bg-green-100 text-green-800' :
            selectedQR?.status === 'Snoozed' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {selectedQR?.status}
          </span>
        </div>
      </div>

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
          messages.map((message) => {
            const isFromUser = userCountries.includes(message.senderCountry);
            return (
              <div key={message.id} className={`flex ${isFromUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] rounded-lg px-4 py-2 ${
                  isFromUser 
                    ? 'bg-[#e40115] text-white' 
                    : 'bg-white border border-gray-200 text-gray-900'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium opacity-75">
                      {message.senderCountry}
                    </span>
                    <span className="text-xs opacity-60">
                      {getRelativeTime(message.timestamp)}
                    </span>
                  </div>
                  
                  {message.file ? (
                    <div className="space-y-2">
                      {message.text && (
                        <p className="text-sm">{message.text}</p>
                      )}
                      <div className={`p-3 rounded border ${
                        isFromUser ? 'border-white/20 bg-white/10' : 'border-gray-200 bg-gray-50'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{getFileIcon(message.file.type)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{message.file.name}</p>
                            <p className="text-xs opacity-75">{formatFileSize(message.file.size)}</p>
                          </div>
                        </div>
                        
                        {isImageFile(message.file.type) && (
                          <img 
                            src={message.file.url} 
                            alt={message.file.name}
                            className="max-w-full h-auto rounded border"
                            style={{ maxHeight: '200px' }}
                          />
                        )}
                        
                        <button
                          onClick={() => downloadFile(message.file)}
                          className={`mt-2 px-3 py-1 rounded text-xs font-medium transition-colors ${
                            isFromUser 
                              ? 'bg-white/20 hover:bg-white/30 text-white' 
                              : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                          }`}
                        >
                          Download
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                  )}
                </div>
              </div>
            );
          })
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
              currentCountry={getUserSendingCountry()}
              disabled={false}
            />
          </div>
        </div>
        
        <div className="text-xs text-gray-500 mt-3 flex justify-between items-center">
          <span className="flex items-center gap-1">
            📤 Sending as: <strong>{getUserSendingCountry()}</strong>
          </span>
          <span className="text-right">
            👥 Visible to: {selectedQR?.creatorCountry} & {selectedQR?.involvedCountry}
          </span>
        </div>
      </div>
    </div>
  );
};

// General Communication component removed - no longer needed

// Main Component
interface DashboardMessagingPanelProps {
  selectedQuoteId: string | null;
}

export default function MessagingPanel({ selectedQuoteId }: DashboardMessagingPanelProps) {
  // TODO: Replace these placeholders with real userCountries and userProfile from your auth/user context
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