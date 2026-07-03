import io
import pandas as pd
from sqlalchemy.orm import Session
from models import ProcessedDataset, UploadHistory

def run_etl_pipeline(db: Session, upload_id: int, file_content: bytes) -> int:
    """
    Executes ETL processing on the uploaded CSV dataset.
    Steps:
      - Validates CSV structure and required columns
      - Performs basic type conversion and handles missing values
      - Inserts processed records into the database
      - Updates the upload history record
    """
    try:
        # Load CSV using Pandas
        df = pd.read_csv(io.BytesIO(file_content))
        
        # Standardize column names to match the expected schema
        # Maps common variations in dataset naming
        rename_map = {
            'weather': 'weathersit',
            'humidity': 'hum',
            'humidity_rate': 'hum',
            'wind_speed': 'windspeed'
        }
        df.rename(columns=rename_map, inplace=True)

        # Required columns for the analytics & training pipeline
        required_cols = [
            'season', 'yr', 'mnth', 'holiday', 'weekday', 'workingday', 
            'weathersit', 'temp', 'atemp', 'hum', 'windspeed', 'cnt'
        ]

        # Verify columns exist
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            raise ValueError(f"Missing required columns: {missing_cols}")

        # Drop rows with missing target or essential values
        df.dropna(subset=['cnt', 'temp', 'hum', 'windspeed'], inplace=True)

        # Basic validation / filtering
        df = df[
            (df['temp'] >= 0) & (df['temp'] <= 1) &
            (df['hum'] >= 0) & (df['hum'] <= 1) &
            (df['windspeed'] >= 0) & (df['windspeed'] <= 1) &
            (df['cnt'] >= 0)
        ]

        # Fill missing casual/registered users if present
        if 'casual' not in df.columns:
            df['casual'] = 0
        if 'registered' not in df.columns:
            df['registered'] = 0
        df['casual'].fillna(0, inplace=True)
        df['registered'].fillna(0, inplace=True)

        # Convert records to model instances
        records_to_insert = []
        for _, row in df.iterrows():
            record = ProcessedDataset(
                season=int(row['season']),
                yr=int(row['yr']),
                mnth=int(row['mnth']),
                holiday=int(row['holiday']),
                weekday=int(row['weekday']),
                workingday=int(row['workingday']),
                weathersit=int(row['weathersit']),
                temp=float(row['temp']),
                atemp=float(row['atemp']),
                hum=float(row['hum']),
                windspeed=float(row['windspeed']),
                casual=int(row['casual']),
                registered=int(row['registered']),
                cnt=int(row['cnt']),
                upload_id=upload_id
            )
            records_to_insert.append(record)

        # Bulk insert to database for performance
        if records_to_insert:
            db.bulk_save_objects(records_to_insert)
            db.commit()

        # Update Upload History status to PROCESSED
        upload = db.query(UploadHistory).filter(UploadHistory.id == upload_id).first()
        if upload:
            upload.status = "PROCESSED"
            upload.records = len(records_to_insert)
            db.commit()

        return len(records_to_insert)

    except Exception as e:
        db.rollback()
        # Mark upload as FAILED
        upload = db.query(UploadHistory).filter(UploadHistory.id == upload_id).first()
        if upload:
            upload.status = "FAILED"
            db.commit()
        raise e
