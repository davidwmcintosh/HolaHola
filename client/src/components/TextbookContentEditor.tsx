import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Edit3,
  Save,
  Plus,
  Trash2,
  GripVertical,
  Image,
  BookOpen,
  FileText,
  MessageCircle,
  Eye,
  EyeOff
} from "lucide-react";

interface ContentBlock {
  id: string;
  type: 'text' | 'vocabulary' | 'grammar' | 'cultural' | 'image' | 'drill';
  title?: string;
  content: string;
  metadata?: Record<string, any>;
  order: number;
  isVisible: boolean;
}

interface TextbookContentEditorProps {
  chapterId?: string;
  lessonId?: string;
  language: string;
  initialBlocks?: ContentBlock[];
  onSave?: (blocks: ContentBlock[]) => void;
  className?: string;
}

function ContentBlockCard({
  block,
  onUpdate,
  onDelete,
  onToggleVisibility
}: {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  onDelete: () => void;
  onToggleVisibility: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  
  const getTypeIcon = () => {
    switch (block.type) {
      case 'text': return <FileText className="h-4 w-4" />;
      case 'vocabulary': return <BookOpen className="h-4 w-4" />;
      case 'grammar': return <FileText className="h-4 w-4" />;
      case 'cultural': return <MessageCircle className="h-4 w-4" />;
      case 'image': return <Image className="h-4 w-4" />;
      case 'drill': return <BookOpen className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };
  
  const getTypeLabel = () => {
    const labels: Record<string, string> = {
      text: 'Text',
      vocabulary: 'Vocabulary',
      grammar: 'Grammar Note',
      cultural: 'Cultural Tip',
      image: 'Image',
      drill: 'Practice Drill'
    };
    return labels[block.type] || block.type;
  };
  
  return (
    <Card className={`relative ${!block.isVisible ? 'opacity-50' : ''}`}>
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <button 
            className="mt-1 text-muted-foreground cursor-grab active:cursor-grabbing touch-manipulation"
            data-testid={`drag-handle-${block.id}`}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                {getTypeIcon()}
                <Badge variant="outline" className="text-xs">
                  {getTypeLabel()}
                </Badge>
              </div>
              
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={onToggleVisibility}
                  data-testid={`toggle-visibility-${block.id}`}
                >
                  {block.isVisible ? (
                    <Eye className="h-3.5 w-3.5" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5" />
                  )}
                </Button>
                
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setIsEditing(!isEditing)}
                  data-testid={`edit-block-${block.id}`}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>
                
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={onDelete}
                  data-testid={`delete-block-${block.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            
            {isEditing ? (
              <div className="space-y-2">
                {block.type !== 'image' && (
                  <>
                    <Input
                      placeholder="Block title (optional)"
                      value={block.title || ''}
                      onChange={(e) => onUpdate({ title: e.target.value })}
                      className="text-sm"
                      data-testid={`input-title-${block.id}`}
                    />
                    <Textarea
                      placeholder="Content..."
                      value={block.content}
                      onChange={(e) => onUpdate({ content: e.target.value })}
                      className="min-h-[80px] text-sm"
                      data-testid={`input-content-${block.id}`}
                    />
                  </>
                )}
                
                {block.type === 'image' && (
                  <>
                    <Input
                      placeholder="Image URL or description for AI generation"
                      value={block.content}
                      onChange={(e) => onUpdate({ content: e.target.value })}
                      className="text-sm"
                      data-testid={`input-image-url-${block.id}`}
                    />
                    <Input
                      placeholder="Alt text / Caption"
                      value={block.title || ''}
                      onChange={(e) => onUpdate({ title: e.target.value })}
                      className="text-sm"
                      data-testid={`input-image-alt-${block.id}`}
                    />
                  </>
                )}
                
                <Button
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  data-testid={`done-editing-${block.id}`}
                >
                  Done
                </Button>
              </div>
            ) : (
              <div>
                {block.title && (
                  <p className="font-medium text-sm mb-1">{block.title}</p>
                )}
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {block.content || <span className="italic">No content</span>}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TextbookContentEditor({
  chapterId,
  lessonId,
  language,
  initialBlocks = [],
  onSave,
  className = ""
}: TextbookContentEditorProps) {
  const [blocks, setBlocks] = useState<ContentBlock[]>(initialBlocks);
  const [hasChanges, setHasChanges] = useState(false);
  const [newBlockType, setNewBlockType] = useState<ContentBlock['type']>('text');
  
  const handleAddBlock = useCallback(() => {
    const newBlock: ContentBlock = {
      id: `block-${Date.now()}`,
      type: newBlockType,
      content: '',
      order: blocks.length,
      isVisible: true,
    };
    
    setBlocks(prev => [...prev, newBlock]);
    setHasChanges(true);
  }, [newBlockType, blocks.length]);
  
  const handleUpdateBlock = useCallback((id: string, updates: Partial<ContentBlock>) => {
    setBlocks(prev => prev.map(b => 
      b.id === id ? { ...b, ...updates } : b
    ));
    setHasChanges(true);
  }, []);
  
  const handleDeleteBlock = useCallback((id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
    setHasChanges(true);
  }, []);
  
  const handleToggleVisibility = useCallback((id: string) => {
    setBlocks(prev => prev.map(b =>
      b.id === id ? { ...b, isVisible: !b.isVisible } : b
    ));
    setHasChanges(true);
  }, []);
  
  const handleSave = useCallback(() => {
    if (onSave) {
      onSave(blocks);
    }
    setHasChanges(false);
  }, [blocks, onSave]);
  
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Edit3 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Content Editor</CardTitle>
          </div>
          
          {hasChanges && (
            <Button 
              size="sm" 
              onClick={handleSave}
              data-testid="button-save-content"
            >
              <Save className="h-4 w-4 mr-1.5" />
              Save Changes
            </Button>
          )}
        </div>
        
        <p className="text-sm text-muted-foreground">
          Customize the content for this {lessonId ? 'lesson' : 'chapter'}
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Select
            value={newBlockType}
            onValueChange={(v) => setNewBlockType(v as ContentBlock['type'])}
          >
            <SelectTrigger className="w-[160px]" data-testid="select-block-type">
              <SelectValue placeholder="Block type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="vocabulary">Vocabulary</SelectItem>
              <SelectItem value="grammar">Grammar Note</SelectItem>
              <SelectItem value="cultural">Cultural Tip</SelectItem>
              <SelectItem value="image">Image</SelectItem>
              <SelectItem value="drill">Practice Drill</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            onClick={handleAddBlock}
            data-testid="button-add-block"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Block
          </Button>
        </div>
        
        {blocks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No content blocks yet</p>
            <p className="text-xs mt-1">Add blocks to customize this content</p>
          </div>
        ) : (
          <div className="space-y-2">
            {blocks
              .sort((a, b) => a.order - b.order)
              .map(block => (
                <ContentBlockCard
                  key={block.id}
                  block={block}
                  onUpdate={(updates) => handleUpdateBlock(block.id, updates)}
                  onDelete={() => handleDeleteBlock(block.id)}
                  onToggleVisibility={() => handleToggleVisibility(block.id)}
                />
              ))}
          </div>
        )}
        
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            {blocks.filter(b => b.isVisible).length} of {blocks.length} blocks visible
          </p>
          
          {blocks.length > 0 && (
            <Badge variant="secondary">
              {language.charAt(0).toUpperCase() + language.slice(1)}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default TextbookContentEditor;
