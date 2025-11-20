# Interactive Language Tutor - Design Guidelines

## Design Approach
**Design System**: Material Design with educational adaptations, **Mobile-First** responsive design
**Rationale**: Learning applications benefit from Material's clear hierarchy, familiar interaction patterns, and card-based components. The system's emphasis on clarity and structure supports focused learning.

**Key Design Principles**:
- **Mobile-First**: Interface optimized for mobile devices, progressively enhanced for desktop
- **Interface Disappears When Talking**: Minimalist full-screen conversation view with single large button
- **Voice-First Experience**: Large, prominent microphone button (80px on mobile vs 64px on desktop)
- **Speed & Natural Feel**: Prioritizing realistic conversation flow above all else
- Clarity over decoration: Every element serves the learning experience
- Progressive disclosure: Advanced features don't overwhelm beginners
- Consistent feedback: Users always know the system's state
- Distraction-free learning zones: Chat and exercise areas are clean and focused

## Typography
**Font Family**: 
- Primary: Inter (via Google Fonts) - exceptional readability for UI and learning content
- Monospace: JetBrains Mono - for code examples or phonetic transcriptions

**Type Scale**:
- Hero/Landing headings: text-5xl font-bold
- Section headers: text-3xl font-semibold
- Card titles: text-xl font-semibold
- Body text: text-base (16px base size for comfortable reading)
- Chat messages: text-base leading-relaxed
- Metadata/timestamps: text-sm text-gray-600
- Button text: text-sm font-medium

## Layout System
**Spacing Primitives**: Tailwind units of 2, 4, 6, and 8
- Component padding: p-6
- Card spacing: space-y-4
- Section gaps: gap-8
- Container margins: mx-auto with max-w-7xl

**Grid Structure**:
- Main app: 2-column layout (sidebar + main content) on desktop
- Sidebar: w-64 fixed, contains navigation and language selection
- Main content area: flex-1 with max-w-4xl for optimal reading
- Mobile: Single column, collapsible sidebar

## Component Library

### Navigation & Structure
**Top Bar**:
- Height: h-16
- Contains: Logo, current language indicator, difficulty badge, user profile
- Sticky positioning for persistent access

**Sidebar**:
- Sections: Dashboard, Practice Chat, Vocabulary, Grammar, History
- Active state: Subtle background with left border accent
- Icons: Heroicons (outline style)

### Learning Modules

**Chat Interface** (Primary Feature):
- Full-height container with messages area + input
- Message bubbles: max-w-2xl, rounded-2xl, p-4
- User messages: aligned right
- AI tutor messages: aligned left, include avatar (circular, w-10 h-10)
- Input area: Fixed bottom, p-4, with send button
- Typing indicators: Animated dots

**Flashcard System**:
- Card size: min-h-64, aspect ratio 3:2
- Flip animation: 3D transform on click
- Front: Large text (text-2xl) centered
- Back: Translation + example sentence + pronunciation
- Navigation: Arrow buttons + progress dots below

**Grammar Exercises**:
- Question card: p-6, rounded-lg, shadow-sm
- Multiple choice: Radio buttons with full-width labels
- Fill-in-blank: Inline input fields with underline style
- Immediate feedback: Green checkmark or red X with explanation
- Progress bar: Top of exercise module showing completion

**Difficulty Selector**:
- Segmented control style (3 buttons: Beginner | Intermediate | Advanced)
- Active state: Filled background
- Placement: Prominent in header or modal on first use

### Dashboard Components

**Stats Cards**:
- Grid: 3 columns on desktop (grid-cols-1 md:grid-cols-3)
- Each card: p-6, rounded-lg, shadow-sm
- Content: Large number (text-4xl font-bold), label below (text-sm)
- Examples: "Words Learned", "Practice Minutes", "Streak Days"

**Conversation History**:
- List of past sessions as cards
- Each entry: Date, duration, difficulty level, topic snippet
- Clickable to review full conversation
- Spacing: space-y-3

**Language Selection**:
- Dropdown or grid of language flags
- Currently selected: Badge indicator in header
- Quick switch: Should be 2 clicks maximum

### Forms & Inputs

**Text Input Fields**:
- Height: h-12
- Padding: px-4
- Border: rounded-lg with focus ring
- Labels: Above input, text-sm font-medium

**Buttons**:
- Primary CTA: px-6 py-3, rounded-lg, font-medium
- Secondary: Same size, outlined variant
- Icon buttons: Square (w-10 h-10), centered icon

## Animations
**Minimal & Purposeful**:
- Flashcard flip: 0.3s ease transform
- Message appearance: Slide up with fade (0.2s)
- Button states: No hover animations (system handles)
- Loading states: Simple spinner or skeleton screens

## Images
**Hero Section** (Landing/Dashboard):
- Placement: Top of landing page or dashboard welcome area
- Style: Abstract illustration of language learning (people conversing, speech bubbles, globe)
- Size: Full width, h-96 on desktop, h-64 on mobile
- Treatment: Subtle overlay for text contrast if needed

**Language Flags**:
- Small circular icons (w-8 h-8) next to language names
- Source: Use emoji or icon library, not custom images

**Empty States**:
- Simple illustrations for "No conversations yet" or "Start practicing"
- Centered in empty content areas

## Responsive Behavior
**Mobile-First Breakpoints** (using Tailwind's `md:` at 768px):

- **Mobile** (< 768px): 
  - Sidebar completely hidden for distraction-free experience
  - Simplified headers (compact avatar, language name only)
  - Large microphone button (h-20 w-20 = 80px) for easy touch targets
  - VAD mode toggle always visible but compact (abbreviated labels: "Push" instead of "Push to Talk", "Auto" instead of "Auto Detect")
  - Smaller message bubbles (max-w-[85%]) with condensed padding (p-3)
  - Smaller avatars (h-8 w-8 in messages, h-10 w-10 in headers) and icons
  - User menu avatar (h-8 w-8 = 32px)
  - Reduced spacing throughout (p-3, gap-2, space-y-3, gap-1 for VAD toggle)
  
- **Desktop** (≥ 768px):
  - Sidebar visible for navigation and conversation history
  - Full headers with complete language name and subtitle
  - Standard microphone button (h-16 w-16 = 64px)
  - VAD mode toggle with full labels ("Push to Talk", "Auto Detect" with Smart badge)
  - Larger message bubbles (max-w-2xl) with standard padding (p-4)
  - Larger avatars (h-10 w-10 in messages, h-12 w-12 in headers) and icons
  - User menu avatar (h-10 w-10 = 40px)
  - Standard spacing (p-4, gap-3, space-y-4, gap-2 for VAD toggle)

## Accessibility
- Focus indicators on all interactive elements
- ARIA labels for icon-only buttons
- Semantic HTML for screen readers
- Keyboard navigation: Tab through interactive elements, Enter to activate
- Color contrast: WCAG AA minimum for all text

This design creates a professional, distraction-free learning environment where students can focus on language acquisition while enjoying clear navigation and immediate feedback.