"use client";
import React, { useState, useEffect, useRef } from "react";
import { collection, getDocs, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAuth } from "../AuthProvider";
import DashboardFileSharing from "../components/DashboardFileSharing";
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

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

// Quote Request List Component
const QuoteRequestList = ({ onSelect, selectedId, quoteRequests, userCountries, customers, unreadCounts, lastMessageTimes }: any) => {
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
    <div className="w-[420px] border-r h-full overflow-y-auto bg-gray-50">
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
const ChatWindow = ({ quoteRequestId, userCountries, userProfile, onBack }: any) => {
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

  if (!quoteRequestId) {
    return (
      <div className="flex-1 h-full bg-gray-50">
      </div>
    );
  }

  const isArchived = selectedQR && ['Won', 'Lost', 'Cancelled'].includes(selectedQR.status);

  return (
    <div className="flex-1 flex flex-col h-full">
      {!quoteRequestId ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-4">💬</div>
            <p className="text-lg font-medium">Select a conversation</p>
            <p className="text-sm">Choose a Quote Request from the list to start messaging</p>
          </div>
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
};

// General Communication component removed - no longer needed

// Main Component
interface DashboardMessagingPanelProps {
  selectedQuoteId: string | null;
}

export default function DashboardMessagingPanel({ selectedQuoteId }: DashboardMessagingPanelProps) {
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [lastMessageTimes, setLastMessageTimes] = useState<Record<string, any>>({});
  const [lastReadTimes, setLastReadTimes] = useState<Record<string, any>>({});
  const { userProfile } = useAuth();

  // Fetch Quote Requests and Customers (same filtering as dashboard)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [qrSnap, custSnap] = await Promise.all([
          getDocs(collection(db, "quoteRequests")),
          getDocs(collection(db, "customers"))
        ]);
        
        const allRequests = qrSnap.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        })) as QuoteRequest[];

        const allCustomers = custSnap.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));

        // Filter by user's countries and exclude archived
        const userCountries = userProfile?.countries || [];
        const visibleRequests = userProfile?.role === "superAdmin" || userCountries.length === 0
          ? allRequests.filter(qr => !['Won', 'Lost', 'Cancelled'].includes(qr.status)) // SuperAdmin sees all, or if no countries set, show all
          : allRequests.filter(qr => {
              // Check if user countries match creator or involved country (using partial matching)
              const creatorMatch = userCountries.some((userCountry: string) => 
                qr.creatorCountry?.toLowerCase().includes(userCountry.toLowerCase()) ||
                userCountry.toLowerCase().includes(qr.creatorCountry?.toLowerCase())
              );
              const involvedMatch = userCountries.some((userCountry: string) => 
                qr.involvedCountry?.toLowerCase().includes(userCountry.toLowerCase()) ||
                userCountry.toLowerCase().includes(qr.involvedCountry?.toLowerCase())
              );
              return (creatorMatch || involvedMatch) && !['Won', 'Lost', 'Cancelled'].includes(qr.status);
            });

        setQuoteRequests(visibleRequests);
        setCustomers(allCustomers);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (userProfile) {
      fetchData();
    }
  }, [userProfile]);

  // Track unread messages for all conversations
  useEffect(() => {
    if (!userProfile || quoteRequests.length === 0) return;

    const userCountries = userProfile.countries || [];
    const unsubscribeFunctions: (() => void)[] = [];

    quoteRequests.forEach(qr => {
      const messagesRef = collection(db, "quoteRequests", qr.id, "messages");
      const q = query(messagesRef, orderBy("timestamp", "desc"));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Message[];
        
        // Get last read time for this conversation
        const lastReadTime = lastReadTimes[qr.id];
        
        // Count unread messages (from other countries AND after last read time)
        const unreadCount = messages.filter(msg => {
          // Must be from other country
          if (userCountries.includes(msg.senderCountry)) return false;
          
          // If no read time recorded, only count recent messages (last 24 hours)
          if (!lastReadTime) {
            const msgDate = msg.timestamp?.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp);
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            return msgDate > oneDayAgo;
          }
          
          // Count messages after last read time
          const msgDate = msg.timestamp?.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp);
          const readDate = lastReadTime?.toDate ? lastReadTime.toDate() : new Date(lastReadTime);
          return msgDate > readDate;
        }).length;
        
        // Get last message timestamp
        const lastMessageTime = messages.length > 0 ? messages[0].timestamp : null;
        
        console.log(`📊 Unread count for QR ${qr.id}:`, {
          totalMessages: messages.length,
          messagesFromOtherCountries: messages.filter(msg => !userCountries.includes(msg.senderCountry)).length,
          unreadCount,
          lastReadTime,
          userCountries
        });
        
        setUnreadCounts(prev => ({
          ...prev,
          [qr.id]: unreadCount
        }));
        
        setLastMessageTimes(prev => ({
          ...prev,
          [qr.id]: lastMessageTime
        }));
      });
      
      unsubscribeFunctions.push(unsubscribe);
    });

    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }, [userProfile, quoteRequests]);

  // Reset unread count when opening a conversation
  const handleSelectConversation = (quoteRequestId: string) => {
    // Mark conversation as read by storing current timestamp
    const currentTime = new Date();
    setLastReadTimes(prev => ({
      ...prev,
      [quoteRequestId]: currentTime
    }));
    
    setUnreadCounts(prev => ({
      ...prev,
      [quoteRequestId]: 0
    }));
  };

  if (loading) {
    return (
      <div className="flex h-[600px] bg-white rounded shadow border overflow-hidden items-center justify-center">
        <div>Loading messaging...</div>
      </div>
    );
  }

  if (!selectedQuoteId) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-gray-500 text-lg">
        Select a Quote Request to start messaging…
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col"> {/* Adjust 64px if header is different height */}
      {/* Header */}
      <div className="mb-3 flex-shrink-0">
        <p className="text-sm text-gray-600">
          Choose a Quote Request from the list to start messaging between countries
        </p>
      </div>
      {/* Messaging Panel */}
      <div className="flex flex-1 min-h-0 bg-white rounded-lg shadow-lg border p-4 gap-4 overflow-hidden"> {/* Visual separation, padding */}
        {/* Conversations List */}
        <div className="flex flex-col w-[320px] min-w-[280px] max-w-[360px] h-full bg-gray-50 border-r rounded-l-lg overflow-hidden">
          {/* Sticky header */}
          <div className="sticky top-0 z-10 bg-white shadow-sm border-b p-4">
            <h3 className="font-bold text-gray-900 text-base">Conversations</h3>
            <p className="text-sm text-gray-500 mt-1">{quoteRequests.length} active chats</p>
          </div>
          {/* Scrollable list */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
            {/* Render conversation items here (reuse QuoteRequestList logic) */}
            <QuoteRequestList
              onSelect={handleSelectConversation}
              selectedId={selectedQuoteId}
              quoteRequests={quoteRequests}
              userCountries={userProfile?.countries || []}
              customers={customers}
              unreadCounts={unreadCounts}
              lastMessageTimes={lastMessageTimes}
            />
          </div>
        </div>
        {/* Chat View */}
        <div className="flex-1 flex flex-col h-full min-w-0">
          {/* Chat messages area (scrollable) */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2 space-y-4 text-base">
            {/* ... existing code for chat messages ... */}
            <ChatWindow 
              quoteRequestId={selectedQuoteId} 
              userCountries={userProfile?.countries || []}
              userProfile={userProfile}
              onBack={() => {}}
            />
          </div>
          {/* File-drop and message input area (sticky/pinned to bottom) */}
          <div className="sticky bottom-0 z-10 bg-white pt-2 pb-4 px-4 border-t flex flex-col gap-2">
            {/* ... existing code for file drop and message input ... */}
          </div>
        </div>
      </div>
    </div>
  );
} 