import os
import pickle
import numpy as np
import pandas as pd
from datetime import datetime
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from sqlalchemy.orm import Session

from database import engine, SessionLocal
from models import ProcessedDataset, ModelRegistry

def train_model():
    """
    Query processed dataset from database and train a Random Forest Regressor.
    Saves the model file and registers it in the database registry.
    If no data exists in the database, generates a fallback mock model.
    """
    db: Session = SessionLocal()
    print("Starting ML Model training...")

    # Load data from processed_dataset table
    try:
        df = pd.read_sql("SELECT season, temp, hum, windspeed, workingday, weathersit, cnt FROM processed_dataset", con=engine)
    except Exception as e:
        print(f"Error reading database: {e}")
        df = pd.DataFrame()

    features = ['season', 'temp', 'hum', 'windspeed', 'workingday', 'weathersit']
    
    if df.empty or len(df) < 10:
        print("Warning: Insufficient or no data in processed_dataset. Creating a fallback mock model...")
        # Create a mock model using synthetic data so prediction API works immediately
        np.random.seed(42)
        n_samples = 100
        mock_data = {
            'season': np.random.randint(1, 5, n_samples),
            'temp': np.random.rand(n_samples),
            'hum': np.random.rand(n_samples),
            'windspeed': np.random.rand(n_samples),
            'workingday': np.random.randint(0, 2, n_samples),
            'weathersit': np.random.randint(1, 5, n_samples),
        }
        # Simulate realistic rental count: high temp = more rentals, high hum/wind = less rentals
        mock_data['cnt'] = (
            mock_data['temp'] * 5000 + 
            mock_data['workingday'] * 500 - 
            mock_data['hum'] * 1500 - 
            mock_data['windspeed'] * 1000 + 
            np.random.randint(500, 1500, n_samples)
        ).astype(int)
        
        df = pd.DataFrame(mock_data)

    X = df[features]
    y = df['cnt']

    # Standardize column name references (matching prediction parameters)
    X.rename(columns={'weathersit': 'weather', 'hum': 'humidity'}, inplace=True)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Train Random Forest Regressor
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)

    # Evaluate
    predictions = model.predict(X_test)
    rmse = float(np.sqrt(mean_squared_error(y_test, predictions)))
    mae = float(mean_absolute_error(y_test, predictions))
    r2 = float(r2_score(y_test, predictions))

    print(f"Model Training Results:")
    print(f"  R2 Score (Accuracy): {r2:.4f}")
    print(f"  RMSE: {rmse:.2f}")
    print(f"  MAE: {mae:.2f}")

    # Determine version increment
    last_model = db.query(ModelRegistry).order_by(ModelRegistry.id.desc()).first()
    if last_model:
        try:
            ver_num = int(last_model.version.replace("v", "").replace(".", ""))
            version = f"v1.0.{ver_num + 1}"
        except:
            version = f"v1.0.{last_model.id + 1}"
    else:
        version = "v1.0.0"

    # Ensure model folder exists
    os.makedirs("models", exist_ok=True)
    model_filename = f"models/model_{version}.pkl"

    # Save trained model to disk
    with open(model_filename, "wb") as f:
        pickle.dump(model, f)
    print(f"Saved model to {model_filename}")

    # In local mode, also copy to 'models/model_latest.pkl' for simplicity
    with open("models/model_latest.pkl", "wb") as f:
        pickle.dump(model, f)

    # Register in DB
    new_model = ModelRegistry(
        version=version,
        accuracy=round(r2, 4),
        trained_at=datetime.utcnow(),
        model_path=model_filename
    )
    db.add(new_model)
    db.commit()
    db.close()
    
    print(f"Model {version} registered in database.")
    return version, r2

if __name__ == "__main__":
    train_model()
