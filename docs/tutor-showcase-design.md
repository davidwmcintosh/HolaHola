# HolaHola Tutor Showcase - Design Specification

## Overview
A vibrant tutor gallery on the homepage showcasing all 18 AI tutors (9 languages × 2 genders), creating a warm, inviting entry point that embodies the HolaHola brand.

---

## Visual Design

### Card Style - "Speech Bubble Cards"
- **Shape**: Rounded cards (rounded-xl) with soft shadows
- **Size**: 
  - Mobile: 120px × 150px (portrait orientation)
  - Desktop: 140px × 170px
- **Avatar**: Circular crop of tutor's "listening" state (warmest expression)
- **Content**: Tutor name + short personality tagline below avatar
- **Accent**: Subtle gradient border matching language color

### Color Palette (Language Accents)
| Language | Primary Accent | Hex |
|----------|---------------|-----|
| Spanish | Warm Orange | #F59E0B |
| French | Royal Blue | #3B82F6 |
| German | Deep Gold | #CA8A04 |
| Italian | Forest Green | #22C55E |
| Portuguese | Ocean Teal | #14B8A6 |
| Chinese | Imperial Red | #EF4444 |
| Japanese | Cherry Blossom | #EC4899 |
| Korean | Sky Blue | #0EA5E9 |
| English | Purple | #8B5CF6 |

### Typography
- Tutor Name: text-sm font-semibold (14px)
- Tagline: text-xs text-muted-foreground (12px)
- All text ≥12px for readability

---

## Layout Specifications

### Mobile (<768px)
- **Placement**: Below WelcomeHero, above Brain visualization
- **Style**: Horizontal snap-scroll carousel
- **Cards visible**: 2.5 cards at once (peek next)
- **Spacing**: gap-3 (12px between cards)
- **Padding**: px-4 (16px edge padding)
- **Scroll behavior**: snap-x snap-mandatory
- **No horizontal page overflow**

### Desktop (≥768px)
- **Placement**: Floating around the brain visualization OR below hero in 2-row grid
- **Style Option A**: 9 cards in arc above brain (like satellites)
- **Style Option B**: 3×6 or 2×9 grid below hero
- **Cards visible**: All 18 (or 9 with gender toggle)
- **Spacing**: gap-4 (16px)

---

## Tutor Personality Taglines
| Tutor | Language | Gender | Tagline |
|-------|----------|--------|---------|
| Daniela | Spanish | Female | "Warm & encouraging" |
| Agustin | Spanish | Male | "Patient & supportive" |
| Juliette | French | Female | "Elegant & precise" |
| Vincent | French | Male | "Charming & witty" |
| Greta | German | Female | "Clear & thorough" |
| Lukas | German | Male | "Structured & friendly" |
| Liv | Italian | Female | "Expressive & passionate" |
| Luca | Italian | Male | "Animated & fun" |
| Isabel | Portuguese | Female | "Melodic & warm" |
| Camilo | Portuguese | Male | "Relaxed & natural" |
| Hua | Chinese | Female | "Gentle & patient" |
| Tao | Chinese | Male | "Calm & wise" |
| Sayuri | Japanese | Female | "Polite & encouraging" |
| Daisuke | Japanese | Male | "Thoughtful & precise" |
| Jihyun | Korean | Female | "Energetic & modern" |
| Minho | Korean | Male | "Cool & supportive" |
| Cindy | English | Female | "Friendly & clear" |
| Blake | English | Male | "Casual & helpful" |

---

## Interaction Behavior

### Card Selection
1. Tap/click a tutor card
2. Card elevates with glow effect (language accent color)
3. Brain visualization highlights that language's segment
4. CTA updates: "Practice with [TutorName]" → "Practice with Daniela"
5. Selection persists until user picks another or starts practice

### Hover States (Desktop)
- Subtle scale up (transform: scale(1.05))
- Shadow deepens
- Tagline fades in if initially hidden

### Accessibility
- All cards keyboard navigable (Tab)
- aria-labels: "Practice Spanish with Daniela"
- Focus ring visible
- data-testid: `card-tutor-${language}-${gender}`

---

## Hero Integration

### HolaHola Branding
- Add subtle HolaHola logo/wordmark in hero overlay corner
- Use existing `holaholamainlogo*.png` assets
- Position: Top-right or integrated into gradient

### Section Title (above carousel)
- "Meet Your Tutors" or "Choose Your Guide"
- text-xl font-semibold, centered

---

## Acceptance Criteria

1. ✅ Tutor carousel renders 18 tutor cards with avatars and taglines
2. ✅ Mobile: Horizontal scroll with snap, no page overflow
3. ✅ Desktop: Grid or floating layout, all tutors visible
4. ✅ Card selection highlights language in brain visualization
5. ✅ CTA updates with selected tutor's name
6. ✅ Touch targets ≥44px on mobile
7. ✅ Text ≥12px everywhere
8. ✅ Keyboard accessible with proper aria labels
9. ✅ data-testid coverage for all interactive elements
10. ✅ Performance: Avatar images lazy-loaded

---

## Files Modified

| File | Action |
|------|--------|
| `client/src/lib/tutor-avatars.ts` | Add taglines, accent colors |
| `client/src/components/TutorShowcase.tsx` | New component |
| `client/src/pages/dashboard.tsx` | Integrate showcase |
| `client/src/components/SyllabusMindMap.tsx` | Add selection highlight prop |
| `design_guidelines.md` | Add Tutor Showcase section |

---

## Review Checklist (Post-Build)
- [ ] All 18 tutors visible with correct avatars
- [ ] Carousel scrolls smoothly on mobile
- [ ] No horizontal page overflow
- [ ] Selection state works and updates CTA
- [ ] Brain visualization responds to selection
- [ ] HolaHola branding visible
- [ ] Accessibility: keyboard navigation works
- [ ] Touch targets adequate on mobile
- [ ] Text readable at all sizes
