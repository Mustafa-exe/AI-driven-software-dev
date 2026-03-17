# LINGOVERSE - Specifications Document (Simplified)

**Project**: Simple Language Learning Web Application  
**Version**: 1.0  
**Date**: March 17, 2026  
**Status**: Planning

---

## 1. PROJECT OVERVIEW

LINGOVERSE is a simple language learning web application that teaches users core vocabulary through interactive audio-based lessons and quizzes. Users select a language, complete lessons sequentially, and unlock new levels by achieving 60% accuracy.

**Target Languages**: Japanese, Urdu  
**Technology Stack**: Python (Flask), PostgreSQL, REST APIs, Frontend (HTML5/CSS3/JavaScript)

---

## 2. CORE FEATURES

### 2.1 Authentication
- **Signup/Login** page with email and password
- **Persistent User Session** with JWT tokens

### 2.2 Home Page
Displays after language selection:
- **List of Levels** - Shows all 10 levels with unlock status (locked/available)
- **Current Level** - Highlighted level to learn

### 2.3 Lesson Structure (Core Learning)
Each lesson contains exactly **8 questions** in this sequence:

#### Questions 1-3: Audio Recognition Phase
- User **listens** to a native speaker pronouncing the word
- Word displayed in native script + romanization + English translation
- User **selects from 4 options** which English meaning matches the audio
- Can replay audio unlimited times

#### Questions 4-8: Mixed Vocabulary Quiz
Each question is **multiple choice (4 options)** using vocabulary from the same lesson:
- Question 4: Translate English → Native Script
- Question 5: Multiple choice fill-in-the-blank (same 8 words)
- Question 6: Pronunciation matching (which audio matches this written word)
- Question 7: Context clue (select correct word for sentence)
- Question 8: Audio→English translation (without visual)

### 2.4 Point System
- **Per Question**: 10 points for correct answer, 0 for incorrect
- **Lesson Completion Bonus**: +20 if all 8 correct, +10 if ≥6 correct

### 2.5 Level Progression
- **10 Levels**: Each level has 8 unique words
- **Unlock Requirement**: 60% accuracy (≥5 out of 8 questions)
- **Default Unlock**: Level 1 is available from start
- **Auto-Unlock**: Next level unlocks when 60% threshold is reached

---

## 3. TECHNICAL SPECIFICATIONS

### 3.1 Backend Services
- **Framework**: Flask
- **Database**: PostgreSQL
- **Authentication**: JWT tokens

### 3.2 Data Models
```
User
├── user_id (PK)
├── email (unique)
├── password_hash
└── current_language

Language
├── language_id (PK)
├── code (ja, ur)
└── name

Lesson
├── lesson_id (PK)
├── language_id (FK)
├── level (1-10)
└── vocabulary (array of 8 words)

UserProgress
├── progress_id (PK)
├── user_id (FK)
├── lesson_id (FK)
├── accuracy (0-100%)
├── points_earned
└── completed_at

Word
├── word_id (PK)
├── language_id (FK)
├── native_script
├── english_translation
└── audio_url
```

### 3.3 Deployment
- **Web Server**: Flask development server or Gunicorn
- **Database**: PostgreSQL (local or managed)
- **Audio Storage**: Local files or cloud storage (AWS S3, optional)

---

## 4. USER FLOWS

### 4.1 First-Time User Flow
1. User lands on app → **Signup page**
2. Enter email, password → **Signup complete**
3. **Login** with email and password
4. **Select language** (Japanese or Urdu)
5. **Redirected to Home page** - See all 10 levels

### 4.2 Learning Flow
1. User **logs in**
2. **Home page** shows available levels
3. User **clicks on next available level**
4. **Complete lesson** (8 questions)
5. **See results** - accuracy and points
6. If 60%+ → **Level unlocked**, return to home
7. If <60% → **Try again option** available

---

## 5. UI/UX SPECIFICATIONS

### 5.1 Design Principles
- **Minimalist**: Focus on lesson interaction
- **Mobile-Friendly**: Responsive design for mobile and desktop
- **Simple Navigation**: 3 main pages (Login, Home, Lesson)

### 5.2 Key Pages
1. **Signup/Login** - Simple form, centered layout
2. **Language Selection** - 2 buttons for Japanese/Urdu
3. **Home Page** - List/grid of 10 levels with unlock status
4. **Lesson Page** - Question display, audio player, progress bar
5. **Results Page** - Accuracy %, points, next level button

---

## 6. API ENDPOINTS (Backend)

```
Authentication:
  POST /api/auth/signup
  POST /api/auth/login

Lessons:
  GET /api/lessons (returns list of levels with unlock status)
  GET /api/lessons/{lesson_id}
  POST /api/lessons/{lesson_id}/submit (submit answers)

User:
  GET /api/user/profile
  POST /api/user/select-language
```

---

## 7. CONSTRAINTS & LIMITS

- **Lessons Per Language**: 10 levels, 8 words per level (80 words total per language)
- **Supported Languages**: Japanese, Urdu (can be extended)
- **Session Timeout**: 24 hours of inactivity

---

## 8. MVP SCOPE

**In Scope**:
- User authentication (signup/login)
- Language selection (Japanese or Urdu)
- 10 levels per language (80 words total)
- Lesson completion with point tracking
- Level unlock system (60% threshold)
- Simple home page showing available levels

**Out of Scope**:
- Streak tracking
- Dashboard with statistics
- Settings page
- Email notifications
- Diagnostic quiz
- Data export
- Social features

---

## 9. SUCCESS METRICS

- User can sign up and login
- User can select language and see home page
- User can complete Level 1 lesson and get points
- User can unlock Level 2 by achieving 60% accuracy
- Lesson results display correctly
- Database persists user progress

---

## 10. NOTES FOR DEVELOPERS

- All audio files stored locally or as URLs
- Questions randomized each attempt
- API responses include error messages
- JWT tokens expire after 1 hour

---

**Document Version**: 1.0 - Initial Specification  
**Last Updated**: March 17, 2026
