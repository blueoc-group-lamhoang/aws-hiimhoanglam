import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, Upload, BarChart3, Cpu, History } from 'lucide-react';

// Import Pages
import Dashboard from './pages/Dashboard';
import UploadPage from './pages/Upload';
import Analytics from './pages/Analytics';
import Prediction from './pages/Prediction';
import HistoryPage from './pages/History';

function App() {
  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-logo">🚲</span>
          <h1 className="sidebar-title">CyclePulse</h1>
        </div>
        
        <nav className="sidebar-menu-wrapper">
          <ul className="sidebar-menu">
            <li>
              <NavLink 
                to="/" 
                className={({ isActive }) => `menu-link ${isActive ? 'active' : ''}`}
                end
              >
                <LayoutDashboard size={18} />
                <span>Dashboard</span>
              </NavLink>
            </li>
            <li>
              <NavLink 
                to="/upload" 
                className={({ isActive }) => `menu-link ${isActive ? 'active' : ''}`}
              >
                <Upload size={18} />
                <span>Upload Dataset</span>
              </NavLink>
            </li>
            <li>
              <NavLink 
                to="/analytics" 
                className={({ isActive }) => `menu-link ${isActive ? 'active' : ''}`}
              >
                <BarChart3 size={18} />
                <span>Analytics</span>
              </NavLink>
            </li>
            <li>
              <NavLink 
                to="/predict" 
                className={({ isActive }) => `menu-link ${isActive ? 'active' : ''}`}
              >
                <Cpu size={18} />
                <span>Prediction</span>
              </NavLink>
            </li>
            <li>
              <NavLink 
                to="/history" 
                className={({ isActive }) => `menu-link ${isActive ? 'active' : ''}`}
              >
                <History size={18} />
                <span>Upload History</span>
              </NavLink>
            </li>
          </ul>
        </nav>
        
        <div className="sidebar-footer">
          <p>AWS MLOps Demo v1.0</p>
          <p>© 2026 CyclePulse</p>
        </div>
      </aside>

      {/* Main Content Render area */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/predict" element={<Prediction />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
export const API_BASE = "http://127.0.0.1:8036";
