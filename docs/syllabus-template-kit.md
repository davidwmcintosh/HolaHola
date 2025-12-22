# Syllabus Template Kit - Engaging Labels & Copy Patterns

**Purpose:** Transform dry, academic syllabus content into inviting, student-friendly experiences. Drills remain conversational tools for Daniela - these templates just hint at interactivity without prescribing when/how activities happen.

**Last Updated:** December 22, 2025

---

## Automated Label Prefilling (NEW - Dec 22, 2025)

When teachers create new lessons in the Syllabus Builder, the system now **automatically prefills engaging labels** based on the lesson type selected:

| Lesson Type | Auto-Prefilled Label |
|-------------|---------------------|
| Conversation | `Let's Chat:` |
| Vocabulary | `New Words:` |
| Grammar | `Grammar Spotlight:` |
| Cultural | `Culture Corner:` |
| Drill | `Practice Time:` |

**How it works:**
1. Teacher opens "Create Lesson" dialog
2. Teacher selects lesson type (e.g., "Conversation")
3. System automatically prefills name field with `Let's Chat: ` 
4. Teacher just types the topic (e.g., "Ordering at a Restaurant")
5. Final name: `Let's Chat: Ordering at a Restaurant`

If the teacher changes the lesson type, the prefix automatically updates while preserving the topic.

---

## Bundle Creation (NEW - Dec 22, 2025)

Teachers can now create **practice bundles** - a conversation lesson paired with a linked drill - in one action:

**When creating a conversation lesson:**
1. Toggle "Create Practice Bundle" ON
2. Click "Create Bundle"
3. System creates TWO lessons:
   - `Let's Chat: [Topic]` (conversation)
   - `Practice Time: [Topic]` (linked drill)

The drill lesson is automatically linked to the conversation and set to 50% of the conversation's time estimate.

**API Support:**
```json
POST /api/teacher/classes/:classId/curriculum/units/:unitId/lessons
{
  "name": "Ordering at a Restaurant",
  "description": "Learn to order food and drinks",
  "lessonType": "conversation",
  "estimatedMinutes": 30,
  "createBundle": true
}
```

Returns:
```json
{
  "bundle": true,
  "bundleId": "bundle_1734889234_abc123xyz",
  "conversationLesson": {
    "id": "uuid-1",
    "name": "Let's Chat: Ordering at a Restaurant",
    "lessonType": "conversation",
    "linkedDrillLessonId": "uuid-2",
    "bundleId": "bundle_1734889234_abc123xyz"
  },
  "drillLesson": {
    "id": "uuid-2", 
    "name": "Practice Time: Ordering at a Restaurant",
    "lessonType": "drill",
    "bundleId": "bundle_1734889234_abc123xyz"
  },
  "lessonsCreated": 2
}
```

**Linkage:**
- `conversationLesson.linkedDrillLessonId` points to the drill lesson
- Both lessons share the same `bundleId` for grouping
- Drill time is automatically set to 50% of conversation time

---

## Core Philosophy

**WHAT (Syllabus) vs HOW (Neural Network)**
- Syllabus = Marketing/comfort tool for students - looks fun and inviting
- Neural Network = Where Daniela makes real-time teaching decisions

The syllabus should make students excited, not anxious. We hint at interactive moments without prescribing rigid steps.

---

## Lesson Type Label Transformations

| Old (Clinical) | New (Engaging) | When to Use |
|----------------|----------------|-------------|
| Vocabulary | New Words & Quick Checks | Vocabulary-focused lessons |
| Conversation | Let's Chat: [Topic] | Conversation practice lessons |
| Grammar | Grammar Spotlight: [Concept] | Grammar lessons |
| Drill | Practice Time: [Skill] | Drill-focused lessons |
| Cultural Exploration | Culture Corner: [Topic] | Cultural content |

---

## Description Copy Patterns

### Pattern 1: Action + Benefit + Hint
**Format:** "Learn to [action] so you can [real-world benefit]. You'll have opportunities to [interactive hint]."

**Examples:**
- ❌ "Clothing vocabulary" 
- ✅ "Learn clothing words so you can shop like a local. You'll have chances to describe outfits and ask about sizes!"

- ❌ "Food vocabulary"
- ✅ "Master food words to order confidently at any restaurant. Practice building your perfect meal order!"

### Pattern 2: Scenario + Skill
**Format:** "Imagine [scenario]. You'll learn to [skill] and practice [activity]."

**Examples:**
- ❌ "Shopping at a store"
- ✅ "Imagine shopping at a bustling market in Mexico City. You'll learn to ask prices, bargain politely, and describe what you're looking for!"

### Pattern 3: Challenge Moment
**Format:** Add "[Challenge: description]" for key interactive moments.

**Examples:**
- "Learn to describe your family with adjectives. Challenge: Can you describe three family members without peeking at notes?"

### Pattern 4: Build Your Own
**Format:** "Build your own [sentence/conversation/order]" hints at construction activities.

**Examples:**
- "Build your own restaurant order using food vocabulary!"
- "Build your own daily routine description using reflexive verbs!"

---

## Unit Description Templates

### Unit Intro Pattern
**Format:** "[Engaging theme sentence]. By the end, you'll be able to [concrete capability]. Cultural focus: [interesting cultural hook]."

**Example:**
- ❌ "Clothing items, colors, prices, and shopping vocabulary."
- ✅ "Ready to upgrade your wardrobe vocabulary? By the end of this unit, you'll confidently shop, describe outfits, and talk fashion like a native speaker. Cultural focus: Explore vibrant markets and boutiques across the Spanish-speaking world!"

---

## Spanish 1 Syllabus Updates

### Unit 1: ¡Hola! Greetings & Introductions

**Current Unit Description:**
> "Basic greetings, introductions, and classroom expressions. Cultural focus: Spanish-speaking countries overview."

**Updated Unit Description:**
> "Your Spanish journey starts here! Master the art of greeting, introducing yourself, and navigating classroom conversations with confidence. Cultural focus: Discover the 21 countries where Spanish is spoken!"

| Current Lesson | Updated Title | Updated Description |
|----------------|---------------|---------------------|
| Lesson 1: Saludos - Greetings & Farewells | Practice Time: Greetings & Farewells | Say hello and goodbye like a native! Practice greetings for different times of day and learn when to use formal vs. informal expressions. |
| Lesson 2: Presentaciones - Introducing Yourself | Let's Chat: Meeting New People | Introduce yourself with confidence! Learn to say your name, ask others' names, and make a great first impression. Challenge: Introduce yourself three different ways! |
| Lesson 3: Los Números - Numbers 0-20 | Practice Time: Numbers 0-20 | Count, share your age, and exchange phone numbers. You'll practice until numbers flow naturally! |
| Lesson 4: En la Clase - Classroom Expressions | Let's Chat: Classroom Survival | Never feel lost in class again! Learn essential expressions like "How do you say...?" and "Can you repeat that?" |

### Unit 2: Mi Familia - Family & Relationships

**Updated Unit Description:**
> "Introduce your loved ones! By the end, you'll describe family members, share ages and birthdays, and explore how Hispanic families stay connected. Cultural focus: The importance of family in Hispanic cultures."

| Current Lesson | Updated Title | Updated Description |
|----------------|---------------|---------------------|
| Lesson 1: La Familia - Family Members | New Words: Meet the Family | Learn to name all your family members. Challenge: Create a family tree and describe everyone in Spanish! |
| Lesson 2: Descripciones - Describing People | Let's Chat: Who's Who? | Describe family members using appearance and personality words. Can you paint a picture with words? |
| Lesson 3: Edad y Cumpleaños - Ages & Birthdays | Let's Chat: Birthday Celebrations | Talk about ages and birthdays. Learn the months and practice asking "When is your birthday?" |
| Lesson 4: La Familia Hispana | Culture Corner: Hispanic Family Life | Explore how families connect across generations in Hispanic cultures. What traditions might you adopt? |
| Gramática: Concordancia | Grammar Spotlight: Agreement | Master noun-adjective agreement. Why does "alto" become "alta"? Unlock this key to natural-sounding Spanish! |

### Unit 3: La Escuela - School Life

**Updated Unit Description:**
> "Navigate school life in Spanish! Discuss your favorite subjects, describe your schedule, and compare education systems. Cultural focus: What's school like in Latin America?"

| Current Lesson | Updated Title | Updated Description |
|----------------|---------------|---------------------|
| Lesson 1: Las Materias | New Words: School Subjects | What's your favorite class? Learn subject names and share your opinions! |
| Lesson 2: El Horario | Let's Chat: My Schedule | Describe your daily schedule. Practice telling time and talking about when things happen. |
| Lesson 3: Los Útiles Escolares | New Words: School Supplies | Pack your backpack! Learn the Spanish words for all your school essentials. |
| Lesson 4: La Educación | Let's Chat: School Around the World | Compare education systems. What's different about school in Spanish-speaking countries? |
| Gramática: Verbos -AR | Grammar Spotlight: -AR Verbs | Unlock the power of verbs! Learn to conjugate regular -AR verbs and describe daily actions. |

### Unit 4: Mis Pasatiempos - Hobbies & Free Time

**Updated Unit Description:**
> "What do you do for fun? Talk about sports, hobbies, and weekend plans. Cultural focus: Popular pastimes in the Spanish-speaking world!"

| Current Lesson | Updated Title | Updated Description |
|----------------|---------------|---------------------|
| Lesson 1: Los Pasatiempos | New Words: Hobbies | From gaming to painting, learn to talk about what you love doing! |
| Lesson 2: Los Deportes | Let's Chat: Sports Talk | Discuss your favorite sports. Challenge: Interview a classmate about their sports preferences! |
| Lesson 3: La Música y el Cine | Culture Corner: Music & Movies | Explore Spanish-language music and film. Discover artists and genres you'll love! |
| Lesson 4: El Fin de Semana | Let's Chat: Weekend Plans | What are you doing this weekend? Practice making and discussing plans. |

### Unit 5: La Comida - Food & Dining

**Updated Unit Description:**
> "Get hungry for Spanish! Master food vocabulary, order at restaurants like a pro, and explore delicious Hispanic cuisine. Cultural focus: Regional dishes you need to try!"

| Current Lesson | Updated Title | Updated Description |
|----------------|---------------|---------------------|
| Lesson 1: La Comida | New Words: Food Favorites | Learn delicious food vocabulary! Challenge: Describe your perfect breakfast, lunch, and dinner! |
| Lesson 2: Las Bebidas | New Words: Drinks | From café con leche to fresh juices, learn to order your favorite beverages. |
| Lesson 3: En el Restaurante | Let's Chat: Restaurant Ordering | Order a full meal confidently! Practice with menus and build your own order. |
| Lesson 4: Comida Hispana | Culture Corner: Hispanic Cuisine | Explore tacos, paella, empanadas, and more. What will you try first? |
| Gramática: Verbos Irregulares | Grammar Spotlight: Stem-Changers | Master tricky stem-changing verbs (querer, poder, pedir). The secret to sounding natural! |

### Unit 6: De Compras - Shopping & Clothing

**Updated Unit Description:**
> "Ready to shop? Learn to describe clothes, ask about sizes and prices, and navigate stores with confidence. Cultural focus: Markets, boutiques, and shopping culture!"

| Current Lesson | Updated Title | Updated Description |
|----------------|---------------|---------------------|
| Lesson 1: La Ropa | New Words: Clothing Essentials | Build your wardrobe vocabulary! Describe what you're wearing right now. |
| Lesson 2: Los Colores y Tallas | New Words: Colors & Sizes | Red or blue? Small or large? Learn to specify exactly what you want. |
| Lesson 3: En la Tienda | Let's Chat: At the Store | Shop like a pro! Ask prices, request sizes, and make purchases. Challenge: Haggle at a market! |
| Lesson 4: Las Compras | Let's Chat: Shopping Stories | Share shopping experiences and preferences. Where's your favorite place to shop? |

### Unit 7: La Ciudad - Places in the Community

**Updated Unit Description:**
> "Navigate your neighborhood and beyond! Learn city vocabulary, give directions, and explore urban life in Spanish-speaking countries. Cultural focus: City life from Madrid to Mexico City!"

| Current Lesson | Updated Title | Updated Description |
|----------------|---------------|---------------------|
| Lesson 1: Los Lugares | New Words: Places in Town | Bank, pharmacy, supermarket... Learn where everything is! |
| Lesson 2: Las Direcciones | Let's Chat: Giving Directions | Guide someone to their destination! Practice left, right, straight, and more. |
| Lesson 3: El Transporte | Let's Chat: Getting Around | Bus, metro, taxi... How do you get there? Discuss transportation options. |
| Lesson 4: Las Ciudades | Let's Chat: City Life | Describe your city and compare with Spanish-speaking cities. Where would you visit? |

### Unit 8: Las Vacaciones - Travel & Vacation

**Updated Unit Description:**
> "Adventure awaits! Plan trips, discuss weather, book hotels, and dream about destinations across the Spanish-speaking world. Cultural focus: Must-visit destinations!"

| Current Lesson | Updated Title | Updated Description |
|----------------|---------------|---------------------|
| Lesson 1: Las Vacaciones | New Words: Travel Essentials | Pack your bags! Learn the vocabulary for your next adventure. |
| Lesson 2: El Clima | Let's Chat: Weather Talk | Hot or cold? Sunny or rainy? Discuss weather for trip planning. |
| Lesson 3: En el Hotel | Let's Chat: Hotel Check-in | Book a room, ask about amenities, and handle common hotel situations. |
| Lesson 4: Destinos Hispanos | Culture Corner: Dream Destinations | Explore beaches, mountains, and cities across 21 countries. Where's your dream destination? |

---

## Requirement Tier Guidelines

| Tier | Description | Student Experience |
|------|-------------|-------------------|
| **Required** | Core content needed for progression | Must complete, cannot skip |
| **Recommended** | Reinforcement practice, highly encouraged | Can skip but shown as "recommended" |
| **Optional Premium** | Extra help for students who want more | Fee required, clearly marked |

### Recommended for Recommended Tier:
- Grammar review exercises after conversation lessons
- Extra vocabulary practice
- Cultural deep-dives

### Candidates for Optional Premium:
- Extended pronunciation practice with phoneme-level feedback
- One-on-one intensive conversation sessions
- Advanced grammar drilling

---

## Bundle Guidelines

**When to Bundle:**
- A conversation lesson naturally pairs with vocabulary practice
- A grammar concept needs drill reinforcement
- Cultural context enriches a conversation topic

**How to Bundle:**
- Set `bundleId` to group related lessons
- Use `linkedDrillLessonId` to connect conversation → drill
- Keep bundles cohesive (2-3 lessons max)

**Example Bundle: "Greetings & Introductions"**
- Practice Time: Greetings & Farewells (drill, required)
- Let's Chat: Meeting New People (conversation, required, linkedDrillLessonId → Greetings drill)

---

## Implementation Notes

1. **Don't prescribe HOW** - Syllabus shows engaging topics, Daniela decides when/how to deploy drills
2. **Keep flexibility** - Drills are tools Daniela uses, not rigid steps students must follow
3. **Test student perception** - Get feedback on whether updated copy feels inviting vs. overwhelming
4. **Maintain ACTFL alignment** - Engaging copy still maps to proficiency objectives
