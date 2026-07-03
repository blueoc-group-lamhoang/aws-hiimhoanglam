import os
import pickle
import boto3
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from botocore.exceptions import ClientError
from dotenv import load_dotenv

import models
import schemas
from database import engine, get_db, LOCAL_MODE
from etl import run_etl_pipeline
from train import train_model

# Load environment variables
load_dotenv()

# Initialize tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Bike Sharing Analytics Platform API")

# Configure CORS
# In production, specify actual frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure models directory exists and check if we have a model registered
@app.on_event("startup")
def startup_event():
    os.makedirs("models", exist_ok=True)
    os.makedirs("mock_s3_bucket/raw", exist_ok=True)
    os.makedirs("mock_s3_bucket/processed", exist_ok=True)
    
    # Train a default model if none exists
    db = next(get_db())
    latest_model = db.query(models.ModelRegistry).order_by(models.ModelRegistry.id.desc()).first()
    if not latest_model:
        print("No models found in registry. Running startup training...")
        try:
            train_model()
        except Exception as e:
            print(f"Failed to train default model on startup: {e}")

# Helper to get S3 client
def get_s3_client():
    if LOCAL_MODE:
        return None
    return boto3.client(
        "s3",
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        region_name=os.getenv("AWS_REGION", "us-east-1")
    )

# --- Upload endpoints ---

@app.post("/upload/presign")
def generate_presigned_url(filename: str, db: Session = Depends(get_db)):
    """
    Generate an upload URL. In LOCAL_MODE, this returns a mock URL pointing to
    the backend's upload endpoint. In production, it returns an AWS S3 presigned URL.
    """
    import uuid
    s3_key = f"raw/{uuid.uuid4()}_{filename}"

    # Create pending UploadHistory record
    upload_record = models.UploadHistory(
        filename=filename,
        s3_key=s3_key,
        status="PENDING"
    )
    db.add(upload_record)
    db.commit()
    db.refresh(upload_record)

    if LOCAL_MODE:
        backend_host = os.getenv("BACKEND_HOST", "127.0.0.1")
        backend_port = os.getenv("BACKEND_PORT", "8036")
        # Point to the local mock-s3 upload endpoint
        presigned_url = f"http://{backend_host}:{backend_port}/upload/mock-s3?upload_id={upload_record.id}"
        return {
            "upload_id": upload_record.id,
            "url": presigned_url,
            "s3_key": s3_key,
            "fields": {}
        }
    
    # AWS configuration
    s3_client = get_s3_client()
    bucket_name = os.getenv("S3_BUCKET_NAME")
    try:
        response = s3_client.generate_presigned_post(
            Bucket=bucket_name,
            Key=s3_key,
            ExpiresIn=3600
        )
        return {
            "upload_id": upload_record.id,
            "url": response["url"],
            "fields": response["fields"],
            "s3_key": s3_key
        }
    except ClientError as e:
        db.delete(upload_record)
        db.commit()
        raise HTTPException(status_code=500, detail=f"S3 Client error: {str(e)}")

@app.post("/upload/complete")
def complete_upload(upload_id: int, db: Session = Depends(get_db)):
    """
    Updates the upload record status after the client completes uploading to S3/Mock.
    """
    upload = db.query(models.UploadHistory).filter(models.UploadHistory.id == upload_id).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload record not found")
    
    if upload.status == "PENDING":
        upload.status = "UPLOADED"
        db.commit()
        db.refresh(upload)
    
    return {"status": "success", "upload": {
        "id": upload.id,
        "filename": upload.filename,
        "status": upload.status,
        "s3_key": upload.s3_key
    }}

@app.post("/upload/mock-s3")
async def mock_s3_upload(upload_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Development endpoint that simulates S3 upload by saving files locally.
    """
    if not LOCAL_MODE:
        raise HTTPException(status_code=400, detail="Mock upload is only supported in LOCAL_MODE")
        
    upload = db.query(models.UploadHistory).filter(models.UploadHistory.id == upload_id).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload ID not found")

    try:
        content = await file.read()
        file_path = os.path.join("mock_s3_bucket", upload.s3_key)
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        with open(file_path, "wb") as f:
            f.write(content)
            
        upload.status = "UPLOADED"
        db.commit()
        
        return {"message": f"Successfully simulated upload to S3 key: {upload.s3_key}"}
    except Exception as e:
        upload.status = "FAILED"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to write mock upload: {str(e)}")

# --- ETL endpoints ---

@app.post("/etl/run")
def trigger_etl(upload_id: int, db: Session = Depends(get_db)):
    """
    Executes ETL transformation on the dataset.
    """
    upload = db.query(models.UploadHistory).filter(models.UploadHistory.id == upload_id).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload record not found")
        
    # Read the file content
    file_content = b""
    if LOCAL_MODE:
        file_path = os.path.join("mock_s3_bucket", upload.s3_key)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Simulated raw dataset file not found on disk")
        with open(file_path, "rb") as f:
            file_content = f.read()
    else:
        s3_client = get_s3_client()
        bucket = os.getenv("S3_BUCKET_NAME")
        try:
            response = s3_client.get_object(Bucket=bucket, Key=upload.s3_key)
            file_content = response['Body'].read()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch dataset from S3: {str(e)}")
            
    # Run the ETL pipeline
    try:
        records_processed = run_etl_pipeline(db, upload.id, file_content)
        return {
            "status": "success",
            "message": f"ETL pipeline executed successfully. Processed {records_processed} records.",
            "records_count": records_processed
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"ETL pipeline failed: {str(e)}")

# --- Analytics endpoints ---

@app.get("/analytics/summary", response_model=schemas.AnalyticsSummaryResponse)
def get_analytics_summary(db: Session = Depends(get_db)):
    datasets_count = db.query(models.UploadHistory).filter(models.UploadHistory.status == "PROCESSED").count()
    records_count = db.query(models.ProcessedDataset).count()
    
    latest_model = db.query(models.ModelRegistry).order_by(models.ModelRegistry.id.desc()).first()
    model_version = latest_model.version if latest_model else "N/A"
    accuracy = latest_model.accuracy if latest_model else 0.0

    recent_uploads = db.query(models.UploadHistory).order_by(models.UploadHistory.id.desc()).limit(5).all()
    
    return {
        "datasets_count": datasets_count,
        "records_count": records_count,
        "model_version": model_version,
        "accuracy": accuracy,
        "recent_uploads": recent_uploads
    }

@app.get("/analytics/monthly")
def get_analytics_monthly(season: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(
        models.ProcessedDataset.mnth,
        func.avg(models.ProcessedDataset.cnt).label("avg_rentals")
    )
    if season:
        query = query.filter(models.ProcessedDataset.season == season)
        
    results = query.group_by(models.ProcessedDataset.mnth).order_by(models.ProcessedDataset.mnth).all()
    
    # Months names map
    month_names = {
        1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
        7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec"
    }
    
    return [{"month": month_names.get(r[0], str(r[0])), "avg_rentals": round(float(r[1]), 2)} for r in results]

@app.get("/analytics/weather")
def get_analytics_weather(db: Session = Depends(get_db)):
    results = db.query(
        models.ProcessedDataset.weathersit,
        func.avg(models.ProcessedDataset.cnt).label("avg_rentals")
    ).group_by(models.ProcessedDataset.weathersit).order_by(models.ProcessedDataset.weathersit).all()
    
    weather_names = {
        1: "Clear / Few Clouds",
        2: "Mist / Cloudy",
        3: "Light Snow / Rain",
        4: "Heavy Rain / Ice Palette"
    }
    return [{"weather": weather_names.get(r[0], f"Type {r[0]}"), "avg_rentals": round(float(r[1]), 2)} for r in results]

@app.get("/analytics/season")
def get_analytics_season(db: Session = Depends(get_db)):
    results = db.query(
        models.ProcessedDataset.season,
        func.avg(models.ProcessedDataset.cnt).label("avg_rentals")
    ).group_by(models.ProcessedDataset.season).order_by(models.ProcessedDataset.season).all()
    
    season_names = {
        1: "Spring",
        2: "Summer",
        3: "Fall",
        4: "Winter"
    }
    return [{"season": season_names.get(r[0], f"Season {r[0]}"), "avg_rentals": round(float(r[1]), 2)} for r in results]

@app.get("/analytics/trend")
def get_analytics_trend(db: Session = Depends(get_db)):
    # To prevent UI lag with huge datasets, we downsample or aggregate
    # Group by rounded temp (increments of 0.05) and get avg cnt
    temp_results = db.query(
        func.round(models.ProcessedDataset.temp * 20) / 20,
        func.avg(models.ProcessedDataset.cnt)
    ).group_by(func.round(models.ProcessedDataset.temp * 20) / 20).order_by(func.round(models.ProcessedDataset.temp * 20) / 20).all()

    # Group by rounded hum (increments of 0.05) and get avg cnt
    hum_results = db.query(
        func.round(models.ProcessedDataset.hum * 20) / 20,
        func.avg(models.ProcessedDataset.cnt)
    ).group_by(func.round(models.ProcessedDataset.hum * 20) / 20).order_by(func.round(models.ProcessedDataset.hum * 20) / 20).all()

    return {
        "temp_vs_rentals": [{"temp": float(r[0]), "avg_rentals": round(float(r[1]), 2)} for r in temp_results],
        "hum_vs_rentals": [{"humidity": float(r[0]), "avg_rentals": round(float(r[1]), 2)} for r in hum_results]
    }

# --- Prediction Endpoint ---

@app.post("/predict", response_model=schemas.PredictionOutput)
def predict_bike_rentals(payload: schemas.PredictionInput, db: Session = Depends(get_db)):
    """
    Accept environmental parameters and output prediction results.
    Checks the registry for the latest model binary.
    """
    latest_model = db.query(models.ModelRegistry).order_by(models.ModelRegistry.id.desc()).first()
    
    model_path = "models/model_latest.pkl"
    if latest_model and os.path.exists(latest_model.model_path):
        model_path = latest_model.model_path
        
    if not os.path.exists(model_path):
        # Trigger model training inline if file missing
        try:
            train_model()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"No trained ML model available and auto-training failed: {str(e)}")

    try:
        with open(model_path, "rb") as f:
            model = pickle.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading model binary: {str(e)}")

    try:
        # Prepare feature vector matching features list in train.py:
        # ['season', 'temp', 'humidity', 'windspeed', 'workingday', 'weather']
        features = [[
            payload.season,
            payload.temp,
            payload.humidity,
            payload.windspeed,
            payload.workingday,
            payload.weather
        ]]
        
        prediction_value = model.predict(features)[0]
        return {"prediction": max(0, int(round(prediction_value)))}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Inference error: {str(e)}")

@app.get("/history", response_model=List[schemas.UploadHistoryResponse])
def get_upload_history(db: Session = Depends(get_db)):
    return db.query(models.UploadHistory).order_by(models.UploadHistory.id.desc()).all()
