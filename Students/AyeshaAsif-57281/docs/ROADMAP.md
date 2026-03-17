# LINGOVERSE - Development Roadmap (Simplified)

## Project Vision
Create a simple language learning web app where users learn vocabulary through audio-based lessons and unlock levels by reaching 60% accuracy.

---

## Phase 1: MVP (4-6 Weeks) - Core Functionality

### Week 1-2: Backend Setup & Authentication
**Goals**:
- Set up Flask + PostgreSQL
- Create user signup/login
- Generate JWT tokens

**Deliverables**:
- [ ] Flask project initialized
- [ ] PostgreSQL database created
- [ ] User model and database schema
- [ ] Signup API endpoint
- [ ] Login API endpoint
- [ ] Authentication middleware

### Week 2-3: Frontend & Language Selection
**Goals**:
- Create login/signup pages
- Language selection page
- Home page with level list

**Deliverables**:
- [ ] Signup page (HTML/CSS/JS)
- [ ] Login page (HTML/CSS/JS)
- [ ] Language selection page
- [ ] Home page showing 10 levels
- [ ] API integration (fetch requests)

### Week 4: Lesson Engine
**Goals**:
- Create lesson page with 8 questions
- Audio playback
- Answer submission

**Deliverables**:
- [ ] Lesson page template
- [ ] Audio player (HTML5)
- [ ] Question rendering (random order)
- [ ] Answer submission logic
- [ ] Results page
- [ ] Points calculation

### Week 5: Level Progression
**Goals**:
- Auto-unlock levels at 60% accuracy
- Prevent access to locked levels
- Update home page with progress

**Deliverables**:
- [ ] Lock/unlock logic (60% threshold)
- [ ] Level access control
- [ ] Real-time progress updates
- [ ] Lesson & User Progress database models

### Week 6: Testing & Polish
**Goals**:
- Test all features
- Fix bugs
- Optimize performance

**Deliverables**:
- [ ] Manual testing completed
- [ ] Bug fixes
- [ ] Code cleanup
- [ ] Documentation updated

---

## MVP Scope (What's Included)

✅ User signup/login  
✅ Language selection (Japanese or Urdu)  
✅ 10 levels with 8 words each  
✅ 8-question lessons (audio + multiple choice)  
✅ Points system (10 pts per question + bonus)  
✅ Level progression (60% to unlock)  
✅ Simple home page  
✅ Lesson results page  

---

## Phase 2: Enhancement (Future)

- Streak system
- Profile/dashboard page
- Settings page  
- Email notifications
- Data export
- Additional languages
- Week challenges
- Leaderboard

---

## Tech Stack

- **Backend**: Flask (Python)
- **Database**: PostgreSQL
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Auth**: JWT tokens
- **Server**: Python built-in or Gunicorn

---

## Success Criteria

- [ ] Users can sign up and login
- [ ] Users can select language and see home page
- [ ] Users can complete lessons and earn points
- [ ] Levels unlock automatically at 60% accuracy
- [ ] All user progress is saved in database
- [ ] App works on mobile and desktop browsers

---

**Timeline**: 4-6 weeks  
**Team**: 2-3 developers (backend, frontend, ± DevOps)  
**Status**: Planning complete, ready for development
