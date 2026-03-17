# Software Requirements Specification (SRS) - Mela

## 1. Introduction

Mela aims to solve the fragmented event discovery problem in Lahore by providing a smart aggregator for CS students and professionals.

## 2. Functional Requirements

- **FR1: AI Poster Processing:** The system shall allow users to upload images and use Gemini AI to extract Date, Venue, and Agenda.
- **FR2: Automated Scouting:** The system shall periodically scrape LinkedIn for events containing keywords like "Lahore" and "Tech."
- **FR3: User Dashboard:** Users shall be able to filter events by category and location.
- **FR4: Registration:** Users shall be able to sign up for events via a "One-Tap" Firebase-backed system.

## 3. Non-Functional Requirements

- **Performance:** AI extraction should complete in under 5 seconds.
- **Scalability:** The architecture must support expansion from CS to other departments (Arts, Business).
- **UI/UX:** Must follow a modern, expressive "Material 3" design vibe.
