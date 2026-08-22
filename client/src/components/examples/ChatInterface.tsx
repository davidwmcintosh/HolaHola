import { useState } from "react";
import { ChatInterface } from "../ChatInterface";

export default function ChatInterfaceExample() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  return (
    <ChatInterface
      conversationId={conversationId}
      setConversationId={setConversationId}
      setCurrentConversationOnboarding={() => {}}
    />
  );
}
