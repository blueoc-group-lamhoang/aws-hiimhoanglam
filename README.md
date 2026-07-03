# 🚲 AWS MLOps Demo - Bike Sharing Analytics Platform

## Overview

This project demonstrates a production-inspired AWS architecture for deploying a full-stack application together with a lightweight MLOps workflow under a limited cloud budget (~USD 100).

Instead of building a complex AI system, this project focuses on a realistic enterprise workflow:

- Users upload datasets securely to Amazon S3.
- Backend processes and stores the data.
- Frontend visualizes analytics dashboards.
- A lightweight ML pipeline trains a prediction model.
- CI/CD automatically deploys application updates.

The objective is to demonstrate:

- AWS networking
- Secure cloud architecture
- CI/CD
- Containerization
- Data Engineering workflow
- Basic MLOps

---

# Dataset

Bike Sharing Dataset
https://www.kaggle.com/datasets/lakshmi25npathi/bike-sharing-dataset

The dataset contains historical bike rental information together with environmental and seasonal factors.

Example columns:

| Column | Description |
|---------|-------------|
| season | Spring, Summer, Fall, Winter |
| yr | Year |
| mnth | Month |
| holiday | Holiday indicator |
| weekday | Day of week |
| workingday | Working day indicator |
| weathersit | Weather condition |
| temp | Temperature |
| atemp | Feels-like temperature |
| hum | Humidity |
| windspeed | Wind speed |
| casual | Casual users |
| registered | Registered users |
| cnt | Total bike rentals |

The target variable for prediction is:
```
cnt
```
(number of rented bikes)

---

# High Level Architecture

```
                        Internet
                            │
                    ┌─────────────────┐
                    │ Frontend (React)│
                    │ EC2 Public      │
                    └─────────────────┘
                             │
                             │ HTTPS
                             ▼
                    ┌─────────────────┐
                    │ Backend API     │
                    │ EC2 Private     │
                    └─────────────────┘
                      │      │      │
                      │      │      │
          Presigned URL      │      │
                      │      │      │
                      ▼      ▼      ▼
                     S3     RDS   Secrets Manager
                      │
               Raw Dataset Storage
                      │
                      ▼
               ETL Processing
                      │
                      ▼
               Processed Dataset
                      │
                      ▼
              ML Training Pipeline
                      │
                      ▼
                 model.pkl (S3)
```

---

# 📁 Repository Structure

Here is the finalized directory layout of the application code:

```
/home/ubuntu/lam/devops/aws-hiimhoanglam/
├── .env                  # Configured environment variables (local run)
├── .env.example          # Template environment configuration
├── docker-compose.yml    # Empty compose file for manual container overrides
├── sample_data/
│   └── bike_sharing_sample.csv  # Sample CSV data for fast local verification
├── backend/
│   ├── Dockerfile        # Empty Dockerfile (AWS deployment structure)
│   ├── database.py       # SQLAlchemy dynamic engine (auto-selects SQLite/Postgres)
│   ├── etl.py            # CSV validator, anomaly filters, and DB bulk insertions
│   ├── main.py           # FastAPI application & REST endpoints (Port 8036)
│   ├── models.py         # SQLAlchemy schemas (UploadHistory, ProcessedDataset, ModelRegistry)
│   ├── requirements.txt  # Python backend dependencies
│   ├── schemas.py        # Pydantic schemas for request validation & documentation
│   ├── test_main.py      # Automated integration and unit test suite
│   └── train.py          # ML Regressor training, metric outputs, and serialization
└── frontend/
    ├── Dockerfile        # Empty Dockerfile (AWS deployment structure)
    ├── index.html        # Main html template with Outfit/Jakarta fonts
    ├── package.json      # React + Vite + Chart.js + Lucide dependencies
    ├── vite.config.js    # Developer server listening configuration (Port 8018)
    └── src/
        ├── App.css       # Premium styles (dark theme, glassmorphic card elements)
        ├── App.jsx       # Layout containing sidebar & page routes
        ├── main.jsx      # React launcher script
        └── pages/
            ├── Dashboard.jsx   # Analytics cards & recent uploads log
            ├── Upload.jsx      # CSV drag & drop upload using mock presigned S3 url
            ├── Analytics.jsx   # Chart.js visualizations (month, weather, season, temp)
            ├── Prediction.jsx  # Sliders/inputs to request predictions from ML model
            └── History.jsx     # Upload transaction history logs table
```

---

# ⚡ Key Architecture & Local Mode Fallback

To ensure the code is instantly testable and runnable locally (or in a CI/CD test pipeline) without configuring live AWS S3 credentials or RDS Postgres instances immediately, the backend supports `LOCAL_MODE=true` (configured in `.env`):
1. **SQLite Database Auto-creation:** The backend auto-detects `LOCAL_MODE` and binds to a local `local_db.sqlite` file, creating all tables automatically on start.
2. **S3 Presigned URL Simulator:** When the frontend requests a presigned S3 URL, the backend generates a signature pointing back to its own `/upload/mock-s3` endpoint and stores the uploaded file inside `./mock_s3_bucket/raw/`.
3. **On-Demand Model Training:** A background ML script (`train.py`) executes a Random Forest training pipeline, computes $R^2$, RMSE, and MAE metrics, writes model version binaries (`models/model_v1.0.x.pkl`), and records them in the database.
4. **Immediate Prediction API availability:** If no model exists at API startup, the app automatically trains a mock model so `/predict` calls do not crash.

---

# Frontend

The frontend is built using React.
Its responsibility is visualization only.
No AWS credentials are exposed.
Communication with AWS is always performed through the Backend.

## Pages

### 1. Dashboard
Display overall system information:
- Number of uploaded datasets
- Number of processed records
- Current deployed ML model version
- Prediction accuracy
- Recent uploads

### 2. Upload Dataset
Users upload CSV files:
- Choose CSV
- Frontend requests Presigned URL
- Backend generates URL (S3 or simulated mock S3)
- Frontend uploads directly to destination URL
- Backend receives upload completion notification
- Metadata saved into Database

### 3. Analytics
Display processed data with Chart.js:
- Bike rentals by month (grouped by season filters)
- Bike rentals by season
- Bike rentals by weather
- Temperature vs Rental Count
- Humidity vs Rental Count

### 4. Prediction
User enters parameter controls:
- Season
- Temperature
- Humidity
- Wind Speed
- Weather Condition
- Working Day

Backend returns:
```json
{
    "prediction": 354
}
```

### 5. Upload History
Displays historic uploads:
- Dataset name
- Upload time
- Processing status
- Number of records
- S3 key

---

# Backend

The Backend is implemented as a REST API using FastAPI.

## Main APIs

### Upload
```
POST /upload/presign?filename={name}
```
Generate S3 Presigned URL (or local mock upload url).

### Upload Callback
```
POST /upload/complete?upload_id={id}
```
Save metadata after upload completes.

### ETL
```
POST /etl/run?upload_id={id}
```
Execute preprocessing:
- Validate CSV
- Remove invalid rows
- Normalize values
- Feature engineering
- Store processed dataset to DB

### Analytics
```
GET /analytics/summary
GET /analytics/monthly
GET /analytics/weather
GET /analytics/season
GET /analytics/trend
```

### Prediction
```
POST /predict
```
Input JSON:
```json
{
    "season": 2,
    "temp": 0.62,
    "humidity": 0.45,
    "windspeed": 0.18,
    "workingday": 1,
    "weather": 1
}
```
Output JSON:
```json
{
    "prediction": 354
}
```

---

# Database (Amazon RDS PostgreSQL / SQLite Fallback)

Only processed metadata is stored.

## upload_history
`id`, `filename`, `uploaded_at`, `status`, `records`, `s3_key`

## processed_dataset
Stores cleaned dataset features: `season`, `temp`, `humidity`, `windspeed`, `workingday`, `weather`, `cnt`, `mnth`, `yr`, `holiday`, `weekday`, etc.

## model_registry
`id`, `version`, `accuracy`, `trained_at`, `model_path`

---

# Amazon S3 Layout
```
bike-sharing-data/
    raw/
        dataset1.csv
        dataset2.csv
    processed/
        cleaned_dataset.csv
    models/
        model_v1.pkl
        model_v2.pkl
    logs/
    artifacts/
```

---

# ETL Pipeline
```
CSV Upload -> raw/ -> Validation -> Cleaning -> Feature Engineering -> processed/ -> Load into Database
```
Typical preprocessing:
- Missing value checking
- Data type validation
- Duplicate removal
- Feature normalization
- Encode categorical variables

---

# Lightweight MLOps Pipeline

Because the project has a limited AWS budget, a lightweight MLOps workflow is implemented instead of using Amazon SageMaker.

Workflow:
```
Processed Dataset -> GitHub Actions / local script -> Train Model -> Evaluate -> Save model.pkl -> Upload model to S3 -> Backend reload model
```

Models:
- Random Forest Regressor
- XGBoost Regressor

Evaluation metrics:
- RMSE
- MAE
- R² Score

---

# AWS Infrastructure

## Networking
VPC contains:
- Public Subnet
- Private Subnet
- Database Subnet

## Public Subnet
Contains:
- Frontend EC2
Accessible from Internet (Port 8018 maps to Port 80 for public).

## Private Subnet
Contains:
- Backend EC2 (Port 8036)
No direct Internet access. Outbound traffic uses NAT Gateway. Backend accesses S3 through S3 Gateway VPC Endpoint.

## Database Subnet
Contains:
- Amazon RDS PostgreSQL (Port 5432)
Private only.

---

# Security Groups

## Frontend Security Group
Allow `80/tcp` (and `8018/tcp` if testing) from `0.0.0.0/0`.
Optional: `22/tcp` from Administrator IP.

## Backend Security Group
Allow `8036/tcp` only from Frontend Security Group.
SSH `22` only from Frontend Security Group.

## RDS Security Group
Allow `5432` only from Backend Security Group. No public access.

---

# Secure File Upload
```
Frontend -> Backend -> Generate Presigned URL -> Upload directly to S3 -> Backend receives metadata -> Save upload history
```
Advantages:
- Backend bandwidth reduced
- No AWS credentials exposed
- Large file upload supported

---

# IAM

## GitHub Actions
Uses OIDC Federation. No Access Key or Secret Key.
Permission: Push Docker images to Amazon ECR.

## Backend EC2
IAM Role permissions:
- Read S3
- Read Secrets Manager
No ECR push permission.

## Frontend EC2
Permission: Pull Docker image only.

---

# Secrets Management

Database credentials are stored in AWS Secrets Manager.
Features:
- Automatic password rotation
- Backend retrieves credentials dynamically
- No plaintext password stored in source code

---

# Containerization
- **Frontend**: Docker -> Amazon ECR -> Frontend EC2 (runs on Port 8018)
- **Backend**: Docker -> Amazon ECR -> Backend EC2 (runs on Port 8036)

---

# CI/CD

## Application Deployment
Developer -> GitHub Push -> GitHub Actions -> Build Docker Image -> Push Image to Amazon ECR -> EC2 Pull Latest Image -> Restart Containers

## ML Pipeline
Processed Dataset -> GitHub Actions -> Train Model -> Evaluate -> Upload model.pkl -> Amazon S3 -> Backend reload model

---

# Technologies

- **Frontend**: React, Axios, Chart.js, Vite
- **Backend**: FastAPI, SQLAlchemy, Pandas, Scikit-learn, Uvicorn
- **Database**: Amazon RDS PostgreSQL (SQLite local fallback)
- **Storage**: Amazon S3 (Local directory fallback)
- **Containers**: Docker

---

# 🧪 Integration & Unit Testing

An integration and unit test suite is provided to verify API endpoint capabilities. 

To execute the tests locally within the virtual environment:
```bash
source venv/bin/activate
python3 -m pytest backend/test_main.py
```

### Test Coverage Details:
- **Startup Auto-Training:** Verifies the API boots and compiles a fallback ML model if none exists.
- **S3 Presigned URLs:** Verifies authorization endpoints return correct S3 directories.
- **Simulated S3 Uploads:** Verifies uploading files through the local simulation layer.
- **ETL Transformation:** Verifies parsing uploaded CSV files, normalizing dimensions, and writing database rows.
- **Analytics aggregation:** Validates mathematical aggregation calculations for graphs.

---

# ⚙️ How to Run Locally

### 1. Launch the Backend
```bash
cd backend
source ../venv/bin/activate  # Activate python virtual environment
uvicorn main:app --host 127.0.0.1 --port 8036 --reload
```
The interactive Swagger API documentation will be available at `http://127.0.0.1:8036/docs`.

### 2. Launch the Frontend
```bash
cd frontend
npm install
npm run dev
```
The React frontend dashboard will open at `http://127.0.0.1:8018`.
- Go to the **Upload Dataset** page, select the sample CSV file located at `sample_data/bike_sharing_sample.csv`, and click **Start S3 Upload** -> **Execute ETL Pipeline**.
- Visit the **Analytics** page to view the computed charts, or enter custom weather details on the **Prediction** page to see the model output!

---

# Learning Objectives

This project demonstrates:
- AWS VPC networking
- Public and Private subnet architecture
- Secure S3 upload using Presigned URLs
- IAM Roles and GitHub OIDC authentication
- Docker container deployment
- Amazon ECR integration
- CI/CD automation
- Amazon RDS integration
- Secrets Manager with password rotation
- Data Engineering (ETL)
- Lightweight MLOps pipeline
- Analytics dashboard
- Machine Learning model deployment

---

# 📦 Containerization & Orchestration Walkthrough

Successfully containerized both the backend API and frontend React application, and orchestrated them using Docker Compose.

## Changes Made

### 1. Backend Containerization
- **Modified [Dockerfile (Backend)](./backend/Dockerfile)**:
  - Base Image: `python:3.12-slim` (minimal surface area).
  - Setup: Creates system user/group `appuser` (UID/GID 10001) and transitions ownership of `/app` to `appuser` to ensure database writes, models directory creations, and mock uploads can happen securely without root privileges.
  - Command: Runs the FastAPI app via Uvicorn on port `8036`.

### 2. Frontend Containerization
- **Created [nginx.conf (Frontend)](./frontend/nginx.conf)**:
  - Configuration: Configures a server listening on port `8018` serving the `/usr/share/nginx/html` build bundle. Uses `try_files` to redirect fallback paths to `index.html` for client-side routing.
- **Modified [Dockerfile (Frontend)](./frontend/Dockerfile)**:
  - Multi-stage build layout:
    - **Build Stage**: Uses `node:20-alpine`, runs `npm ci` for clean dependency locking, and executes `npm run build`.
    - **Production Stage**: Uses the official `nginxinc/nginx-unprivileged:alpine` image which executes Nginx strictly as the `nginx` non-root user (UID 101) out-of-the-box.
    - Exposes unprivileged port `8018`.

### 3. Service Orchestration
- **Modified [docker-compose.yml](./docker-compose.yml)**:
  - Orchestrates:
    - `db`: Runs standard `postgres:15-alpine` database with a health check.
    - `backend`: Injects `.env`, sets `DB_HOST=db` dynamically, mounts volumes for persistence (`mock_s3_data`, `trained_models`), and starts only after the database is healthy.
    - `frontend`: Exposes React application on port `8018` and starts after backend starts.

---

## Verification Results

### Build Verification
- **Backend Image Build**: Built successfully (`bike-sharing-backend:latest` - 542MB).
- **Frontend Image Build**: Built successfully (`bike-sharing-frontend:latest` - 62.2MB).

### Service Health
The stack was spun up with `docker compose up -d`. All three containers launched and entered a healthy/running state:
```bash
[+] Running 7/7
 ✔ Network aws-hiimhoanglam_default          Created
 ✔ Volume "aws-hiimhoanglam_postgres_data"   Created
 ✔ Volume "aws-hiimhoanglam_mock_s3_data"    Created
 ✔ Volume "aws-hiimhoanglam_trained_models"  Created
 ✔ Container bike_sharing_db                 Healthy
 ✔ Container bike_sharing_backend            Started
 ✔ Container bike_sharing_frontend           Started
```

### HTTP Health Checks
We verified endpoint responses:
- **Backend Swagger API Docs** (`http://127.0.0.1:8036/docs`): HTTP **200 OK**
- **Frontend Home** (`http://127.0.0.1:8018/`): HTTP **200 OK**

---

# 🛡️ SecureCoder Security Audit

**Status**: Completed (Manual Verification)
**Scanned Files**: 4 (Dockerfile, nginx.conf, Dockerfile, docker-compose.yml)
**Vulnerabilities Found**: 0
**Vulnerabilities Fixed**: 0

> [!NOTE]
> The automated SecureCoder scanner was skipped as the configuration port was not active. A comprehensive manual security audit was conducted on all containerization files.

## Container Security Assessment

| File | Design Aspect | Security Best Practice Applied |
|---|---|---|
| [backend/Dockerfile](./backend/Dockerfile) | User Privilege | Runs as non-root user `appuser` (UID 10001) instead of standard root. |
| [backend/Dockerfile](./backend/Dockerfile) | Base Image | Uses `python:3.12-slim` to reduce vulnerable OS packages. |
| [frontend/Dockerfile](./frontend/Dockerfile) | User Privilege | Stage 2 uses `nginxinc/nginx-unprivileged:alpine` which runs as user `nginx` (UID 101). |
| [frontend/Dockerfile](./frontend/Dockerfile) | Stage Isolation | Node build environment and node_modules are discarded in the final image to keep size small and reduce attack surface. |
| [frontend/nginx.conf](./frontend/nginx.conf) | Port Settings | Binds Nginx to port `8018` (> 1024), adhering to unprivileged port rules. |
| [docker-compose.yml](./docker-compose.yml) | DB Security | Standard postgres image isolation inside docker network with password secrets loaded. |