AI Resume Screening System
Software Requirement Specification (SRS)
1. Project Title

AI Resume Screening System using Python

2. Project Overview

The AI Resume Screening System is a Python-based application that automatically analyzes resumes and ranks candidates according to their relevance to a given job description.

The system uses Natural Language Processing (NLP) and machine learning techniques to extract important information such as skills, experience, and keywords from resumes.

The goal is to reduce manual screening time and assist recruiters in identifying the most suitable candidates efficiently.

3. Objectives

The main objectives of the project are:

Automatically analyze resumes

Extract important information such as skills and experience

Compare resumes with a job description

Rank candidates based on similarity score

Display the most suitable candidates

4. Problem Statement

Recruiters often receive hundreds of resumes for a single job position.
Manually reviewing each resume is time-consuming and inefficient.

This system aims to automate the resume screening process using AI techniques to identify the best candidates quickly.

5. Scope of the Project

The system will:

Accept resumes in PDF or text format

Extract text data from resumes

Process and clean text data

Compare resume content with job requirements

Rank candidates based on matching score

The system is intended for educational and demonstration purposes.

6. Functional Requirements

The system must provide the following functionality:

FR1 – Resume Upload

The system should allow users to upload multiple resumes.

FR2 – Text Extraction

The system should extract text from uploaded resumes.

FR3 – Resume Preprocessing

The system should clean and preprocess text by removing stopwords and unnecessary characters.

FR4 – Skill Extraction

The system should identify important skills from resumes.

FR5 – Job Description Input

The user should be able to provide a job description.

FR6 – Similarity Analysis

The system should compare resumes with the job description.

FR7 – Candidate Ranking

The system should rank candidates based on similarity scores.

FR8 – Result Display

The system should display ranked candidates with matching scores.

7. Non-Functional Requirements
Performance

The system should process resumes efficiently.

Usability

The system should have a simple command-line or basic interface.

Reliability

The system should handle invalid files or missing data without crashing.

Scalability

The system should be able to process multiple resumes.

8. Technologies Used

Programming Language

Python

Libraries

pandas

numpy

scikit-learn

nltk

pdfminer / PyPDF2

Development Environment

VS Code

Version Control

Git

Repository Platform

GitHub

9. System Architecture

The system workflow will be:

Resume Upload
      ↓
Text Extraction
      ↓
Text Preprocessing
      ↓
Feature Extraction (TF-IDF)
      ↓
Similarity Calculation
      ↓
Candidate Ranking
      ↓
Results Display
10. Dataset

The system may use:

sample resumes dataset

manually created resumes

job description text

11. Expected Output

The system will produce:

ranked list of candidates

similarity score for each resume

best matching candidate

Example output:

Candidate Ranking

1. Ahmed Khan – Score: 0.89
2. Ali Raza – Score: 0.76
3. Sara Malik – Score: 0.65