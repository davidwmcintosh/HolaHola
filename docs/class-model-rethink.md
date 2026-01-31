# Class Model Rethink - Express Lane Discussion

## Background
The 27 public classes that linked curriculum_paths to the public catalogue were lost. Before recreating them, this is an opportunity to reconsider the learning model.

## Current Assets
- **45 curriculum_paths** (syllabi templates) - 5 levels x 9 languages
- **800+ lessons** with ACTFL-aligned content
- **4 class_types** defined (ACTFL-Led, Executive & Business, Travel & Culture, Quick Refresher)
- **Interactive Textbook** - Started for Spanish 1 only
- **Voice sessions with Daniela** - The core experience

## Questions for Discussion

### 1. Do we need structured "classes" at all?
- Original model: Students enroll in classes with syllabi, progress through units
- Alternative: Students just practice with Daniela, who adapts to their level
- What value do structured classes add vs. free-form conversation?

### 2. What role should the Interactive Textbook play?
- Currently only Spanish 1 exists
- Is this the primary learning resource, with voice as supplement?
- Or is voice primary and textbook is reference material?

### 3. Who are our target users?
- **Individual learners** wanting self-paced practice?
- **Schools/institutions** wanting structured curriculum?
- **Both** with different products?

### 4. Business model implications
- Classes = one-time purchase per class ($49?)
- Hour packages = ongoing voice time purchases
- Subscription = unlimited access?
- Which drives revenue and retention best?

## Options

### Option A: Interactive Textbook + Free Voice
- Complete textbook for all 9 languages
- Voice sessions are open-ended practice (no syllabus driving them)
- Daniela uses ACTFL internally but student just "learns naturally"
- Sell: Textbook access + voice hours

### Option B: Structured Classes (Recreate Original)
- Create 27 teacher_classes from curriculum_paths
- Students enroll, follow syllabi, track progress
- Sell: Class enrollment + voice hours included

### Option C: Syllabus-Free Adaptive Learning
- No textbook, no classes
- Pure voice-first learning with Daniela
- She tracks ACTFL progress invisibly
- Sell: Voice hour packages only

### Option D: Hybrid - Teacher vs Consumer Products
- **For schools**: Structured classes with syllabi (teacher_classes)
- **For individuals**: Interactive textbook + flexible voice practice
- Different pricing and features per audience

## Technical Considerations

### If keeping classes:
- Add `is_platform_owned` flag to distinguish HolaHola vs external classes
- Create teacher_classes linking to curriculum_paths
- Set featured/public flags

### If going textbook-first:
- Complete interactive textbook for remaining 8 languages
- Simplify class/enrollment system
- Voice sessions reference textbook content

## Decision Needed
Before investing time recreating classes, decide:
1. What's the core learning experience we're selling?
2. What role do structured syllabi play (if any)?
3. What's the MVP for launch?

---

*Created for Express Lane discussion - January 31, 2026*
