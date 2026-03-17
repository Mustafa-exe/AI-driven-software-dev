# LINGOVERSE - Skills & Technology Stack (Simplified)

## Required Technical Skills

### Backend Development (Python)
- **Framework**: Flask
  - URL routing
  - Request handling
  - Error handling
- **Database**: PostgreSQL
  - Schema design
  - Basic queries
- **Authentication**: JWT tokens
  - Token generation
  - Password hashing (bcrypt)

### Frontend Development
- **HTML5**: Form creation, semantic markup
- **CSS3**: Responsive design (mobile + desktop)
- **JavaScript**: 
  - DOM manipulation
  - Fetch API for API calls
  - Audio element playback
  - LocalStorage for data caching

### API Development
- **REST API Design**: Request/response handling
- **Error Handling**: Return appropriate status codes and messages
- **Data Format**: JSON serialization

---

## Technology Stack

| Component | Choice |
|-----------|--------|
| Backend | Flask (Python) |
| Database | PostgreSQL |
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Authentication | JWT tokens |
| Password Hashing | bcrypt |
| Web Server | Python built-in or Gunicorn |
| Audio Playback | HTML5 Audio Element |

---

## Repository Structure

```
lingoverse/
├── backend/
│   ├── app.py (main Flask app)
│   ├── models.py (database models)
│   ├── routes.py (API endpoints)
│   ├── auth.py (authentication logic)
│   ├── requirements.txt
│   ├── .env (environment variables)
│   └── database/
│       └── schema.sql (PostgreSQL schema)
├── frontend/
│   ├── index.html
│   ├── signup.html
│   ├── login.html
│   ├── home.html
│   ├── lesson.html
│   ├── results.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── auth.js
│       ├── lesson.js
│       ├── api.js
│       └── utils.js
└── docs/
    ├── API_DOCUMENTATION.md
    └── SETUP.md
```

---

## Setup Instructions

### Backend Setup
1. Create virtual environment: `python -m venv venv`
2. Activate: `source venv/bin/activate` (Mac/Linux) or `venv\Scripts\activate` (Windows)
3. Install dependencies: `pip install -r backend/requirements.txt`
4. Set up PostgreSQL database
5. Run migrations: `python manage.py db upgrade` (or equivalent)
6. Start server: `python backend/app.py`

### Frontend Setup
1. Open `frontend/index.html` in browser
2. Or serve with: `python -m http.server 8000`

---

## Key Dependencies

**Backend (Python)**:
- flask==2.3.0
- flask-sqlalchemy==3.0.0
- PyJWT==2.6.0
- bcrypt==4.0.0
- python-dotenv==0.21.0

**Frontend**:
- No external dependencies (vanilla JavaScript)
- Browser compatibility: Chrome, Firefox, Safari, Edge

---

## API Endpoints Summary

```
POST   /api/auth/signup
POST   /api/auth/login
GET    /api/lessons
GET    /api/lessons/{id}
POST   /api/lessons/{id}/submit
GET    /api/user/profile
```

---

## Security Checklist

- [ ] Passwords hashed with bcrypt
- [ ] JWT tokens expire after 1 hour
- [ ] HTTPS on production
- [ ] Input validation on all endpoints
- [ ] Environment variables for secrets (.env file)

---

## Development Workflow

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes
3. Test locally
4. Commit: `git commit -m "Add feature description"`
5. Push: `git push origin feature/my-feature`
6. Create pull request

---

## Testing

### Backend
```bash
python -m pytest tests/
```

### Frontend
- Test in browser developer console
- Test on mobile devices and tablets

---

**Document Version**: 1.0  
**Status**: Ready for Development
