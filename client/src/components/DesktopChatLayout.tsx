import { useState, useEffect } from "react";
import { ScenarioPanel } from "./ScenarioPanel";
import { WhiteboardPanel } from "./WhiteboardPanel";
import type { WhiteboardItem } from "@shared/whiteboard-types";
import type { ScenarioItemData } from "@shared/whiteboard-types";

export interface StudioImage {
  word: string;
  description: string;
  imageUrl: string;
  context?: string;
}

interface DesktopChatLayoutProps {
  children: React.ReactNode;
  whiteboardItems: WhiteboardItem[];
  onClearWhiteboard?: () => void;
  onDrillComplete?: (drillId: string, drillType: string, isCorrect: boolean, responseTimeMs: number, toolContent?: string) => void;
  onTextInputSubmit?: (itemId: string, response: string) => void;
  activeScenario?: ScenarioItemData | null;
  studioImages?: StudioImage[];
}

type ScreenSize = "mobile" | "tablet" | "desktop";

function useScreenSize(): ScreenSize {
  const [size, setSize] = useState<ScreenSize>(() => {
    if (typeof window === "undefined") return "mobile";
    if (window.innerWidth >= 1024) return "desktop";
    if (window.innerWidth >= 768) return "tablet";
    return "mobile";
  });

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setSize("desktop");
      else if (window.innerWidth >= 768) setSize("tablet");
      else setSize("mobile");
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return size;
}

export function DesktopChatLayout({
  children,
  whiteboardItems,
  onClearWhiteboard,
  onDrillComplete,
  onTextInputSubmit,
  activeScenario,
  studioImages,
}: DesktopChatLayoutProps) {
  const screenSize = useScreenSize();
  const [scenarioCollapsed, setScenarioCollapsed] = useState(false);
  const [whiteboardCollapsed, setWhiteboardCollapsed] = useState(false);

  useEffect(() => {
    if (activeScenario && screenSize === "desktop") {
      setScenarioCollapsed(false);
    }
  }, [activeScenario, screenSize]);

  if (screenSize === "mobile") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-full min-h-0 w-full max-w-[1400px] mx-auto" data-testid="desktop-chat-layout">
      {screenSize === "desktop" && (
        <ScenarioPanel
          scenario={activeScenario}
          isCollapsed={scenarioCollapsed}
          onToggleCollapse={() => setScenarioCollapsed((prev) => !prev)}
          studioImages={studioImages}
        />
      )}

      <div className="flex-1 min-h-0 min-w-0 relative">
        {children}
      </div>

      <WhiteboardPanel
        items={whiteboardItems}
        onClear={onClearWhiteboard}
        onDrillComplete={onDrillComplete}
        onTextInputSubmit={onTextInputSubmit}
        isCollapsed={whiteboardCollapsed}
        onToggleCollapse={() => setWhiteboardCollapsed((prev) => !prev)}
      />
    </div>
  );
}
