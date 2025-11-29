# LinguaFlow Teacher Guide

**Last Updated:** November 28, 2025  
**For:** Teachers and Educators using LinguaFlow

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Creating Your First Class](#creating-your-first-class)
3. [Adding Students to Your Class](#adding-students-to-your-class)
4. [Creating Assignments](#creating-assignments)
5. [Grading Student Work](#grading-student-work)
6. [Using the Curriculum Builder](#using-the-curriculum-builder)
7. [Viewing Student Progress](#viewing-student-progress)
8. [Organic Progress & Early Completion](#organic-progress--early-completion)
9. [Tips & Best Practices](#tips--best-practices)

---

## Getting Started

### Logging In

1. Go to your LinguaFlow instance URL
2. Click **"Log in with Replit"** or use your existing credentials
3. Once logged in, if you're a teacher, you'll see the **Teacher Dashboard** option

### Accessing the Teacher Dashboard

- Click on your profile or navigate to `/teacher/dashboard`
- You'll see an overview of all your classes

**Note:** If you don't see teacher features, contact your administrator to grant teacher access.

---

## Creating Your First Class

### Step-by-Step Process

1. **Navigate to Teacher Dashboard**
   - Go to `/teacher/dashboard` or click "Teacher Dashboard" in the navigation

2. **Click "Create New Class"**
   - Look for the create class button (usually prominent on the dashboard)

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

## Using the Curriculum Builder

The Curriculum Builder allows you to create structured learning paths with units and lessons.

### Curriculum Hierarchy

```
Curriculum Path (e.g., "Spanish 1")
  └─ Unit 1 (e.g., "Greetings and Introductions")
      └─ Lesson 1 (e.g., "Saying Hello")
      └─ Lesson 2 (e.g., "Introducing Yourself")
  └─ Unit 2 (e.g., "Family and Friends")
      └─ Lesson 1 (e.g., "Family Members")
      └─ Lesson 2 (e.g., "Describing People")
```

### Creating a Curriculum Path

1. **Navigate to Curriculum Builder:**
   - Go to `/teacher/curriculum`

2. **Create New Path:**
   - Click "Create Curriculum Path"

3. **Fill Out Path Form:**
   - **Name** (required, max 200 characters)
     - Example: "Spanish 1 - High School"
   - **Description** (required, max 2000 characters)
     - Example: "Complete beginner Spanish aligned to ACTFL Novice Low-Mid standards"
   - **Language** (required)
     - Select target language
   - **Target Level** (required)
     - Choose: beginner, intermediate, or advanced
   - **Is Published** - Toggle ON to make visible

4. **Click "Create Path"**

### Adding Units to a Path

1. **Open Your Path:**
   - Click on the path in the curriculum list

2. **Create Unit:**
   - Click "Add Unit"

3. **Fill Out Unit Form:**
   - **Name** (max 200 characters)
     - Example: "Unit 1: Greetings"
   - **Description** (max 2000 characters)
     - Overview of unit objectives

4. **Order Index:**
   - Automatically assigned (units appear in creation order)
   - Can be reordered later

### Adding Lessons to a Unit

1. **Open Your Unit:**
   - Click on unit to expand

2. **Create Lesson:**
   - Click "Add Lesson"

3. **Fill Out Lesson Form:**
   - **Name** (max 200 characters)
     - Example: "Lesson 1: Formal vs. Informal Greetings"
   - **Description** (max 2000 characters)
     - Lesson objectives and overview
   - **Content** (max 10000 characters)
     - Full lesson content, activities, vocabulary lists
     - Can include formatted text

4. **Order Index:**
   - Automatically assigned (lessons appear in creation order)

### Publishing Curriculum

- **Draft Mode:** Keep "Is Published" OFF while building
- **Published Mode:** Toggle ON when ready for students
- **Updates:** Edit published curriculum anytime

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

LinguaFlow's Syllabus-Aware Competency System automatically recognizes when students cover curriculum topics through natural AI conversations. This enables "early completion" - students can skip lessons they've already mastered organically.

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
- **Lesson**: Which curriculum lesson they've covered
- **Competency Score**: Their overall percentage (e.g., "92%")
- **Score Breakdown**:
  - Topics: How many curriculum topics they covered
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
   - The student can now skip this lesson in their curriculum
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

### Curriculum Building

✅ **DO:**
- Build curriculum incrementally
- Test lessons before publishing
- Align with ACTFL standards
- Organize by theme/difficulty

❌ **DON'T:**
- Publish incomplete curriculum
- Skip descriptions (they help students navigate)
- Create overly long lessons (break into smaller parts)

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
