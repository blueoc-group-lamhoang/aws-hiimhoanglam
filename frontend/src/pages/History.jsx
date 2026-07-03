import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { RefreshCw, Clock, Database, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';
import { API_BASE } from '../App';

function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/history`);
      setHistory(res.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch upload logs. Please confirm your FastAPI backend is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const getStatusBadge = (status) => {
    switch (status.toUpperCase()) {
      case 'PROCESSED':
        return (
          <span className="badge badge-processed" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <CheckCircle2 size={12} />
            Processed
          </span>
        );
      case 'UPLOADED':
        return (
          <span className="badge badge-uploaded" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <Database size={12} />
            Uploaded
          </span>
        );
      case 'PENDING':
        return (
          <span className="badge badge-pending" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <Clock size={12} />
            Pending
          </span>
        );
      default:
        return (
          <span className="badge badge-failed" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <AlertTriangle size={12} />
            Failed
          </span>
        );
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header d-flex justify-between align-center">
        <div>
          <h2 className="page-title">Dataset Upload History</h2>
          <p className="page-subtitle">Historical overview of uploaded raw CSV files, S3 storage keys, and processing statuses.</p>
        </div>
        <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={fetchHistory} disabled={loading}>
          <RefreshCw size={16} style={{ animation: loading ? 'spin 1.5s linear infinite' : 'none' }} />
          Refresh Log
        </button>
      </div>

      {error && (
        <div className="card text-danger mb-2" style={{ borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.05)' }}>
          <p>{error}</p>
        </div>
      )}

      <div className="card">
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Upload ID</th>
                <th>Dataset Name</th>
                <th>S3 Storage Key</th>
                <th>Uploaded Time</th>
                <th>Record Count</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.length > 0 ? (
                history.map((record) => (
                  <tr key={record.id}>
                    <td><code>#{record.id}</code></td>
                    <td style={{ fontWeight: '600' }}>{record.filename}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {record.s3_key || 'N/A'}
                    </td>
                    <td>{new Date(record.uploaded_at).toLocaleString()}</td>
                    <td>{record.records > 0 ? record.records.toLocaleString() : '-'}</td>
                    <td>{getStatusBadge(record.status)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
                    No dataset upload logs found in database metadata.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default HistoryPage;
