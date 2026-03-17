# LINGOVERSE - Requirements Document (Simplified)

## Functional Requirements

### FR1: User Authentication
- FR1.1: Users can sign up with email and password
- FR1.2: Users can login with email and password
- FR1.3: Passwords must be at least 6 characters
- FR1.4: System maintains JWT token sessions

### FR2: Language Selection
- FR2.1: Users select one language (Japanese or Urdu) after signup
- FR2.2: Users can change language anytime

### FR3: Home Page
- FR3.1: Display all 10 levels in list format
- FR3.2: Show locked/unlocked status for each level
- FR3.3: Display user's total points

### FR4: Lesson Structure
- FR4.1: Each lesson has exactly 8 questions
- FR4.2: Questions 1-3: Audio-based (listen and select meaning)
- FR4.3: Questions 4-8: Multiple choice (4 options each)
- FR4.4: All questions use same 8 words from lesson

### FR6: Question Types
- FR6.1: Question type 1-3: Audio recognition (audio + options, select meaning)
- FR6.2: Question type 4: Word translation (English → Native script with options)
- FR6.3: Question type 5: Fill-in-the-blank (select word from the 8 words)
- FR6.4: Question type 6: Pronunciation matching (native audio, select written form)
- FR6.5: Question type 7: Context usage (sentence with blank, select correct word)
- FR6.6: Question type 8: Reverse audio (audio → English, no visual cue)

### FR7: Point System
- FR7.1: Each correct answer awards 10 points
- FR7.2: Incorrect answers award 0 points
- FR7.3: Lesson completion bonus: +20 if all 8 correct, +10 if ≥6 correct
- FR7.4: Streak bonus: +5 per consecutive day (calculated within session)
- FR7.5: Points must update on home dashboard in real-time after completion
### FR5: Question Types
- FR5.1: Audio recognition (audio + 4 options)
- FR5.2: Translation (English → Native script)
- FR5.3: Fill-in-the-blank (select word from 8 words)
- FR5.4: Pronunciation matching (audio ↔ written word)
- FR5.5: Context usage (word in sentence)
- FR5.6: Reverse audio (audio → English)

### FR6: Scoring
- FR6.1: Each correct answer = 10 points
- FR6.2: All correct (8/8) = +20 bonus
- FR6.3: Mostly correct (6-7/8) = +10 bonus

### FR7: Level Progression
- FR7.1: 10 levels per language (Level 1-10)
- FR7.2: Each level has 8 new words
- FR7.3: Unlock requirement: 60% accuracy (≥5/8 correct)
- FR7.4: Level 1 starts unlocked
- FR7.5: Next level unlocks immediately upon reaching 60%

### FR8: Data Persistence
- FR8.1: User data stored in PostgreSQL
- FR8.2: User progress saved after each lesson
- FR8.3: Points calculated and stored

---

## Non-Functional Requirements

### NFR1: Performance
- NFR1.1: Lesson page loads in <2 seconds
- NFR1.2: Home page loads in <1 second
- NFR1.3: Audio plays within 500ms

### NFR2: Security
- NFR2.1: Passwords hashed with bcrypt
- NFR2.2: JWT tokens expire after 1 hour
- NFR2.3: All data transmission via HTTPS
- NFR2.4: Input validation on all forms

### NFR3: Usability
- NFR3.1: Work on mobile and desktop browsers
- NFR3.2: Clear error messages
- NFR3.3: Simple navigation (max 3 clicks to any page)

### NFR4: Compatibility
- NFR4.1: Support Chrome, Firefox, Safari, Edge
- NFR4.2: Support iOS and Android (responsive design)

---

## Acceptance Criteria

1. User can sign up with email and password ✓
2. User can login and select language ✓
3. User can complete Level 1 lesson (8 questions) ✓
4. User receives points for correct answers ✓
5. User unlocks Level 2 after 60% accuracy ✓
6. Locked levels show as unavailable ✓
7. Lesson results display correctly ✓
8. User progress persists after logout/login ✓

---

**Document Version**: 1.0  
**Status**: Ready for Development
