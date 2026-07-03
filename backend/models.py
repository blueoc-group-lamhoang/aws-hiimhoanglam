import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime
from database import Base

class UploadHistory(Base):
    __tablename__ = "upload_history"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String, default="PENDING")  # PENDING, PROCESSED, FAILED
    records = Column(Integer, default=0)
    s3_key = Column(String, nullable=True)

class ProcessedDataset(Base):
    __tablename__ = "processed_dataset"

    id = Column(Integer, primary_key=True, index=True)
    season = Column(Integer, nullable=False)
    yr = Column(Integer, nullable=False)
    mnth = Column(Integer, nullable=False)
    holiday = Column(Integer, nullable=False)
    weekday = Column(Integer, nullable=False)
    workingday = Column(Integer, nullable=False)
    weathersit = Column(Integer, nullable=False)
    temp = Column(Float, nullable=False)
    atemp = Column(Float, nullable=False)
    hum = Column(Float, nullable=False)
    windspeed = Column(Float, nullable=False)
    casual = Column(Integer, nullable=True)
    registered = Column(Integer, nullable=True)
    cnt = Column(Integer, nullable=False)  # Target variable
    upload_id = Column(Integer, nullable=True)  # link to UploadHistory

class ModelRegistry(Base):
    __tablename__ = "model_registry"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(String, nullable=False, unique=True)
    accuracy = Column(Float, nullable=False)  # R^2 score or other metric
    trained_at = Column(DateTime, default=datetime.datetime.utcnow)
    model_path = Column(String, nullable=False)
