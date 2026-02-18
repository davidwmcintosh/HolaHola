import { useState } from "react";
import { MapPin, ChevronLeft, ChevronRight, Sparkles, BookOpen, Target, BookText, MessageCircle, UtensilsCrossed, FileText, CreditCard, MapIcon, List, Receipt, ChevronDown, ChevronUp, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ScenarioItemData, ScenarioLoadedProp } from "@shared/whiteboard-types";

interface ScenarioPanelProps {
  scenario?: ScenarioItemData | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

function PropIcon({ propType }: { propType: string }) {
  switch (propType) {
    case 'menu': return <UtensilsCrossed className="h-3.5 w-3.5" />;
    case 'document': return <FileText className="h-3.5 w-3.5" />;
    case 'card': return <CreditCard className="h-3.5 w-3.5" />;
    case 'map': return <MapIcon className="h-3.5 w-3.5" />;
    case 'list': return <List className="h-3.5 w-3.5" />;
    case 'bill': return <Receipt className="h-3.5 w-3.5" />;
    case 'image': return <ImageIcon className="h-3.5 w-3.5" />;
    default: return <FileText className="h-3.5 w-3.5" />;
  }
}

function MenuRenderer({ content }: { content: any }) {
  const sections = content?.sections;
  if (!sections || !Array.isArray(sections)) return null;

  return (
    <div className="space-y-2">
      {sections.map((section: any, si: number) => (
        <div key={si} className="space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {section.name_target || section.name}
          </div>
          <div className="space-y-0.5">
            {section.items?.map((item: any, ii: number) => (
              <div key={ii} className="flex items-baseline justify-between gap-2" data-testid={`text-menu-item-${si}-${ii}`}>
                <div className="min-w-0">
                  <span className="text-xs font-medium">{item.name_target || item.name}</span>
                  {item.description_target && (
                    <span className="text-[10px] text-muted-foreground ml-1">
                      — {item.description_target}
                    </span>
                  )}
                </div>
                {item.price && (
                  <span className="text-xs font-medium flex-shrink-0">
                    {item.price.includes('€') || item.price.includes('$') ? item.price : `€${item.price}`}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FieldsRenderer({ content }: { content: any }) {
  const fields = content?.fields;
  if (!fields || !Array.isArray(fields)) return null;

  return (
    <div className="space-y-1">
      {content.title && (
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          {content.title}
        </div>
      )}
      {fields.map((field: any, i: number) => (
        <div key={i} className="flex items-baseline justify-between gap-2" data-testid={`text-field-${i}`}>
          <span className="text-[11px] text-muted-foreground flex-shrink-0">{field.label}</span>
          <span className="text-xs font-medium text-right">{field.value}</span>
        </div>
      ))}
    </div>
  );
}

function MapRenderer({ content }: { content: any }) {
  const locations = content?.locations;
  if (!locations || !Array.isArray(locations)) return null;

  return (
    <div className="space-y-1">
      {locations.map((loc: any, i: number) => (
        <div key={i} className="flex items-start gap-1.5" data-testid={`text-map-location-${i}`}>
          <div className="mt-0.5 h-4 w-4 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
            <span className="text-[9px] font-bold text-muted-foreground">{i + 1}</span>
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium">{loc.name_target || loc.name}</div>
            {loc.description && (
              <div className="text-[10px] text-muted-foreground">{loc.description}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ListRenderer({ content }: { content: any }) {
  const items = content?.items;
  if (!items || !Array.isArray(items)) return null;

  return (
    <div className="space-y-0.5">
      {items.map((item: any, i: number) => (
        <div key={i} className="flex items-center gap-1.5" data-testid={`text-list-item-${i}`}>
          <div className={`h-3 w-3 rounded-sm border flex items-center justify-center flex-shrink-0 ${
            item.checked ? 'bg-foreground border-foreground' : 'border-muted-foreground/40'
          }`}>
            {item.checked && (
              <svg className="h-2 w-2 text-background" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <span className={`text-xs ${item.checked ? 'line-through text-muted-foreground' : ''}`}>
            {item.name_target || item.name}
          </span>
        </div>
      ))}
    </div>
  );
}

function PropContentRenderer({ prop }: { prop: ScenarioLoadedProp }) {
  switch (prop.propType) {
    case 'menu':
      return <MenuRenderer content={prop.content} />;
    case 'bill':
    case 'document':
    case 'card':
      return <FieldsRenderer content={prop.content} />;
    case 'map':
      return <MapRenderer content={prop.content} />;
    case 'list':
      return <ListRenderer content={prop.content} />;
    default:
      return null;
  }
}

function ScenarioPropCard({ prop }: { prop: ScenarioLoadedProp }) {
  const [expanded, setExpanded] = useState(false);
  const hasContent = prop.content && (
    prop.content.sections ||
    prop.content.fields ||
    prop.content.locations ||
    prop.content.items
  );

  return (
    <div className="rounded-md border bg-background" data-testid={`prop-card-${prop.id}`}>
      <Button
        variant="ghost"
        className="flex items-center gap-1.5 w-full justify-start text-left"
        onClick={() => hasContent && setExpanded(!expanded)}
        data-testid={`button-toggle-prop-${prop.id}`}
      >
        <PropIcon propType={prop.propType} />
        <span className="text-xs font-medium flex-1">{prop.title}</span>
        {prop.isInteractive && (
          <Badge variant="secondary" className="text-[10px] px-1 py-0">
            interactive
          </Badge>
        )}
        {hasContent && (
          expanded
            ? <ChevronUp className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            : <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        )}
      </Button>
      <div className={expanded && hasContent ? "px-2.5 pb-2.5 pt-0 border-t" : "hidden"}>
        <div className="pt-2">
          <PropContentRenderer prop={prop} />
        </div>
      </div>
    </div>
  );
}

export function ScenarioPanel({ scenario, isCollapsed, onToggleCollapse }: ScenarioPanelProps) {
  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center py-4 w-10 border-r bg-muted/30">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          data-testid="button-expand-scenario-panel"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        {scenario && (
          <div className="mt-4 writing-mode-vertical text-xs text-muted-foreground rotate-180" style={{ writingMode: 'vertical-rl' }}>
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {scenario.location}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col w-[280px] border-r bg-muted/30 min-h-0 overflow-hidden" data-testid="panel-scenario">
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Scene</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          data-testid="button-collapse-scenario-panel"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {scenario ? (
          <div className="space-y-3">
            {scenario.imageUrl && (
              <div className="rounded-md overflow-hidden border">
                <img
                  src={scenario.imageUrl}
                  alt={scenario.location}
                  className="w-full h-40 object-cover"
                  data-testid="img-scenario-scene"
                />
              </div>
            )}
            {scenario.isLoading && !scenario.imageUrl && (
              <div className="rounded-md border h-40 flex items-center justify-center bg-muted/50 animate-pulse">
                <Sparkles className="h-6 w-6 text-muted-foreground" />
              </div>
            )}

            <div className="space-y-2">
              <h3 className="font-semibold text-sm flex items-center gap-1.5" data-testid="text-scenario-location">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                {scenario.location}
              </h3>
              <p className="text-sm text-muted-foreground" data-testid="text-scenario-situation">
                {scenario.situation}
              </p>
              {scenario.mood && (
                <Badge variant="secondary" data-testid="text-scenario-mood">
                  {scenario.mood}
                </Badge>
              )}
            </div>

            {scenario.levelGuide && (
              <div className="space-y-2 pt-1 border-t">
                {scenario.levelGuide.studentGoals && scenario.levelGuide.studentGoals.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Target className="h-3 w-3" />
                      Goals
                    </div>
                    <ul className="space-y-0.5 pl-4" data-testid="list-scenario-goals">
                      {scenario.levelGuide.studentGoals.map((goal, i) => (
                        <li key={i} className="text-xs text-muted-foreground list-disc">{goal}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {scenario.levelGuide.vocabularyFocus && scenario.levelGuide.vocabularyFocus.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <BookText className="h-3 w-3" />
                      Key Vocabulary
                    </div>
                    <div className="flex flex-wrap gap-1" data-testid="list-scenario-vocab">
                      {scenario.levelGuide.vocabularyFocus.map((word, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                          {word}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {scenario.levelGuide.conversationStarters && scenario.levelGuide.conversationStarters.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <MessageCircle className="h-3 w-3" />
                      Conversation Starters
                    </div>
                    <div className="space-y-1" data-testid="list-scenario-starters">
                      {scenario.levelGuide.conversationStarters.map((starter, i) => (
                        <p key={i} className="text-xs text-muted-foreground italic pl-2 border-l-2 border-primary/30">
                          {starter}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {scenario.props && scenario.props.length > 0 && (
              <div className="space-y-2 pt-1 border-t">
                <div className="text-xs font-medium text-muted-foreground">Props</div>
                <div className="space-y-1.5" data-testid="list-scenario-props">
                  {scenario.props.map(prop => (
                    <ScenarioPropCard key={prop.id} prop={prop} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">No active scene</p>
            <p className="text-xs text-muted-foreground max-w-[200px]">
              Daniela will set the scene when a scenario begins
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
