import { useState, useEffect, useRef } from "react";
import { Tv, ChevronLeft, ChevronRight, Sparkles, BookOpen, UtensilsCrossed, FileText, CreditCard, MapIcon, List, Receipt, ImageIcon, ZoomIn, Cloud, Clock, Smile, Calendar, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ScenarioItemData, ScenarioLoadedProp, SceneCanvasItemData } from "@shared/whiteboard-types";
import type { StudioImage } from "./DesktopChatLayout";
import { SceneCanvas } from "@/components/SceneCanvas";

interface ScenarioPanelProps {
  scenario?: ScenarioItemData | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  studioImages?: StudioImage[];
  sceneCanvas?: SceneCanvasItemData | null;
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

function MenuItemImage({ query }: { query: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/menu-image?q=${encodeURIComponent(query)}`)
      .then(r => r.json())
      .then(data => {
        if (!cancelled && data.url) setUrl(data.url);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query]);

  if (loading) {
    return <div className="w-10 h-10 rounded bg-muted/60 animate-pulse flex-shrink-0" />;
  }
  if (!url) return null;

  return (
    <img
      src={url}
      alt={query}
      className="w-10 h-10 rounded object-cover flex-shrink-0"
      loading="lazy"
      data-testid={`img-menu-item-${query.replace(/\s+/g, '-').toLowerCase()}`}
    />
  );
}

function BeginnerMenuRenderer({ content }: { content: any }) {
  const sections = content?.sections;
  if (!sections || !Array.isArray(sections)) return null;

  return (
    <div className="space-y-3">
      {sections.map((section: any, si: number) => (
        <div key={si} className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {section.name_target || section.name}
            {section.name_target && section.name_target !== section.name && (
              <span className="ml-1 font-normal normal-case">({section.name})</span>
            )}
          </div>
          <div className="space-y-1">
            {section.items?.map((item: any, ii: number) => (
              <div key={ii} className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5" data-testid={`text-menu-item-${si}-${ii}`}>
                <MenuItemImage query={item.name} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold">{item.name_target || item.name}</div>
                  {item.name_target && item.name_target !== item.name && (
                    <div className="text-[10px] text-muted-foreground">{item.name}</div>
                  )}
                </div>
                {item.price && (
                  <span className="text-[11px] font-semibold flex-shrink-0 text-muted-foreground">
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

function AdvancedMenuRenderer({ content }: { content: any }) {
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

function resolveMenuContent(content: any, language: string, difficulty: string): any {
  const resolved = content?.byLanguage?.[language]?.[difficulty]
    || content?.byLanguage?.[language]?.beginner
    || content;
  return resolved;
}

function MenuRenderer({ content, difficulty }: { content: any; difficulty: string }) {
  const { language } = useLanguage();
  const resolved = resolveMenuContent(content, language, difficulty);
  if (difficulty === "beginner") {
    return <BeginnerMenuRenderer content={resolved} />;
  }
  return <AdvancedMenuRenderer content={resolved} />;
}

function resolveFieldsContent(content: any, difficulty: string): any {
  if (content?.byDifficulty) {
    return content.byDifficulty[difficulty]
      || content.byDifficulty.intermediate
      || content.byDifficulty.beginner
      || content;
  }
  return content;
}

function FieldsRenderer({ content, difficulty }: { content: any; difficulty: string }) {
  const resolved = resolveFieldsContent(content, difficulty);
  const fields = resolved?.fields;
  if (!fields || !Array.isArray(fields)) return null;

  return (
    <div className="space-y-1">
      {resolved.title && (
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          {resolved.title}
        </div>
      )}
      {fields.map((field: any, i: number) => {
        const isMultiLine = typeof field.value === 'string' && field.value.includes('\n');
        if (isMultiLine) {
          return (
            <div key={i} className="space-y-0.5" data-testid={`text-field-${i}`}>
              <span className="text-[11px] text-muted-foreground">{field.label}</span>
              <div className="text-xs font-medium whitespace-pre-wrap leading-snug pl-1 border-l-2 border-muted">
                {field.value}
              </div>
            </div>
          );
        }
        return (
          <div key={i} className="flex items-baseline justify-between gap-2" data-testid={`text-field-${i}`}>
            <span className="text-[11px] text-muted-foreground flex-shrink-0">{field.label}</span>
            <span className="text-xs font-medium text-right">{field.value}</span>
          </div>
        );
      })}
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

function PropContentRenderer({ prop, difficulty }: { prop: ScenarioLoadedProp; difficulty: string }) {
  switch (prop.propType) {
    case 'menu':
      return <MenuRenderer content={prop.content} difficulty={difficulty} />;
    case 'bill':
    case 'document':
    case 'card':
      return <FieldsRenderer content={prop.content} difficulty={difficulty} />;
    case 'map':
      return <MapRenderer content={prop.content} />;
    case 'list':
      return <ListRenderer content={prop.content} />;
    default:
      return null;
  }
}

function ScenarioPropCard({ prop, difficulty }: { prop: ScenarioLoadedProp; difficulty: string }) {
  const hasContent = prop.content && (
    prop.content.sections ||
    prop.content.fields ||
    prop.content.locations ||
    prop.content.items
  );

  if (!hasContent) return null;

  return (
    <div className="rounded-md border bg-background" data-testid={`prop-card-${prop.id}`}>
      <div className="flex items-center gap-1.5 px-2.5 py-2 border-b">
        <PropIcon propType={prop.propType} />
        <span className="text-xs font-medium flex-1">{prop.title}</span>
      </div>
      <div className="px-2.5 pb-2.5 pt-2">
        <PropContentRenderer prop={prop} difficulty={difficulty} />
      </div>
    </div>
  );
}

function ImageLightbox({ url, label, open, onClose }: { url: string; label: string; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black border-0" data-testid="image-lightbox">
        <img
          src={url}
          alt={label}
          className="w-full h-auto max-h-[80vh] object-contain"
          data-testid="img-lightbox-full"
        />
        {label && (
          <p className="text-white/80 text-sm text-center px-4 py-2 bg-black/70">{label}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function categoryIcon(category?: string) {
  switch (category?.toLowerCase()) {
    case 'weather': return <Cloud className="h-3 w-3" />;
    case 'time': return <Clock className="h-3 w-3" />;
    case 'emotion': return <Smile className="h-3 w-3" />;
    case 'calendar': return <Calendar className="h-3 w-3" />;
    default: return <Star className="h-3 w-3" />;
  }
}

function ContextStrip({ images, onLightbox }: { images: StudioImage[]; onLightbox: (url: string, label: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5 w-[68px] shrink-0" data-testid="studio-context-strip">
      {images.map((img, i) => (
        <div
          key={`${img.category}-${i}`}
          className="rounded-md overflow-hidden border bg-background cursor-zoom-in relative group"
          data-testid={`studio-context-${img.category || i}`}
          onClick={() => onLightbox(img.imageUrl, img.description || img.word)}
          title={img.description || img.word}
        >
          <img
            src={img.imageUrl}
            alt={img.description}
            className="w-full h-[60px] object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
            <ZoomIn className="h-4 w-4 text-white drop-shadow" />
          </div>
          {img.category && (
            <div className="flex items-center gap-0.5 px-1 py-0.5 bg-background/90">
              {categoryIcon(img.category)}
              <span className="text-[9px] text-muted-foreground truncate capitalize">{img.category}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function StudioImageGallery({ images }: { images: StudioImage[] }) {
  const latestImage = images[images.length - 1];
  const previousImages = images.slice(0, -1);
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);

  return (
    <div className="space-y-2" data-testid="studio-image-gallery">
      <div
        className="rounded-md overflow-hidden border bg-background cursor-zoom-in relative group"
        data-testid={`studio-image-${latestImage.word}`}
        onClick={() => setLightbox({ url: latestImage.imageUrl, label: latestImage.description || latestImage.word })}
      >
        <img
          src={latestImage.imageUrl}
          alt={latestImage.description}
          className="w-full h-44 object-cover"
          data-testid="img-studio-latest"
        />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
          <ZoomIn className="h-7 w-7 text-white drop-shadow" />
        </div>
        <div className="px-2.5 py-2">
          <p className="text-sm font-semibold truncate text-center">{latestImage.word}</p>
          {latestImage.description && latestImage.description !== latestImage.word && (
            <p className="text-xs text-muted-foreground line-clamp-2">{latestImage.description}</p>
          )}
        </div>
      </div>

      {previousImages.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5">
          {previousImages.map((img, i) => (
            <div
              key={`${img.word}-${i}`}
              className="rounded-md overflow-hidden border bg-background cursor-zoom-in relative group"
              data-testid={`studio-image-prev-${i}`}
              onClick={() => setLightbox({ url: img.imageUrl, label: img.description || img.word })}
            >
              <img
                src={img.imageUrl}
                alt={img.description}
                className="w-full h-20 object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                <ZoomIn className="h-5 w-5 text-white drop-shadow" />
              </div>
              <p className="text-[11px] font-medium px-1.5 py-1 truncate">{img.word}</p>
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <ImageLightbox
          url={lightbox.url}
          label={lightbox.label}
          open={true}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

export function ScenarioPanel({ scenario, isCollapsed, onToggleCollapse, studioImages, sceneCanvas }: ScenarioPanelProps) {
  const { difficulty } = useLanguage();
  const [sceneLightbox, setSceneLightbox] = useState<{ url: string; label: string } | null>(null);
  const [zoneImageFading, setZoneImageFading] = useState(false);
  const prevImageUrlRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const prevUrl = prevImageUrlRef.current;
    if (scenario?.imageUrl && prevUrl && prevUrl !== scenario.imageUrl) {
      setZoneImageFading(true);
      const timer = setTimeout(() => setZoneImageFading(false), 400);
      prevImageUrlRef.current = scenario.imageUrl;
      return () => clearTimeout(timer);
    }
    prevImageUrlRef.current = scenario?.imageUrl;
  }, [scenario?.imageUrl]);

  const hasCanvas = Boolean(sceneCanvas);
  const contextImages = (studioImages || []).filter(img => img.slot === 'context');
  const mainImages = (studioImages || []).filter(img => img.slot !== 'context');
  const hasContextStrip = contextImages.length > 0;
  const canvasLabel = sceneCanvas?.environmentLabel || (sceneCanvas?.clockTime ? 'Clock' : 'Stage');

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
        <div className="mt-4 writing-mode-vertical text-xs text-muted-foreground rotate-180" style={{ writingMode: 'vertical-rl' }}>
          <span className="flex items-center gap-1">
            <Tv className="h-3 w-3" />
            {hasCanvas ? canvasLabel : (scenario ? scenario.location : 'Studio')}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-[280px] border-r bg-muted/30 min-h-0 overflow-hidden" data-testid="panel-scenario">
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <Tv className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Studio</span>
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
        <div className={hasContextStrip ? "flex gap-2 min-h-0" : "space-y-3"}>
          {hasContextStrip && (
            <ContextStrip
              images={contextImages}
              onLightbox={(url, label) => setSceneLightbox({ url, label })}
            />
          )}

          <div className={hasContextStrip ? "flex-1 min-w-0 space-y-3" : "space-y-3"}>
            {hasCanvas && (
              <SceneCanvas
                data={sceneCanvas!}
                data-testid="studio-scene-canvas"
              />
            )}

            {scenario ? (
              <>
                {!hasCanvas && scenario.imageUrl && (
                  <div
                    className="rounded-md overflow-hidden border cursor-zoom-in relative group"
                    onClick={() => setSceneLightbox({ url: scenario.imageUrl!, label: scenario.currentZoneName || scenario.location || scenario.title || '' })}
                  >
                    <img
                      src={scenario.imageUrl}
                      alt={scenario.currentZoneName || scenario.location}
                      className={`w-full h-40 object-cover transition-opacity duration-300 ${zoneImageFading ? 'opacity-0' : 'opacity-100'}`}
                      data-testid="img-scenario-scene"
                    />
                    {/* Zone name badge */}
                    {scenario.currentZoneName && (
                      <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/50 backdrop-blur-sm">
                        <span className="text-white text-xs font-medium" data-testid="text-scenario-zone-name">
                          {scenario.currentZoneName}
                        </span>
                        {scenario.zones && scenario.zones.length > 1 && typeof scenario.currentZoneIndex === 'number' && (
                          <span className="text-white/60 text-xs ml-1.5">
                            {scenario.currentZoneIndex + 1}/{scenario.zones.length}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                      <ZoomIn className="h-7 w-7 text-white drop-shadow" />
                    </div>
                  </div>
                )}
                {!hasCanvas && scenario.isLoading && !scenario.imageUrl && (
                  <div className="rounded-md border h-40 flex items-center justify-center bg-muted/50 animate-pulse">
                    <Sparkles className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}

                {mainImages.length > 0 && (
                  <StudioImageGallery images={mainImages} />
                )}

                {scenario.props && scenario.props.length > 0 && (
                  <div className="space-y-2" data-testid="list-scenario-props">
                    {scenario.props.map(prop => (
                      <ScenarioPropCard key={prop.id} prop={prop} difficulty={difficulty} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {mainImages.length > 0 ? (
                  <StudioImageGallery images={mainImages} />
                ) : !hasCanvas && !hasContextStrip && (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <div className="rounded-full bg-muted p-4 mb-4">
                      <BookOpen className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Ready for action</p>
                    <p className="text-xs text-muted-foreground max-w-[200px]">
                      Scenarios, images, and media will appear here during your lesson
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {sceneLightbox && (
        <ImageLightbox
          url={sceneLightbox.url}
          label={sceneLightbox.label}
          open={true}
          onClose={() => setSceneLightbox(null)}
        />
      )}
    </div>
  );
}
