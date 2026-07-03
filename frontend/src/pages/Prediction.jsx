import React, { useState } from 'react';
import axios from 'axios';
import { Cpu, RefreshCw, HelpCircle, Bike } from 'lucide-react';
import { API_BASE } from '../App';

function Prediction() {
  // User-friendly raw inputs
  const [season, setSeason] = useState('2'); // Summer default
  const [tempCelsius, setTempCelsius] = useState(24); // 24 degrees C
  const [humidityPercent, setHumidityPercent] = useState(55); // 55%
  const [windspeedKmh, setWindspeedKmh] = useState(12); // 12 km/h
  const [weather, setWeather] = useState('1'); // Clear default
  const [workingday, setWorkingday] = useState('1'); // Yes default

  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handlePredict = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Normalize parameters as expected by the Machine Learning model (trained on bike sharing dataset norms):
    // Temp is normalized by dividing by 41 max
    // Humidity is divided by 100 max
    // Windspeed is divided by 67 max
    const normalizedTemp = parseFloat((tempCelsius / 41).toFixed(4));
    const normalizedHum = parseFloat((humidityPercent / 100).toFixed(4));
    const normalizedWind = parseFloat((windspeedKmh / 67).toFixed(4));

    try {
      const payload = {
        season: parseInt(season),
        temp: normalizedTemp,
        humidity: normalizedHum,
        windspeed: normalizedWind,
        workingday: parseInt(workingday),
        weather: parseInt(weather)
      };

      const res = await axios.post(`${API_BASE}/predict`, payload);
      setPrediction(res.data.prediction);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Inference server error. Check if backend model registry has a compiled model.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h2 className="page-title">Bike Demand Prediction</h2>
        <p className="page-subtitle">Input weather and calendar details to execute real-time machine learning predictions.</p>
      </div>

      <div className="grid-split">
        {/* Left Side: Parameters Form */}
        <div className="card">
          <h3 className="form-label" style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Input Parameters</h3>
          <form onSubmit={handlePredict}>
            
            <div className="grid-stats" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.5rem' }}>
              {/* Season */}
              <div className="form-group">
                <label className="form-label">Season</label>
                <select className="form-control" value={season} onChange={(e) => setSeason(e.target.value)}>
                  <option value="1">Spring</option>
                  <option value="2">Summer</option>
                  <option value="3">Fall</option>
                  <option value="4">Winter</option>
                </select>
              </div>

              {/* Weather Situation */}
              <div className="form-group">
                <label className="form-label">Weather Situation</label>
                <select className="form-control" value={weather} onChange={(e) => setWeather(e.target.value)}>
                  <option value="1">Clear / Few Clouds</option>
                  <option value="2">Mist / Cloudy</option>
                  <option value="3">Light Snow / Rain</option>
                  <option value="4">Heavy Rain / Ice Palette</option>
                </select>
              </div>
            </div>

            <div className="grid-stats" style={{ gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '0.5rem' }}>
              {/* Working Day Toggle */}
              <div className="form-group">
                <label className="form-label">Day Category</label>
                <select className="form-control" value={workingday} onChange={(e) => setWorkingday(e.target.value)}>
                  <option value="1">Working Day (Weekday, Non-Holiday)</option>
                  <option value="0">Weekend or Public Holiday</option>
                </select>
              </div>
            </div>

            {/* Temperature Slider */}
            <div className="form-group">
              <div className="slider-header">
                <label className="form-label">Temperature (°C)</label>
                <span className="slider-value">{tempCelsius}°C</span>
              </div>
              <input 
                type="range" 
                min="-5" 
                max="40" 
                className="form-range" 
                value={tempCelsius} 
                onChange={(e) => setTempCelsius(parseInt(e.target.value))}
              />
              <div className="d-flex justify-between" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                <span>Freezing (-5°C)</span>
                <span>Sweltering (40°C)</span>
              </div>
            </div>

            {/* Humidity Slider */}
            <div className="form-group">
              <div className="slider-header">
                <label className="form-label">Humidity (%)</label>
                <span className="slider-value">{humidityPercent}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                className="form-range" 
                value={humidityPercent} 
                onChange={(e) => setHumidityPercent(parseInt(e.target.value))}
              />
              <div className="d-flex justify-between" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                <span>Bone Dry (0%)</span>
                <span>Saturated (100%)</span>
              </div>
            </div>

            {/* Wind Speed Slider */}
            <div className="form-group">
              <div className="slider-header">
                <label className="form-label">Wind Speed (km/h)</label>
                <span className="slider-value">{windspeedKmh} km/h</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="60" 
                className="form-range" 
                value={windspeedKmh} 
                onChange={(e) => setWindspeedKmh(parseInt(e.target.value))}
              />
              <div className="d-flex justify-between" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                <span>Calm (0 km/h)</span>
                <span>Strong Wind (60 km/h)</span>
              </div>
            </div>

            <button type="submit" className="btn btn-primary mt-1" disabled={loading}>
              {loading ? (
                <>
                  <RefreshCw size={18} style={{ animation: 'spin 1.5s linear infinite' }} />
                  Calculating Prediction...
                </>
              ) : (
                <>
                  <Cpu size={18} />
                  Run Inference Model
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Side: Prediction Result Box */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="prediction-output-card" style={{ flexGrow: 1 }}>
            {prediction !== null ? (
              <div className="animate-fade-in">
                <span className="sidebar-logo" style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🚲</span>
                <h4 className="prediction-title">Predicted Rental Demand</h4>
                <div className="prediction-number">
                  {prediction.toLocaleString()}
                </div>
                <div className="prediction-label">
                  Estimated Renting Users
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1.5rem', lineHeight: '1.4' }}>
                  Inference calculated using Random Forest Model binary based on current environment state.
                </p>
              </div>
            ) : (
              <div>
                <Bike size={64} style={{ color: 'var(--color-primary-glow)', strokeWidth: 1.5, margin: '0 auto 1.5rem' }} />
                <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', marginBottom: '0.5rem' }}>Awaiting Inference Parameters</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '280px', margin: '0 auto', lineHeight: '1.5' }}>
                  Adjust environmental configurations on the left pane and run the model to view estimations.
                </p>
              </div>
            )}

            {error && (
              <div className="mt-2 text-danger" style={{ fontSize: '0.85rem', padding: '0.75rem', backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px' }}>
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Prediction;
