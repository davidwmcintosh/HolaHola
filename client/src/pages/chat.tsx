import { useState } from "react";
import { ChatInterface } from "@/components/ChatInterface";
import { VoiceChat } from "@/components/VoiceChat";
import { TopicSelector } from "@/components/TopicSelector";

export default function Chat() {
  const [mode, setMode] = useState<"text" | "voice">("voice");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [showTopicSelector, setShowTopicSelector] = useState(true);

  const handleTopicSelect = (topicName: string) => {
    setSelectedTopic(topicName);
    setShowTopicSelector(false);
  };

  const handleSkipTopic = () => {
    setSelectedTopic(null);
    setShowTopicSelector(false);
  };

  if (showTopicSelector) {
    return (
      <div className="h-full overflow-auto">
        <TopicSelector onSelectTopic={handleTopicSelect} onSkip={handleSkipTopic} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {mode === "voice" ? (
        <VoiceChat selectedTopic={selectedTopic} />
      ) : (
        <ChatInterface selectedTopic={selectedTopic} />
      )}
    </div>
  );
}
