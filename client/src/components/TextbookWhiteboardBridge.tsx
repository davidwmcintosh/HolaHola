import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Presentation,
  BookOpen,
  Volume2,
  Image,
  FileText,
  ArrowRight,
  Check
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TextbookContent {
  type: 'vocabulary' | 'grammar' | 'culture' | 'image' | 'drill';
  title: string;
  content: string;
  imageUrl?: string;
  chapterId?: string;
  lessonId?: string;
  language: string;
}

interface TextbookWhiteboardBridgeProps {
  content: TextbookContent;
  className?: string;
}

export function TextbookWhiteboardBridge({
  content,
  className = ""
}: TextbookWhiteboardBridgeProps) {
  const { toast } = useToast();
  
  const handlePinToWhiteboard = useCallback(() => {
    const whiteboardContent = {
      type: content.type,
      title: content.title,
      content: content.content,
      imageUrl: content.imageUrl,
      source: 'textbook',
      chapterId: content.chapterId,
      lessonId: content.lessonId,
      language: content.language,
      timestamp: Date.now(),
    };
    
    try {
      const stored = localStorage.getItem('pinnedWhiteboardContent');
      const existing = stored ? JSON.parse(stored) : [];
      existing.push(whiteboardContent);
      localStorage.setItem('pinnedWhiteboardContent', JSON.stringify(existing.slice(-10)));
      
      toast({
        title: "Pinned to Voice Session",
        description: `"${content.title}" will appear on Daniela's whiteboard in your next voice session.`,
      });
    } catch (error) {
      console.error('Failed to pin content:', error);
    }
  }, [content, toast]);
  
  const getContentIcon = () => {
    switch (content.type) {
      case 'vocabulary': return <BookOpen className="h-4 w-4" />;
      case 'grammar': return <FileText className="h-4 w-4" />;
      case 'culture': return <BookOpen className="h-4 w-4" />;
      case 'image': return <Image className="h-4 w-4" />;
      case 'drill': return <Volume2 className="h-4 w-4" />;
      default: return <BookOpen className="h-4 w-4" />;
    }
  };
  
  return (
    <Card className={`border-dashed ${className}`}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {getContentIcon()}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{content.title}</p>
              <p className="text-xs text-muted-foreground truncate">{content.content}</p>
            </div>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handlePinToWhiteboard}
            className="shrink-0"
            data-testid="button-pin-to-whiteboard"
          >
            <Presentation className="h-4 w-4 mr-1.5" />
            Pin
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface PinnedContentPreviewProps {
  className?: string;
}

export function PinnedContentPreview({ className = "" }: PinnedContentPreviewProps) {
  const stored = localStorage.getItem('pinnedWhiteboardContent');
  const pinnedItems = stored ? JSON.parse(stored) : [];
  
  if (pinnedItems.length === 0) {
    return null;
  }
  
  return (
    <Card className={className}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Presentation className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Pinned for Voice Session</span>
          <Badge variant="secondary" className="text-xs">
            {pinnedItems.length}
          </Badge>
        </div>
        
        <div className="space-y-1">
          {pinnedItems.slice(-3).map((item: any, index: number) => (
            <div 
              key={index}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <Check className="h-3 w-3 text-green-500" />
              <span className="truncate">{item.title}</span>
            </div>
          ))}
        </div>
        
        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
          <span>Ready for</span>
          <ArrowRight className="h-3 w-3" />
          <span className="text-primary font-medium">Voice Chat</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function clearPinnedContent() {
  localStorage.removeItem('pinnedWhiteboardContent');
}

export function getPinnedContent(): TextbookContent[] {
  const stored = localStorage.getItem('pinnedWhiteboardContent');
  return stored ? JSON.parse(stored) : [];
}

export default TextbookWhiteboardBridge;
