import React, { useState, useRef } from 'react';
import axios from 'axios';
import { UploadCloud, CheckCircle2, AlertTriangle, Play, RefreshCw, FileText } from 'lucide-react';
import { API_BASE } from '../App';

function UploadPage() {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState('idle'); // idle, presigning, uploading, uploaded, etl_running, completed, error
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [uploadId, setUploadId] = useState(null);
  const [processedCount, setProcessedCount] = useState(0);
  
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile) => {
    if (!selectedFile.name.endsWith('.csv')) {
      setUploadState('error');
      setMessage('Invalid file format. Please upload a CSV file.');
      return;
    }
    setFile(selectedFile);
    setUploadState('idle');
    setMessage('');
    setProgress(0);
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      setUploadState('presigning');
      setMessage('Generating upload authorization signature...');

      // 1. Get presigned URL from backend
      const presignRes = await axios.post(`${API_BASE}/upload/presign?filename=${encodeURIComponent(file.name)}`);
      const { url, fields, upload_id, s3_key } = presignRes.data;
      setUploadId(upload_id);

      // 2. Upload file directly (to S3 or simulated local mock endpoint)
      setUploadState('uploading');
      setMessage('Uploading file...');

      const formData = new FormData();
      if (fields && Object.keys(fields).length > 0) {
        // AWS S3 standard POST form format
        Object.entries(fields).forEach(([key, val]) => {
          formData.append(key, val);
        });
        formData.append('file', file);
      } else {
        // Fallback for simulated mock backend upload
        formData.append('file', file);
      }

      await axios.post(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percentCompleted);
        },
      });

      // 3. Mark upload as complete on backend
      setUploadState('uploaded');
      setMessage('File successfully uploaded. Ready for ETL transformation.');
      await axios.post(`${API_BASE}/upload/complete?upload_id=${upload_id}`);

    } catch (err) {
      console.error(err);
      setUploadState('error');
      setMessage(err.response?.data?.detail || 'Upload process failed. Please ensure the backend server is reachable.');
    }
  };

  const handleRunETL = async () => {
    if (!uploadId) return;

    try {
      setUploadState('etl_running');
      setMessage('Running ETL transformation (data cleaning, validation, and storage)...');

      const res = await axios.post(`${API_BASE}/etl/run?upload_id=${uploadId}`);
      
      setUploadState('completed');
      setProcessedCount(res.data.records_count);
      setMessage(res.data.message || 'Data successfully processed and integrated into Postgres.');
    } catch (err) {
      console.error(err);
      setUploadState('error');
      setMessage(err.response?.data?.detail || 'ETL processing failed. Check the CSV format and column names.');
    }
  };

  const resetUpload = () => {
    setFile(null);
    setUploadState('idle');
    setProgress(0);
    setMessage('');
    setUploadId(null);
    setProcessedCount(0);
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="page-header">
        <h2 className="page-title">Upload Bike Dataset</h2>
        <p className="page-subtitle">Upload your hourly/daily historical rental data CSV securely using AWS S3 Presigned URLs.</p>
      </div>

      <div className="card">
        {uploadState === 'idle' && !file && (
          <div 
            className={`upload-zone ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept=".csv"
              onChange={handleFileChange}
            />
            <UploadCloud className="upload-icon" />
            <div className="upload-text">
              <h3>Drag and drop your CSV dataset here</h3>
              <p>Or click to browse files from your computer</p>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Only .csv files are supported.</span>
          </div>
        )}

        {file && (
          <div className="mb-2" style={{ padding: '1.5rem', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="d-flex align-center gap-1">
              <FileText size={32} className="text-cyan" />
              <div style={{ flexGrow: 1 }}>
                <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: '600' }}>{file.name}</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{(file.size / 1024).toFixed(2)} KB</p>
              </div>
              {uploadState === 'idle' && (
                <button className="btn btn-secondary" style={{ width: 'auto', padding: '0.5rem 1rem' }} onClick={resetUpload}>
                  Remove
                </button>
              )}
            </div>

            {/* Progress Bar indicator */}
            {(uploadState === 'uploading' || progress > 0) && (
              <div style={{ marginTop: '1.5rem' }}>
                <div className="d-flex justify-between" style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  <span>Uploading to S3...</span>
                  <span>{progress}%</span>
                </div>
                <div className="progress-wrapper">
                  <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Panel / Status Panel */}
        {uploadState !== 'idle' && (
          <div className="mt-1 mb-2" style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '1rem', borderRadius: '12px', backgroundColor: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.1)' }}>
            {(uploadState === 'presigning' || uploadState === 'uploading' || uploadState === 'etl_running') ? (
              <RefreshCw size={24} className="text-cyan" style={{ animation: 'spin 2s linear infinite', flexShrink: 0, marginTop: '0.15rem' }} />
            ) : uploadState === 'completed' || uploadState === 'uploaded' ? (
              <CheckCircle2 size={24} className="text-success" style={{ flexShrink: 0, marginTop: '0.15rem' }} />
            ) : (
              <AlertTriangle size={24} className="text-danger" style={{ flexShrink: 0, marginTop: '0.15rem' }} />
            )}
            <div>
              <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: '600', textTransform: 'capitalize' }}>
                {uploadState.replace('_', ' ')}
              </h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: '1.4' }}>
                {message}
              </p>
            </div>
          </div>
        )}

        {/* Buttons Panel */}
        <div className="d-flex gap-1" style={{ marginTop: '1.5rem' }}>
          {uploadState === 'idle' && file && (
            <button className="btn btn-primary" onClick={handleUpload}>
              Start S3 Upload
            </button>
          )}

          {uploadState === 'uploaded' && (
            <button className="btn btn-primary" onClick={handleRunETL}>
              <Play size={18} />
              Execute ETL Pipeline
            </button>
          )}

          {(uploadState === 'completed' || uploadState === 'error') && (
            <button className="btn btn-secondary" onClick={resetUpload}>
              Upload Another Dataset
            </button>
          )}
        </div>
      </div>

      {/* CSV layout guides */}
      <div className="card mt-2">
        <h3 className="form-label" style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Expected CSV File Schema</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.5' }}>
          The CSV file should contain hourly or daily statistics. Column headers are case-sensitive and must match the structure below:
        </p>
        <div className="table-responsive">
          <table className="custom-table" style={{ fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th>Column Name</th>
                <th>Data Type</th>
                <th>Description / Permitted Range</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>season</code></td>
                <td>Integer</td>
                <td>1: Spring, 2: Summer, 3: Fall, 4: Winter</td>
              </tr>
              <tr>
                <td><code>yr</code></td>
                <td>Integer</td>
                <td>0: 2011, 1: 2012</td>
              </tr>
              <tr>
                <td><code>mnth</code></td>
                <td>Integer</td>
                <td>Month (1 to 12)</td>
              </tr>
              <tr>
                <td><code>holiday</code></td>
                <td>Integer</td>
                <td>1 if public holiday, else 0</td>
              </tr>
              <tr>
                <td><code>weekday</code></td>
                <td>Integer</td>
                <td>Day of the week (0 to 6)</td>
              </tr>
              <tr>
                <td><code>workingday</code></td>
                <td>Integer</td>
                <td>1 if working day (non-holiday/weekend), else 0</td>
              </tr>
              <tr>
                <td><code>weather</code></td>
                <td>Integer</td>
                <td>1 (Clear) to 4 (Storm/Heavy rain)</td>
              </tr>
              <tr>
                <td><code>temp</code></td>
                <td>Float</td>
                <td>Normalized temperature (0.0 to 1.0)</td>
              </tr>
              <tr>
                <td><code>atemp</code></td>
                <td>Float</td>
                <td>Normalized feels-like temperature (0.0 to 1.0)</td>
              </tr>
              <tr>
                <td><code>humidity</code></td>
                <td>Float</td>
                <td>Normalized humidity (0.0 to 1.0)</td>
              </tr>
              <tr>
                <td><code>windspeed</code></td>
                <td>Float</td>
                <td>Normalized wind speed (0.0 to 1.0)</td>
              </tr>
              <tr>
                <td><code>cnt</code></td>
                <td>Integer</td>
                <td>Total bike rental count (Target variable)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default UploadPage;
