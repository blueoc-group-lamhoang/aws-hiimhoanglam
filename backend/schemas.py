from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class PredictionInput(BaseModel):
    season: int = Field(..., description="Season (1: spring, 2: summer, 3: fall, 4: winter)")
    temp: float = Field(..., description="Normalized temperature in Celsius (0 to 1)")
    humidity: float = Field(..., ge=0, le=1, description="Normalized humidity (0 to 1)")
    windspeed: float = Field(..., ge=0, le=1, description="Normalized wind speed (0 to 1)")
    workingday: int = Field(..., description="Working day (1 if day is neither weekend nor holiday, else 0)")
    weather: int = Field(..., description="Weather situation (1 to 4)")

class PredictionOutput(BaseModel):
    prediction: int = Field(..., description="Predicted bike rental count")

class UploadHistoryResponse(BaseModel):
    id: int
    filename: str
    uploaded_at: datetime
    status: str
    records: int
    s3_key: Optional[str]

    class Config:
        from_attributes = True

class ModelRegistryResponse(BaseModel):
    id: int
    version: str
    accuracy: float
    trained_at: datetime
    model_path: str

    class Config:
        from_attributes = True

class AnalyticsSummaryResponse(BaseModel):
    datasets_count: int
    records_count: int
    model_version: str
    accuracy: float
    recent_uploads: List[UploadHistoryResponse]
