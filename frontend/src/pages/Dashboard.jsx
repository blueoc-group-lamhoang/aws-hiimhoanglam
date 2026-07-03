import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Database, FileSpreadsheet, Award, Calendar, RefreshCw } from 'lucide-react';
import { API_BASE } from '../App';

function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/analytics/summary`);
      setSummary(res.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch dashboard summary metrics. Please ensure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const getStatusBadge = (status) => {
    switch (status.toUpperCase()) {
      case 'PROCESSED':
        return <span className="badge badge-processed">Processed</span>;
      case 'UPLOADED':
        return <span className="badge badge-uploaded">Uploaded</span>;
      case 'PENDING':
        return <span className="badge badge-pending">Pending</span>;
      default:
        return <span className="badge badge-failed">Failed</span>;
    }
  };

  if (loading && !summary) {
    return (
      <div className="animate-fade-in text-center mt-1" style={{ paddingTop: '20vh' }}>
        <RefreshCw className="upload-icon" style={{ animation: 'spin 2s linear infinite', margin: '0 auto 1.5rem' }} />
        <h2>Loading dashboard metrics...</h2>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header d-flex justify-between align-center">
        <div>
          <h2 className="page-title">Analytics Dashboard</h2>
          <p className="page-subtitle">Overview of current MLOps training data, model status, and upload pipelines.</p>
        </div>
        <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={fetchSummary} disabled={loading}>
          <RefreshCw size={16} style={{ animation: loading ? 'spin 1.5s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="card text-danger mb-2" style={{ borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.05)' }}>
          <p>{error}</p>
        </div>
      )}

      {/* Stats Cards Grid */}
      <div className="grid-stats">
        <div className="card card-stat">
          <div className="stat-icon-wrapper">
            <FileSpreadsheet size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{summary?.datasets_count ?? 0}</span>
            <span className="stat-label">Processed Datasets</span>
          </div>
        </div>

        <div className="card card-stat">
          <div className="stat-icon-wrapper">
            <Database size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{(summary?.records_count ?? 0).toLocaleString()}</span>
            <span className="stat-label">Total Cleaned Records</span>
          </div>
        </div>

        <div className="card card-stat">
          <div className="stat-icon-wrapper">
            <Calendar size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{summary?.model_version || 'v1.0.0'}</span>
            <span className="stat-label">Deployed ML Model</span>
          </div>
        </div>

        <div className="card card-stat">
          <div className="stat-icon-wrapper">
            <Award size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">
              {summary?.accuracy ? `${(summary.accuracy * 100).toFixed(2)}%` : '0.00%'}
            </span>
            <span className="stat-label">Prediction R² Accuracy</span>
          </div>
        </div>
      </div>

      {/* Main split grid */}
      <div className="grid-split">
        {/* Recent Uploads Table Card */}
        <div className="card">
          <h3 className="form-label" style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Recent Dataset Uploads</h3>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Upload Time</th>
                  <th>Status</th>
                  <th>Records</th>
                </tr>
              </thead>
              <tbody>
                {summary?.recent_uploads && summary.recent_uploads.length > 0 ? (
                  summary.recent_uploads.map((upload) => (
                    <tr key={upload.id}>
                      <td style={{ fontWeight: '600' }}>{upload.filename}</td>
                      <td>{new Date(upload.uploaded_at).toLocaleString()}</td>
                      <td>{getStatusBadge(upload.status)}</td>
                      <td>{upload.records > 0 ? upload.records.toLocaleString() : '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                      <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      No dataset uploads recorded yet. Go to "Upload Dataset" to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Model Information Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 className="form-label" style={{ fontSize: '1.25rem', marginBottom: '1.25rem' }}>MLOps System Status</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.5' }}>
              Our lightweight MLOps workflow bypasses heavy AWS SageMaker pipelines. Models are trained on-demand from PostgreSQL database data and pushed to S3.
            </p>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem', marginTop: '1rem' }}>
              <div className="d-flex justify-between mb-1">
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Workflow Engine:</span>
                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-primary)' }}>GitHub Actions</span>
              </div>
              <div className="d-flex justify-between mb-1">
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Model Type:</span>
                <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>Random Forest Regressor</span>
              </div>
              <div className="d-flex justify-between">
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Database Host:</span>
                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-success)' }}>Amazon RDS PG</span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: 'rgba(99,102,241,0.05)', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.1)' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
              Run the training script locally: <code style={{ color: 'var(--text-primary)', backgroundColor: 'rgba(0,0,0,0.3)', padding: '0.2rem 0.4rem', borderRadius: '4px', display: 'block', marginTop: '0.5rem', fontFamily: 'monospace' }}>python backend/train.py</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
