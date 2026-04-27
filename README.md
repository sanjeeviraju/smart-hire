# AI-Powered Recruitment Platform

A full-stack, AI-assisted hiring platform built for HR teams. It automates resume screening, candidate shortlisting, interview scheduling, and interview evaluation — reducing manual effort while providing explainable, data-driven hiring decisions.

---

## Table of Contents

- [Overview](#overview)
- [Project Screenshots](#project-screenshots)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [AI & ML Pipeline](#ai--ml-pipeline)
- [Repository Structure](#repository-structure)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## Overview

Traditional hiring workflows involve hours of manual resume review, inconsistent scoring, and slow feedback loops. This platform replaces that process with an end-to-end automated pipeline:

1. HR creates a job description.
2. Resumes are bulk-uploaded and parsed (PDF / DOCX, with OCR fallback for scanned documents).
3. Candidates are scored against the JD using semantic similarity and rule-based signals.
4. Shortlisted candidates receive a secure, time-limited interview link by email.
5. Candidates complete a browser-based, proctored interview — no app download required.
6. Responses are evaluated using Gemini (cloud) or a local fallback scorer.
7. HR reviews ranked results and interview recordings on a central dashboard.

---

## Project Screenshots

<p float="left">
  <img src="https://github.com/user-attachments/assets/421ac193-5b60-4c72-a9df-1d2a2c47f4ac" width="48%" style="margin-right:2%;" />
  <img src="https://github.com/user-attachments/assets/89e9fcce-8673-4185-a148-38b741cb57fc" width="48%" />
</p>

<p float="left">
  <img src="https://github.com/user-attachments/assets/f40d0a31-33a6-4739-a347-c657a9314bd9" width="48%" style="margin-right:2%;" />
  <img src="https://github.com/user-attachments/assets/9ef57c09-01fa-4e7a-83f4-a20ddca6fc68" width="48%" />
</p>

---

## Features

### HR Dashboard
- JWT-authenticated HR accounts (register / login)
- Dashboard with live hiring metrics and recent activity feed
- Job description creation, editing, and soft deletion

### Resume Processing
- Bulk PDF and DOCX upload
- Native text extraction with automatic OCR fallback for scanned PDFs
- Optional Ollama-based local LLM enhancement for structured field extraction
- Regex / heuristic validation for emails, phones, skills, experience

### Candidate Screening
- Semantic similarity scoring using Sentence Transformers
- spaCy NER for entity-level candidate signal extraction
- Configurable screening thresholds
- Automatic shortlisting on pass
- Score breakdowns per candidate
- Bulk actions: shortlist, delete, export to CSV

### Interview System
- Secure tokenised interview links delivered via SendGrid
- Link expiry enforced server-side
- Browser-based interview with:
  - Email verification before start
  - Fullscreen, camera, microphone, and screen-share enforcement
  - Timed question flow
  - Audio/video answer recording and upload to Supabase
- Real-time proctoring:
  - Face presence detection via YOLO
  - Suspicious-frame flagging with configurable warning limit
  - Automatic session termination on repeated violations

### Evaluation & Results
- Gemini-first evaluation (transcription + analysis) when API key is configured
- Local scoring fallback when Gemini is unavailable
- Per-question scoring with overall interview result
- HR interview review page with video playback and score breakdown

---

## Tech Stack

### Frontend
| Library | Purpose |
|---|---|
| React 18 | UI framework |
| TypeScript 5.7 | Type safety |
| Vite 5.4 | Build tool and dev server |
| React Router 6 | Client-side routing |
| Axios | HTTP client |
| Zustand | Global auth state |
| Tailwind CSS 3.4 | Styling |
| React Hook Form + Zod | Form handling and validation |

### Backend
| Library | Purpose |
|---|---|
| FastAPI 0.115 | REST API framework |
| SQLAlchemy 2.0 | ORM |
| Alembic 1.14 | Database migrations |
| PostgreSQL | Relational database |
| python-jose + passlib | JWT auth and password hashing |
| SendGrid | Interview invitation emails |
| Supabase Python client | File storage (resumes, interview media) |
| Celery 5.4 + Redis | Async task queue (wired, optional) |

### AI / ML / CV
| Library | Purpose |
|---|---|
| Sentence Transformers 3.4 | Semantic resume-to-JD scoring |
| spaCy 3.7+ (`en_core_web_trf`) | Named entity extraction |
| LightOn OCR (`LightOnOCR-2-1B`) | OCR fallback for scanned PDFs |
| Ultralytics YOLO 8.3 | Face detection for proctoring |
| OpenCV (headless) 4.10 | Frame analysis |
| Ollama | Optional local LLM for resume field extraction |
| Google Gemini API | Cloud transcription and interview evaluation |

---

## Architecture

### Frontend Routes
```
/                         HR landing and login
/register                 HR registration
/dashboard                Protected HR dashboard
/interview/:token         Candidate interview session
/interview/invalid        Expired or invalid link page
/interview/complete       Post-interview confirmation
```

### Backend Route Groups
```
/api/v1/auth              Authentication (register, login, me)
/api/v1/jd                Job description CRUD
/api/v1/jd/{jd_id}/candidates   Candidate upload, listing, screening, export
/api/v1/candidates        Candidate management, shortlisting, status
/api/v1/interview         Interview flow and proctoring
/api/v1/dashboard         Metrics, activity, results
```

### Core Backend Services
| Service | Responsibility |
|---|---|
| `resume_parser.py` | PDF/DOCX extraction, OCR, Ollama, regex validation |
| `resume_scorer.py` | Semantic scoring with Sentence Transformers |
| `screening_service.py` | JD-to-candidate matching and threshold logic |
| `interview_base.py` | Interview question generation from JD and candidate profile |
| `interview_evaluator.py` | Gemini-first evaluation with local fallback |
| `proctoring.py` | YOLO face detection and suspicious-frame analysis |
| `email_service.py` | SendGrid invite delivery |
| `storage.py` | Supabase upload helpers for resumes and videos |
| `activity_service.py` | Dashboard activity logging |

---

## AI & ML Pipeline

### Resume Ingestion
1. HR uploads PDF or DOCX files (bulk supported).
2. PDFs attempt native text extraction first.
3. If extracted text falls below the configured threshold, OCR (`LightOnOCR-2-1B`) is used.
4. Extracted text is processed through:
   - Optional Ollama structured extraction
   - Regex / heuristic field extraction (skills, experience, education, contact)
   - Source validation and cleanup
5. Candidate profile is saved to the database.

### Screening
1. HR triggers screening for a job description.
2. Each candidate's profile is compared to the JD using Sentence Transformer embeddings.
3. spaCy NER supplements rule-based signal extraction.
4. A composite score is calculated with per-dimension breakdowns.
5. Candidates meeting the threshold are automatically marked **Shortlisted**.

### Interview Flow
1. HR sends a secure, expiring interview link to shortlisted candidates via email.
2. Candidate verifies their registered email address.
3. Candidate grants camera, microphone, fullscreen, and screen-share access.
4. Timed questions are served one at a time; answers are recorded and uploaded to Supabase.
5. Proctoring runs on each submitted video frame — repeated violations terminate the session.
6. On completion, Gemini transcribes and evaluates responses (local scoring used as fallback).

---

## Repository Structure

```
.
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/          # auth, jd, candidates, interview, dashboard
│   │   ├── core/                # config, security
│   │   ├── db/                  # session, base
│   │   ├── models/              # SQLAlchemy ORM models
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   ├── services/            # AI/ML and business logic
│   │   ├── tasks/               # Celery task definitions
│   │   └── main.py
│   ├── alembic/                 # Migration scripts
│   ├── requirements.txt
│   ├── run_dev.py
│   ├── nixpacks.toml            # Cloud build config
│   └── railway.toml             # Railway deployment config
├── frontend/
│   ├── src/
│   │   ├── api/                 # Axios wrappers per domain
│   │   ├── components/          # Shared UI components
│   │   ├── context/             # React contexts (auth, theme)
│   │   ├── pages/               # Route-level page components
│   │   ├── store/               # Zustand stores
│   │   └── types/               # Shared TypeScript types
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
└── README.md
```

---

## Local Setup

### Prerequisites

| Requirement | Version |
|---|---|
| Python | 3.10+ |
| Node.js + npm | 18+ |
| PostgreSQL | Any recent version |
| Supabase project | With `resumes` and `interviews` storage buckets |
| SendGrid account | For interview invitation emails |

Optional:
- Redis — required only if running Celery workers
- Ollama — for local LLM resume extraction
- Gemini API key — for cloud transcription and evaluation
- CUDA GPU — for faster OCR and CV inference

---

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd <your-repo-folder>
```

### 2. Backend — virtual environment and dependencies

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

If PowerShell blocks script execution:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

### 3. Download the spaCy model

```powershell
python -m spacy download en_core_web_trf
```

> The OCR model and Sentence Transformer weights are downloaded automatically on first use.

### 4. Create the backend environment file

Create `backend/.env` — see [Environment Variables](#environment-variables) below.

### 5. Run database migrations

```powershell
alembic upgrade head
```

### 6. Start the backend

```powershell
python run_dev.py
```

Or directly:

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API base: `http://localhost:8000/api/v1`
- Health check: `http://localhost:8000/health`

### 7. Start the frontend

Open a new terminal:

```powershell
cd frontend
npm install
npm run dev
```

- Frontend: `http://localhost:5173`

> The backend CORS policy allows only the exact `FRONTEND_URL` value. Make sure the browser origin matches.

### Optional: Run a Celery worker

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
celery -A app.tasks.celery_app.celery_app worker --loglevel=info
```

Requires Redis at the configured `REDIS_URL`.

---

## Environment Variables

### `backend/.env`

**Required**

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL SQLAlchemy connection string |
| `SECRET_KEY` | JWT signing secret |
| `ALGORITHM` | JWT algorithm (`HS256`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | HR session token lifetime |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `SUPABASE_BUCKET_RESUMES` | Name of the resume storage bucket |
| `SUPABASE_BUCKET_INTERVIEWS` | Name of the interview media bucket |
| `FROM_EMAIL` | Sender address for interview invitations |
| `FRONTEND_URL` | Frontend origin (used in CORS and invite links) |
| `SENDGRID_API_KEY` | SendGrid API key for email delivery |

**Optional**

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Enables Gemini transcription and evaluation |
| `GEMINI_GENERATION_MODEL` | Gemini model for question generation |
| `GEMINI_ANALYSIS_MODEL` | Gemini model for interview evaluation |
| `GEMINI_TRANSCRIPTION_MODEL` | Gemini model for audio transcription |
| `REDIS_URL` | Redis URL for Celery |
| `INTERVIEW_TOKEN_EXPIRE_HOURS` | Interview link expiry duration |
| `PROCTOR_WARNING_LIMIT` | Warnings before automatic termination |
| `PROCTOR_YOLO_MODEL` | YOLO model path or name |
| `PROCTOR_FRAME_CONFIDENCE` | Proctoring detection confidence threshold |
| `OCR_DPI` | PDF render DPI for OCR processing |
| `OCR_MAX_NEW_TOKENS` | OCR generation token budget |
| `OCR_FALLBACK_THRESHOLD` | Minimum character count before OCR fallback |
| `OLLAMA_NUM_PARALLEL` | Ollama concurrency setting |
| `OLLAMA_MAX_LOADED_MODELS` | Ollama memory setting |
| `OLLAMA_GPU_OVERHEAD` | Ollama GPU memory overhead |

**Example `backend/.env`**

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/ai_hiring
SECRET_KEY=replace-this-with-a-long-random-secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

SUPABASE_URL=https:[Supabase URL]
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_BUCKET_RESUMES=resumes
SUPABASE_BUCKET_INTERVIEWS=interviews

SENDGRID_API_KEY=your-sendgrid-key
FROM_EMAIL=no-reply@example.com
FRONTEND_URL=http://localhost:5173

REDIS_URL=redis://localhost:6379/0
INTERVIEW_TOKEN_EXPIRE_HOURS=48

GEMINI_API_KEY=
GEMINI_GENERATION_MODEL=gemini-2.5-pro
GEMINI_ANALYSIS_MODEL=gemini-2.5-pro
GEMINI_TRANSCRIPTION_MODEL=gemini-2.0-flash

OCR_DPI=200
OCR_MAX_NEW_TOKENS=2048
OCR_FALLBACK_THRESHOLD=150
```

### `frontend/.env.local`

```env
VITE_API_URL=http://localhost:8000/api/v1
```

---

## API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Create HR account |
| POST | `/api/v1/auth/login` | Login, returns JWT |
| GET | `/api/v1/auth/me` | Current HR user |

### Job Descriptions
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/jd/` | List all JDs |
| POST | `/api/v1/jd/` | Create JD |
| GET | `/api/v1/jd/{jd_id}` | Get JD detail |
| PUT | `/api/v1/jd/{jd_id}` | Update JD |
| DELETE | `/api/v1/jd/{jd_id}` | Soft-delete JD |

### Candidates & Screening
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/jd/{jd_id}/candidates/upload` | Bulk resume upload |
| GET | `/api/v1/jd/{jd_id}/candidates` | List candidates for JD |
| POST | `/api/v1/jd/{jd_id}/screen` | Run screening for JD |
| GET | `/api/v1/candidates/{candidate_id}/scores/{jd_id}` | Score breakdown |
| POST | `/api/v1/candidates/shortlist` | Bulk shortlist |
| POST | `/api/v1/candidates/send-interviews` | Send interview invitations |
| PUT | `/api/v1/candidates/{candidate_id}/status` | Update candidate status |
| GET | `/api/v1/candidates/{candidate_id}` | Get candidate detail |
| DELETE | `/api/v1/candidates/bulk` | Bulk delete candidates |
| DELETE | `/api/v1/candidates/{candidate_id}` | Delete single candidate |
| GET | `/api/v1/jd/{jd_id}/candidates/export` | Export candidates to CSV |

### Dashboard
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/dashboard/stats` | Hiring metrics |
| GET | `/api/v1/dashboard/activity` | Recent activity feed |
| DELETE | `/api/v1/dashboard/activity/{activity_id}` | Remove activity entry |
| GET | `/api/v1/dashboard/jd/{jd_id}/results` | JD-level results summary |
| GET | `/api/v1/dashboard/candidate/{candidate_id}/interview` | Candidate interview results |

### Interview
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/interview/validate/{token}` | Validate invite token |
| POST | `/api/v1/interview/verify-email/{token}` | Verify candidate email |
| POST | `/api/v1/interview/start/{token}` | Start interview session |
| GET | `/api/v1/interview/question/{token}/{question_index}` | Fetch question |
| POST | `/api/v1/interview/answer/{token}` | Submit answer |
| POST | `/api/v1/interview/complete/{token}` | Complete interview |
| POST | `/api/v1/interview/proctor/frame/{token}` | Submit proctoring frame |
| POST | `/api/v1/interview/proctor/event/{token}` | Log proctoring event |

---

## Deployment

The backend is configured for Railway with Nixpacks:

- **Backend:** [Railway](https://railway.app) — `backend/railway.toml` and `backend/nixpacks.toml` handle the build.
- **Frontend:** [Vercel](https://vercel.com) — `frontend/vercel.json` configures SPA routing.

The Railway build:
1. Installs Python dependencies.
2. Downloads the spaCy model (`en_core_web_sm`).
3. Downloads Sentence Transformer weights (`all-MiniLM-L6-v2`).
4. Runs `alembic upgrade head`.
5. Starts FastAPI with Uvicorn.

> Ensure the build image has sufficient memory for the ML dependencies (~2–4 GB at minimum) and that all external services (PostgreSQL, Supabase, SendGrid, Gemini) are reachable from the deployment environment.

---

## Troubleshooting

### `ModuleNotFoundError: No module named 'sendgrid'`
The virtual environment is not active. Activate it and reinstall:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Frontend shows `Network Error`
Check:
- Backend is running on `http://localhost:8000`
- Frontend is running on `http://localhost:5173`
- `frontend/.env.local` has `VITE_API_URL=http://localhost:8000/api/v1`
- `backend/.env` has `FRONTEND_URL=http://localhost:5173`

### `python-dotenv could not parse statement`
`backend/.env` must contain plain `KEY=VALUE` lines only — no shell commands like `setx`.

### Resume parsing fails because of spaCy model
Install the expected model explicitly:

```powershell
python -m spacy download en_core_web_trf
```

### Server prints `KeyboardInterrupt` / `CancelledError` on shutdown
This is normal. Uvicorn logs the asyncio cleanup as `ERROR` when you stop the server with Ctrl+C. It is not a crash.
