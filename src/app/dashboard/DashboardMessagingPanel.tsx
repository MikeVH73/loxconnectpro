import React from "react";
import MessagingPanel from "../components/MessagingPanel";

interface Message {
  id: string;
  text: string;
  createdAt: Date;
  sender: string;
  senderCountry: string;
}

interface DashboardMessagingPanelProps {
  messages: Message[];
  currentUser: string;
  currentCountry: string;
  onSendMessage: (text: string) => void;
  selectedQuoteId: string | null;
}

export default function DashboardMessagingPanel({
  messages,
  currentUser,
  currentCountry,
  onSendMessage,
  selectedQuoteId
}: DashboardMessagingPanelProps) {
  if (!selectedQuoteId) {
    return (
      <div className="w-[400px] h-full bg-white border-l flex items-center justify-center text-gray-500">
        Select a quote request to view messages
      </div>
    );
  }

  return (
    <div className="w-[400px] h-full bg-white border-l">
      <MessagingPanel
        messages={messages}
        currentUser={currentUser}
        currentCountry={currentCountry}
        onSendMessage={onSendMessage}
      />
    </div>
  );
}
