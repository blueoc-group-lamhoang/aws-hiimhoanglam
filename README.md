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

# Frontend

The frontend is built using React.

Its responsibility is visualization only.

No AWS credentials are exposed.

Communication with AWS is always performed through the Backend.

---

## Pages

### 1. Dashboard

Display overall system information.

- Number of uploaded datasets
- Number of processed records
- Current deployed ML model version
- Prediction accuracy
- Recent uploads

---

### 2. Upload Dataset

Users upload CSV files.

Workflow:

```
Choose CSV

↓

Frontend requests Presigned URL

↓

Backend generates URL

↓

Frontend uploads directly to S3

↓

Backend receives upload notification

↓

Metadata saved into PostgreSQL
```

The uploaded file never passes through Backend.

---

### 3. Analytics

Display processed data.

Possible charts:

- Bike rentals by month
- Bike rentals by season
- Bike rentals by weather
- Average rentals by weekday
- Temperature vs Rental Count
- Humidity vs Rental Count

Users can filter:

- Season
- Month
- Weather
- Holiday
- Working Day

---

### 4. Prediction

User enters:

- Season
- Temperature
- Humidity
- Wind Speed
- Weather Condition
- Working Day

Backend returns

```
Predicted Bike Rental Count
```

---

### 5. Upload History

Display

- Dataset name
- Upload time
- Processing status
- Number of records
- Model version used

---

# Backend

The Backend is implemented as a REST API.

Responsibilities:

- Authentication
- Generate S3 Presigned URLs
- Metadata management
- ETL
- Analytics APIs
- Prediction API
- ML model loading

---

## Main APIs

### Upload

```
POST /upload/presign
```

Generate S3 Presigned URL.

---

### Upload Callback

```
POST /upload/complete
```

Save metadata after upload completes.

---

### ETL

```
POST /etl/run
```

Execute preprocessing.

Steps:

- Validate CSV
- Remove invalid rows
- Normalize values
- Feature engineering
- Store processed dataset

---

### Analytics

```
GET /analytics/summary

GET /analytics/monthly

GET /analytics/weather

GET /analytics/season

GET /analytics/trend
```

---

### Prediction

```
POST /predict
```

Input

```json
{
    "season":2,
    "temp":0.62,
    "humidity":0.45,
    "windspeed":0.18,
    "workingday":1,
    "weather":1
}
```

Output

```json
{
    "prediction":354
}
```

---

# Database (Amazon RDS PostgreSQL)

Only processed metadata is stored.

Example tables

## upload_history

```
id

filename

uploaded_at

status

records

s3_key
```

---

## processed_dataset

Stores cleaned dataset.

---

## model_registry

```
id

version

accuracy

trained_at

model_path
```

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
CSV Upload

↓

raw/

↓

Validation

↓

Cleaning

↓

Feature Engineering

↓

processed/

↓

Load into PostgreSQL
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
Processed Dataset

↓

GitHub Actions

↓

Train Model

↓

Evaluate

↓

Save model.pkl

↓

Upload model to S3

↓

Backend reload model
```

Models:

- Random Forest Regressor
- XGBoost Regressor
- LightGBM (optional)

Evaluation metrics:

- RMSE
- MAE
- R² Score

---

# AWS Infrastructure

## Networking

VPC

Contains:

- Public Subnet
- Private Subnet
- Database Subnet

---

## Public Subnet

Contains

- Frontend EC2

Accessible from Internet.

---

## Private Subnet

Contains

- Backend EC2

No direct Internet access.

Outbound traffic uses:

- NAT Gateway

Backend accesses S3 through:

- S3 Gateway VPC Endpoint

---

## Database Subnet

Contains

Amazon RDS PostgreSQL

Private only.

---

# Security Groups

## Frontend Security Group

Allow

```
80/tcp

from

0.0.0.0/0
```

Optional

```
22/tcp

Administrator IP
```

---

## Backend Security Group

Allow

```
Application Port

only from Frontend Security Group
```

SSH

```
22

only from Frontend Security Group
```

---

## RDS Security Group

Allow

```
5432

only from Backend Security Group
```

No public access.

---

# Secure File Upload

Workflow

```
Frontend

↓

Backend

↓

Generate Presigned URL

↓

Upload directly to S3

↓

Backend receives metadata

↓

Save upload history
```

Advantages

- Backend bandwidth reduced
- No AWS credentials exposed
- Large file upload supported

---

# IAM

## GitHub Actions

Uses

OIDC Federation

No Access Key

No Secret Key

Permission

```
Push Docker images

to

Amazon ECR
```

---

## Backend EC2

IAM Role

Permission

- Read S3
- Read Secrets Manager

No ECR push permission.

---

## Frontend EC2

Permission

Pull Docker image only.

---

# Secrets Management

Database credentials are stored in

AWS Secrets Manager.

Features

- Automatic password rotation
- Backend retrieves credentials dynamically
- No plaintext password stored in source code

---

# Containerization

Frontend

```
Docker

↓

Amazon ECR

↓

Frontend EC2
```

Backend

```
Docker

↓

Amazon ECR

↓

Backend EC2
```

---

# CI/CD

## Application Deployment

Developer

↓

GitHub Push

↓

GitHub Actions

↓

Build Docker Image

↓

Push Image to Amazon ECR

↓

EC2 Pull Latest Image

↓

Restart Containers

---

## ML Pipeline

Processed Dataset

↓

GitHub Actions

↓

Train Model

↓

Evaluate

↓

Upload model.pkl

↓

Amazon S3

↓

Backend reload model

---

# Technologies

Frontend

- React
- Axios
- Chart.js

Backend

- FastAPI
- SQLAlchemy
- Pandas
- Scikit-learn

Database

- Amazon RDS PostgreSQL

Storage

- Amazon S3

Container

- Docker

Container Registry

- Amazon ECR

CI/CD

- GitHub Actions

Infrastructure

- Amazon EC2
- Amazon VPC
- NAT Gateway
- S3 Gateway Endpoint
- IAM
- Secrets Manager

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