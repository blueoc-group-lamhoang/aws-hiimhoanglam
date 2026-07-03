import os
import shutil
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Set environment variable to force LOCAL_MODE for testing
os.environ["LOCAL_MODE"] = "true"

from database import Base, get_db
import models

# Use a test database file instead of in-memory to persist tables correctly across sessions
TEST_DB_FILE = "./test_db.sqlite"
SQLALCHEMY_DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create the tables immediately so they exist when the TestClient triggers startup events
Base.metadata.create_all(bind=engine)
# Ensure directories exist
os.makedirs("models", exist_ok=True)
os.makedirs("mock_s3_bucket/raw", exist_ok=True)

# Override get_db dependency in FastAPI app
def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

from main import app
app.dependency_overrides[get_db] = override_get_db

# Initialize the TestClient (which triggers startup event and queries the database)
client = TestClient(app)

@pytest.fixture(autouse=True, scope="module")
def cleanup():
    yield
    # Clean up mock S3 directories
    if os.path.exists("mock_s3_bucket"):
        shutil.rmtree("mock_s3_bucket")
    # Clean up test database file
    if os.path.exists(TEST_DB_FILE):
        os.remove(TEST_DB_FILE)

def test_startup_default_model_creation():
    """
    Test that prediction works on startup (an automatic dummy/fallback model
    is trained and registered if none is present).
    """
    response = client.post("/predict", json={
        "season": 2,
        "temp": 0.6,
        "humidity": 0.5,
        "windspeed": 0.1,
        "workingday": 1,
        "weather": 1
    })
    assert response.status_code == 200
    data = response.json()
    assert "prediction" in data
    assert isinstance(data["prediction"], int)
    assert data["prediction"] >= 0

def test_upload_presign_flow():
    """
    Test generating simulated S3 upload presigned URL.
    """
    response = client.post("/upload/presign?filename=test_dataset.csv")
    assert response.status_code == 200
    data = response.json()
    assert "upload_id" in data
    assert "url" in data
    assert "s3_key" in data
    assert data["s3_key"].endswith("test_dataset.csv")

def test_mock_s3_upload_and_complete():
    """
    Test simulated file upload and marking upload as complete.
    """
    # 1. Generate URL
    presign_res = client.post("/upload/presign?filename=test_dataset.csv")
    upload_id = presign_res.json()["upload_id"]
    s3_key = presign_res.json()["s3_key"]

    # 2. Upload file via simulated endpoint
    csv_content = (
        "season,yr,mnth,holiday,weekday,workingday,weather,temp,atemp,humidity,windspeed,cnt\n"
        "2,0,5,0,1,1,1,0.5,0.48,0.6,0.15,2500\n"
        "2,0,5,0,2,1,2,0.55,0.52,0.65,0.18,2200\n"
        "2,0,5,0,3,1,1,0.6,0.58,0.5,0.12,3100\n"
    )
    
    file_payload = {"file": ("test_dataset.csv", csv_content, "text/csv")}
    upload_res = client.post(f"/upload/mock-s3?upload_id={upload_id}", files=file_payload)
    assert upload_res.status_code == 200
    
    # Check that file actually exists in local mock s3 bucket
    file_path = os.path.join("mock_s3_bucket", s3_key)
    assert os.path.exists(file_path)

    # 3. Call complete endpoint
    complete_res = client.post(f"/upload/complete?upload_id={upload_id}")
    assert complete_res.status_code == 200
    assert complete_res.json()["upload"]["status"] == "UPLOADED"

def test_etl_pipeline_execution():
    """
    Test running the ETL pipeline on an uploaded dataset.
    This cleans features and inserts them into the DB processed_dataset table.
    """
    # 1. Setup uploaded mock file
    presign_res = client.post("/upload/presign?filename=etl_test.csv")
    upload_id = presign_res.json()["upload_id"]
    s3_key = presign_res.json()["s3_key"]

    csv_content = (
        "season,yr,mnth,holiday,weekday,workingday,weather,temp,atemp,humidity,windspeed,cnt\n"
        "3,1,8,0,1,1,1,0.7,0.65,0.6,0.2,5000\n"
        "3,1,8,0,2,1,2,0.72,0.68,0.62,0.22,4800\n"
        "3,1,8,0,3,1,1,0.75,0.7,0.58,0.18,5200\n"
        "3,1,8,0,4,1,1,0.74,0.69,0.55,0.15,5500\n"
        "3,1,8,0,5,1,1,0.71,0.66,0.52,0.12,5600\n"
    )
    
    # Save the file directly in the mock folder (bypassing endpoint call to simulate clean storage)
    file_path = os.path.join("mock_s3_bucket", s3_key)
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "w") as f:
        f.write(csv_content)

    # Set status to uploaded in DB
    db = TestingSessionLocal()
    upload = db.query(models.UploadHistory).filter(models.UploadHistory.id == upload_id).first()
    upload.status = "UPLOADED"
    db.commit()
    db.close()

    # 2. Run ETL
    etl_res = client.post(f"/etl/run?upload_id={upload_id}")
    assert etl_res.status_code == 200
    assert etl_res.json()["status"] == "success"
    assert etl_res.json()["records_count"] == 5

    # Check status changed to PROCESSED
    history_res = client.get("/history")
    latest_history = [h for h in history_res.json() if h["id"] == upload_id][0]
    assert latest_history["status"] == "PROCESSED"
    assert latest_history["records"] == 5

def test_analytics_endpoints():
    """
    Test analytics query endpoints.
    """
    # 1. Monthly Summary
    summary_res = client.get("/analytics/summary")
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert summary["datasets_count"] > 0
    assert summary["records_count"] == 5
    assert "model_version" in summary
    assert "recent_uploads" in summary
    assert len(summary["recent_uploads"]) > 0

    # 2. Monthly Trend Chart
    monthly_res = client.get("/analytics/monthly")
    assert monthly_res.status_code == 200
    assert len(monthly_res.json()) > 0
    assert "month" in monthly_res.json()[0]
    assert "avg_rentals" in monthly_res.json()[0]

    # 3. Weather Analytics
    weather_res = client.get("/analytics/weather")
    assert weather_res.status_code == 200
    assert len(weather_res.json()) > 0

    # 4. Season Analytics
    season_res = client.get("/analytics/season")
    assert season_res.status_code == 200
    assert len(season_res.json()) > 0

    # 5. Continuous Correlation Trend (temp & humidity)
    trend_res = client.get("/analytics/trend")
    assert trend_res.status_code == 200
    trends = trend_res.json()
    assert "temp_vs_rentals" in trends
    assert "hum_vs_rentals" in trends
