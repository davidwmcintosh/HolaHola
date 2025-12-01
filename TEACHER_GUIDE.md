# LinguaFlow Teacher Guide

**Last Updated:** December 1, 2025  
**For:** Teachers and Educators using LinguaFlow

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Creating Your First Class](#creating-your-first-class)
3. [Adding Students to Your Class](#adding-students-to-your-class)
4. [Customizing Your Class Syllabus](#customizing-your-class-syllabus)
5. [ACTFL Standards Coverage](#actfl-standards-coverage)
6. [Creating Assignments](#creating-assignments)
7. [Grading Student Work](#grading-student-work)
8. [Browsing Syllabus Templates](#browsing-syllabus-templates)
9. [Viewing Student Progress](#viewing-student-progress)
10. [Organic Progress & Early Completion](#organic-progress--early-completion)
11. [Tips & Best Practices](#tips--best-practices)

---

## Getting Started

### Logging In

1. Go to your LinguaFlow instance URL
2. Click **"Log in with Replit"** or use your existing credentials
3. Once logged in, if you're a teacher, you'll see the **Teaching** section in the sidebar

### Navigating as a Teacher

The sidebar is organized into sections:
- **Learning**: Call Tutor (for your own practice)
- **Library**: Vocabulary, Grammar, Past Chats, Can-Do Progress
- **Resources**: Find a Class, Cultural Tips, Chat Ideas
- **Teaching**: My Classes, Class Creation Hub
- **Administration**: Command Center (for admins/developers)

**Note:** If you don't see the Teaching section, contact your administrator to grant teacher access.

---

## Creating Your First Class

### Using the Class Creation Hub

The Class Creation Hub (`/teacher/create-class`) offers two ways to create a class:

#### Option 1: Start from Template (Recommended)
Use our pre-built ACTFL-aligned syllabi to quickly set up a structured class.

1. **Navigate to Class Creation Hub**
   - Click "Class Creation Hub" in the Teaching section of the sidebar
   - Or go directly to `/teacher/create-class`

2. **Click "Start from Template"**
   - You'll see statistics showing available syllabi (e.g., "21 Syllabi, 116 Units, 524 Lessons, 9 Languages")
   - Browse the syllabus library below

3. **Browse Syllabus Templates**
   - Use the search bar to find specific topics
   - Filter by language using the dropdown
   - View by "All Templates" or "By Language" tabs

4. **Select a Template**
   - Click on a template to expand and see its units and lessons
   - Review the ACTFL level range (e.g., "Novice Low → Novice High")
   - Check the estimated hours

5. **Create Class from Template**
   - Click "Create Class from This" button
   - The form will pre-fill with the template name and settings

#### Option 2: Start from Scratch
Create a blank class and build your own syllabus.

1. **Click "Start from Scratch"**
   - This opens the class creation form with no pre-selected syllabus

3. **Fill Out the Class Form:**
   - **Class Name** (required, max 200 characters)
     - Example: "Spanish 1 - Period 3"
   - **Subject** (required, max 200 characters)
     - Example: "Spanish", "French", "Mandarin"
   - **Target Language** (required)
     - Choose from: Spanish, French, German, Italian, Portuguese, Mandarin, Japanese, Korean, Arabic
   - **Description** (optional, max 2000 characters)
     - Example: "Beginner Spanish for 9th graders, meets MWF 10:00-10:50"

4. **Submit the Form**
   - Click "Create Class"
   - You'll see a success message with your **6-character class code**

5. **Save Your Class Code**
   - **IMPORTANT:** Write down the 6-character code (e.g., "ABC123")
   - Students will need this code to join your class
   - You can find it later in the class details

---

## Adding Students to Your Class

### Method 1: Student Self-Enrollment (Recommended)

1. **Share the Class Code**
   - Give students your 6-character class code
   - Example: "ABC123"

2. **Students Join the Class:**
   - Students log in to LinguaFlow
   - Navigate to "Join Class" (usually in student menu)
   - Enter the 6-character code
   - Click "Join Class"

3. **Verify Enrollment:**
   - Go to your class page: `/teacher/classes/{classId}`
   - Check the student roster
   - You should see newly enrolled students appear

### Method 2: Manual Enrollment (Backend Only)

If students have trouble joining, contact your administrator to manually add them via the database.

---

## Customizing Your Class Syllabus

When you create a class from a template, LinguaFlow gives you a copy of the syllabus that you can fully customize for your students.

### Accessing the Syllabus Builder

1. **Navigate to your class page:**
   - Go to `/teacher/classes/{classId}`
   - Or click on your class from "My Classes" in the sidebar

2. **Click "Edit Syllabus"**
   - This opens the Syllabus Builder for your class

### What You Can Do in the Syllabus Builder

#### Reorder Units
- Drag and drop units to change the order your students will encounter topics
- Units are numbered automatically based on their position

#### Reorder Lessons Within Units
- Expand any unit to see its lessons
- Drag and drop lessons to change the teaching order
- Lesson numbers update automatically

#### Remove Lessons
- Click the **X** button next to any lesson to remove it
- Removed lessons can be restored by clicking "Show Removed" and then "Restore"
- This is useful for skipping content that doesn't fit your class needs

#### Add Custom Lessons
- Click **"+ Add Lesson"** within any unit
- Fill in the lesson details:
  - **Name** (required): The lesson title students will see
  - **Description** (optional): Learning objectives or overview
  - **Content** (optional): Detailed lesson content or instructions
- Custom lessons are marked with a "Custom" badge so you can identify them

#### Edit Existing Lessons
- Click the **pencil icon** next to any lesson to edit it
- Modify the name, description, or content as needed
- Perfect for adapting template content to your students' needs

### Saving Your Changes

All changes are saved automatically as you make them. You'll see a confirmation message after each action.

### Best Practices

✅ **DO:**
- Review the template content before making changes
- Remove lessons that don't fit your teaching timeline
- Add custom lessons for topics specific to your school or community
- Reorder units to match your textbook or district curriculum

❌ **DON'T:**
- Delete core vocabulary/grammar lessons without replacement
- Remove too many lessons (may affect ACTFL coverage)
- Forget to check ACTFL Standards Coverage after making changes

---

## ACTFL Standards Coverage

The Syllabus Builder includes a powerful **ACTFL Standards Coverage** panel that shows how well your class syllabus covers the ACTFL World-Readiness Standards.

### Accessing ACTFL Coverage

1. Open the Syllabus Builder for your class
2. Look at the top of the page for the **ACTFL Standards Coverage** panel
3. Click to expand and see detailed coverage information

### Understanding the Coverage Display

#### Overall Progress Bar
- Shows the percentage of Can-Do statements covered by your syllabus
- Example: "ACTFL Standards Coverage: 85%" means your syllabus addresses 85% of relevant Can-Do statements

#### Category Breakdown

Your coverage is broken down into three communication categories:

| Category | Icon | Description |
|----------|------|-------------|
| **Interpersonal** | 💬 | Face-to-face communication (conversations, discussions) |
| **Interpretive** | 📖 | Reading and listening comprehension |
| **Presentational** | 🎤 | Speaking and writing to an audience |

Each category shows its own coverage percentage, helping you identify gaps.

#### Level-by-Level Details

Expand any proficiency level to see specific Can-Do statements:

**Proficiency Levels:**
- Novice Low, Mid, High
- Intermediate Low, Mid, High  
- Advanced Low, Mid, High

For each level, you'll see:
- ✅ **Covered** (checkmark) - Lessons in your syllabus address this Can-Do statement
- ⚪ **Not Covered** (empty circle) - No lessons currently address this statement

### How Coverage Is Calculated

Coverage is based on lessons in your syllabus that are linked to ACTFL Can-Do statements:

1. **Template Lessons**: Pre-built lessons from LinguaFlow templates have Can-Do statements already mapped
2. **Cloned Lessons**: When you create a class from a template, these mappings are preserved
3. **Custom Lessons**: Lessons you create yourself don't automatically contribute to coverage (they may address standards not in our database)

### Using Coverage Data

**Identify Gaps:**
- If Interpretive coverage is low, consider adding reading/listening lessons
- If a specific proficiency level has few checkmarks, add content targeting that level

**Plan Your Year:**
- Use coverage data to ensure your syllabus addresses state standards requirements
- Helpful for curriculum review meetings with administrators

**Support Assessment:**
- Coverage data shows which Can-Do statements students will practice
- Use this to align your assessments with syllabus content

### Example Workflow

1. Create a class from "Spanish 1" template
2. Open Syllabus Builder
3. Review ACTFL Standards Coverage (probably 90%+)
4. Remove 3 lessons that don't fit your timeline
5. Check coverage again - it might drop to 75%
6. Add 2 custom lessons targeting uncovered statements
7. Final coverage: 82% - well-balanced for your class needs

### Tips for Maximizing Coverage

✅ **DO:**
- Check coverage after removing lessons
- Balance coverage across all three communication categories
- Focus on your students' target proficiency level
- Use coverage gaps to inspire custom lesson ideas

❌ **DON'T:**
- Obsess over 100% coverage (not always realistic or necessary)
- Ignore categories with low coverage
- Remove too many template lessons without considering impact

---

## Creating Assignments

### Assignment Types

LinguaFlow supports 4 assignment types:
- **Practice** - Informal practice activities
- **Homework** - Regular homework assignments
- **Quiz** - Assessments with scoring
- **Project** - Long-term projects

### Step-by-Step Assignment Creation

1. **Navigate to Assignment Creator**
   - From class page: Click "Create Assignment"
   - Or go directly to `/teacher/assignments/create`

2. **Fill Out the Assignment Form:**

   **Required Fields:**
   - **Class** - Select which class this assignment is for
   - **Title** (max 200 characters)
     - Example: "Conversation Practice: Ordering Food"
   - **Assignment Type** - Choose: practice, homework, quiz, or project
   - **Maximum Score** (0-1000 points)
     - Example: 100 for a standard assignment
   - **Due Date** - Select date and time
     - Uses your browser's local timezone

   **Optional Fields:**
   - **Description** (max 2000 characters)
     - Overview of what the assignment covers
   - **Instructions** (max 10000 characters)
     - Detailed step-by-step instructions for students
     - Example: "1. Start a new conversation with the AI\n2. Practice ordering at least 3 dishes\n3. Use vocabulary from Unit 4"

3. **Publish Settings:**
   - **Is Published** - Toggle ON to make visible to students
   - Keep OFF for drafts

4. **Submit:**
   - Click "Create Assignment"
   - Assignment appears in your class assignment list

### Finding Your Assignments

- View all assignments: `/teacher/assignments`
- View assignments for a specific class: Go to class page
- Edit assignments: Click on assignment title

---

## Grading Student Work

### Accessing Student Submissions

1. **Navigate to Assignment Grading:**
   - From class page: Click on an assignment
   - Or go to `/teacher/assignments/{assignmentId}/grade`

2. **View Submissions:**
   - See list of all students in the class
   - Submission status shown for each student:
     - ✅ Submitted
     - ⏳ Not Submitted
     - 📝 Graded

### Grading Process

1. **Select a Student:**
   - Click on student row to expand grading interface

2. **Review Submission:**
   - Read student's submission content
   - View any attached files/links (if applicable)
   - Check submission timestamp

3. **Assign Grade:**
   - **Score** - Enter points (0 to maximum score)
     - Example: If max is 100, enter 85
   - **Feedback** (optional, max 5000 characters)
     - Provide constructive feedback
     - Highlight strengths and areas for improvement
     - Example: "Great use of vocabulary! Try to use more past tense verbs."

4. **Submit Grade:**
   - Click "Submit Grade"
   - Student can now view their score and feedback

### Grade Management

- **Update Grades:** Click on a graded submission to edit
- **Bulk Grading:** Grade multiple students in one session
- **Late Submissions:** System tracks submission vs. due date

---

## Browsing Syllabus Templates

LinguaFlow provides pre-built syllabus templates across 9 languages that you can use when creating classes.

### Syllabus Hierarchy

```
Syllabus Template (e.g., "Spanish 1")
  └─ Unit 1 (e.g., "Greetings and Introductions")
      └─ Lesson 1 (e.g., "Saying Hello")
      └─ Lesson 2 (e.g., "Introducing Yourself")
  └─ Unit 2 (e.g., "Family and Friends")
      └─ Lesson 1 (e.g., "Family Members")
      └─ Lesson 2 (e.g., "Describing People")
```

### Browsing Available Templates

1. **Navigate to Class Creation Hub:**
   - Go to `/teacher/create-class`

2. **View Template Library:**
   - Scroll to the "Browse Syllabus Templates" section
   - Use the search bar to find specific topics
   - Filter by language using the dropdown

3. **View Template Details:**
   - Click on any template to expand it
   - See the full unit and lesson structure
   - Review ACTFL level progression
   - Check estimated hours

### Template Information

Each template shows:
- **Language** - Target language being taught
- **Duration** - Estimated hours to complete
- **ACTFL Range** - Starting and ending proficiency levels
- **Units** - Number of units in the syllabus
- **Lessons** - Detailed lesson content within each unit

### Using Templates

Templates are read-only and managed by administrators. To use a template:
1. Click "Create Class from This" on any template
2. The class creation form opens with the template pre-selected
3. Your class will be linked to that syllabus for progress tracking

### Template Lesson Details

Click on a unit to see its lessons. Each lesson includes:
- **Name** - Lesson title
- **Description** - Learning objectives
- **Content** - Full lesson material

---

## Viewing Student Progress

### Class-Level Progress

1. **Navigate to Class Page:**
   - Go to `/teacher/classes/{classId}`

2. **View Metrics:**
   - Total number of students
   - Assignment completion rates
   - Overall engagement statistics

### Individual Student Progress

1. **Click on Student Name:**
   - From class roster

2. **View Student Profile:**
   - Current ACTFL proficiency level
   - Total conversation time
   - Vocabulary learned
   - Assignment completion history
   - Can-Do statement achievements

### Assignment Analytics

1. **View Assignment Page:**
   - Click on assignment from class page

2. **See Statistics:**
   - Submission rate (X out of Y students)
   - Average score
   - Grade distribution
   - Students needing support

### Understanding ACTFL Proficiency Tracking

LinguaFlow automatically tracks student progress using ACTFL World-Readiness Standards.

**What Gets Tracked (FACT Criteria):**
- **Functions**: Communication tasks performed (greetings, questions, introductions)
- **Accuracy**: Pronunciation quality from voice practice sessions
- **Context**: Variety of topics discussed across conversations
- **Text Type**: Word count and speech complexity per message

**Proficiency Levels:**

| Level | Description |
|-------|-------------|
| Novice Low | Just starting, learning basic words |
| Novice Mid | Can say simple memorized phrases |
| Novice High | Beginning to create with language |
| Intermediate Low | Can handle simple transactions |
| Intermediate Mid | Can discuss familiar topics |
| Intermediate High | Can narrate and describe |

**Viewing ACTFL Progress:**
- Go to student's individual progress page
- See current ACTFL level and progress toward next level
- View voice practice minutes and pronunciation scores
- Monitor vocabulary growth over time

**Advancement Notifications:**
Students receive real-time feedback when they're ready to advance to the next proficiency level. The system requires:
- Minimum voice practice time (5+ hours for Novice Low)
- Sufficient messages at current level
- Adequate pronunciation accuracy (70%+ threshold for Novice Low, higher for advanced levels)
- Demonstrated communication tasks (greetings, introductions, questions)
- Coverage of multiple topics

---

## Organic Progress & Early Completion

### Overview

LinguaFlow's Syllabus-Aware Competency System automatically recognizes when students cover syllabus topics through natural AI conversations. This enables "early completion" - students can skip lessons they've already mastered organically.

### How It Works

1. **Automatic Detection**: As students practice with the AI tutor, the system tracks which topics, vocabulary, and grammar they cover
2. **Competency Scoring**: The system calculates a weighted competency score:
   - **Topics Covered**: 40% weight
   - **Vocabulary Mastery**: 35% weight  
   - **Grammar Demonstration**: 25% weight
3. **Early Completion Threshold**: When a student reaches 80%+ competency for a lesson, they're recommended for early completion
4. **Teacher Verification**: You review and approve early completions

### Accessing the Organic Progress Tab

1. Navigate to your class page: `/teacher/classes/{classId}`
2. Click the **"Organic Progress"** tab
3. You'll see students who are ahead of syllabus

### Understanding the Display

For each student with organic progress, you'll see:
- **Student Name**: The student who's ahead
- **Lesson**: Which syllabus lesson they've covered
- **Competency Score**: Their overall percentage (e.g., "92%")
- **Score Breakdown**:
  - Topics: How many syllabus topics they covered
  - Vocabulary: How many required words they've mastered
  - Grammar: Grammar concepts demonstrated
- **Evidence Conversations**: Links to the actual conversations showing mastery

### Verifying Early Completion

1. **Review the Evidence**:
   - Click "View Conversations" to see actual student conversations
   - Verify the student genuinely covered the material
   - Check vocabulary usage and grammar in context

2. **Approve or Deny**:
   - Click **"Verify"** to approve early completion
   - The student can now skip this lesson in their syllabus
   - Add optional feedback comments

3. **After Verification**:
   - The AI tutor automatically congratulates the student
   - Progress is marked as "tutor_verified" in the system
   - Student sees the lesson marked complete

### AI Tutor Congratulatory Messages

When students are ahead of syllabus, the AI tutor automatically:
- Acknowledges their progress during voice conversations
- Provides encouragement and positive reinforcement
- References specific topics they've mastered

Example: *"I noticed you've been making great progress with food and dining vocabulary! You're actually ahead of your class syllabus - great work!"*

### Best Practices for Organic Progress

✅ **DO:**
- Review evidence conversations before verifying
- Provide encouraging feedback when verifying
- Use organic progress data to identify motivated students
- Consider adjusting assignments for students who are ahead

❌ **DON'T:**
- Auto-approve without reviewing evidence
- Ignore students who are behind (they may need extra support)
- Override organic progress with unnecessary assignments

### FAQ

**Q: Can students "game" the system?**
A: The system requires genuine topic coverage across multiple conversations with grammar and vocabulary demonstration. Gaming is difficult.

**Q: What if I disagree with the competency score?**
A: You have final say - don't verify if you believe the student needs more practice.

**Q: How does this affect grades?**
A: Early completion is separate from assignment grades. You can still assign and grade work.

**Q: Can I turn off organic tracking for my class?**
A: Contact your administrator if you want to disable this feature.

---

## Tips & Best Practices

### Class Management

✅ **DO:**
- Keep class codes secure (don't post publicly)
- Archive old classes at end of semester
- Use descriptive class names (include period/time)
- Set clear due dates with appropriate time

❌ **DON'T:**
- Share class codes on social media
- Create duplicate classes unnecessarily
- Forget to publish assignments (students won't see them!)

### Assignment Design

✅ **DO:**
- Write clear, detailed instructions
- Set realistic maximum scores (typically 100 points)
- Provide rubrics in the instructions
- Use different assignment types appropriately

❌ **DON'T:**
- Leave description and instructions blank
- Set due dates in the past
- Create assignments without publishing them

### Grading

✅ **DO:**
- Provide constructive feedback
- Grade within 1 week of submission
- Use the full score range (0 to max)
- Acknowledge student effort

❌ **DON'T:**
- Leave feedback blank (students appreciate guidance!)
- Grade too late (students forget context)
- Use only high or only low scores

### Using Syllabus Templates

✅ **DO:**
- Browse available templates before creating a class
- Choose templates that match your students' ACTFL level
- Review template content before assigning to a class
- Use the Class Creation Hub for easy class setup

❌ **DON'T:**
- Skip reviewing template lessons (know what you're assigning!)
- Choose templates too advanced for your students
- Forget to track student progress against syllabus goals

---

## Common Issues & Solutions

### "Students can't see my class"

**Solution:** Make sure students are enrolled. Check class roster at `/teacher/classes/{classId}`

### "Assignment not showing for students"

**Solution:** Toggle "Is Published" to ON in the assignment settings

### "Can't edit an assignment"

**Solution:** Navigate to the assignment page and click "Edit Assignment" (feature may require admin access)

### "Lost my class code"

**Solution:** Go to class page, code is displayed in class details. If not visible, contact administrator.

### "Student submitted late"

**Solution:** System tracks submission time vs. due date. You can still accept and grade late submissions - add feedback noting it was late.

---

## Getting Help

### Support Resources

- **Technical Documentation:** See `replit.md` for system details
- **Feature Guides:** Check `docs/institutional-standards-integration.md`
- **Administrator:** Contact your school/district LinguaFlow admin for:
  - Teacher access issues
  - Database problems
  - Feature requests

### Reporting Issues

When reporting a problem, include:
- Your teacher account email
- Class name/ID
- Assignment name/ID (if applicable)
- What you were trying to do
- What happened instead
- Browser console errors (F12 → Console tab)

---

## Appendix: Quick Reference

### Assignment Types

| Type | Use Case | Typical Max Score |
|------|----------|-------------------|
| **Practice** | Informal skill practice | 10-50 points |
| **Homework** | Regular assignments | 50-100 points |
| **Quiz** | Assessments | 50-100 points |
| **Project** | Long-term work | 100-200 points |

### Character Limits

| Field | Max Length |
|-------|------------|
| Names/Titles | 200 characters |
| Descriptions | 2000 characters |
| Instructions/Content | 10000 characters |
| Feedback | 5000 characters |

### ACTFL Proficiency Levels

1. Novice (Low, Mid, High)
2. Intermediate (Low, Mid, High)
3. Advanced (Low, Mid, High)
4. Superior
5. Distinguished

---

**Questions?** Contact your LinguaFlow administrator or refer to the technical documentation in `replit.md`.
