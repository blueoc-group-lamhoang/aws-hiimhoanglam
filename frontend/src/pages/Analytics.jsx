import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  PointElement, 
  LineElement, 
  ArcElement, 
  Title, 
  Tooltip, 
  Legend, 
  Filler
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { RefreshCw, Filter } from 'lucide-react';
import { API_BASE } from '../App';

// Register Chart.js modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function Analytics() {
  const [monthlyData, setMonthlyData] = useState([]);
  const [weatherData, setWeatherData] = useState([]);
  const [seasonData, setSeasonData] = useState([]);
  const [trendData, setTrendData] = useState(null);
  
  const [selectedSeasonFilter, setSelectedSeasonFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch concurrent analytics endpoints
      const monthlyUrl = selectedSeasonFilter 
        ? `${API_BASE}/analytics/monthly?season=${selectedSeasonFilter}` 
        : `${API_BASE}/analytics/monthly`;
        
      const [monthlyRes, weatherRes, seasonRes, trendRes] = await Promise.all([
        axios.get(monthlyUrl),
        axios.get(`${API_BASE}/analytics/weather`),
        axios.get(`${API_BASE}/analytics/season`),
        axios.get(`${API_BASE}/analytics/trend`)
      ]);

      setMonthlyData(monthlyRes.data);
      setWeatherData(weatherRes.data);
      setSeasonData(seasonRes.data);
      setTrendData(trendRes.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch analytics statistics. Ensure dataset is uploaded & ETL is run.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [selectedSeasonFilter]);

  // Global Chart Customization Options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#94a3b8',
          font: { family: 'Outfit', size: 12 }
        }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleFont: { family: 'Outfit', weight: 'bold' },
        bodyFont: { family: 'Plus Jakarta Sans' },
        borderColor: 'rgba(99, 102, 241, 0.2)',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.03)' },
        ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans' } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.03)' },
        ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans' } }
      }
    }
  };

  // 1. Monthly Bar Chart
  const monthlyChartData = {
    labels: monthlyData.map(d => d.month),
    datasets: [
      {
        label: 'Average Rental Count',
        data: monthlyData.map(d => d.avg_rentals),
        backgroundColor: 'rgba(99, 102, 241, 0.85)',
        borderColor: '#6366f1',
        borderWidth: 1,
        borderRadius: 8,
      }
    ]
  };

  // 2. Weather Horizontal Bar Chart
  const weatherChartData = {
    labels: weatherData.map(d => d.weather),
    datasets: [
      {
        label: 'Avg Rentals by Weather',
        data: weatherData.map(d => d.avg_rentals),
        backgroundColor: [
          'rgba(6, 182, 212, 0.85)', // Clear - Cyan
          'rgba(168, 85, 247, 0.85)', // Mist - Purple
          'rgba(245, 158, 11, 0.85)', // Light Snow - Amber
          'rgba(239, 68, 68, 0.85)'   // Heavy Rain - Rose
        ],
        borderWidth: 0,
        borderRadius: 8,
      }
    ]
  };

  // 3. Season Doughnut
  const seasonChartData = {
    labels: seasonData.map(d => d.season),
    datasets: [
      {
        data: seasonData.map(d => d.avg_rentals),
        backgroundColor: [
          'rgba(16, 185, 129, 0.75)', // Spring - Emerald
          'rgba(245, 158, 11, 0.75)', // Summer - Amber
          'rgba(99, 102, 241, 0.75)',  // Fall - Indigo
          'rgba(6, 182, 212, 0.75)'   // Winter - Cyan
        ],
        borderColor: '#0d121f',
        borderWidth: 2
      }
    ]
  };

  // 4. Temp vs Rentals Trend Line Chart
  const tempChartData = {
    labels: trendData?.temp_vs_rentals.map(d => (d.temp * 41).toFixed(1) + '°C') ?? [],
    datasets: [
      {
        fill: true,
        label: 'Avg Rental Count',
        data: trendData?.temp_vs_rentals.map(d => d.avg_rentals) ?? [],
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.15)',
        tension: 0.4,
        pointRadius: 2,
      }
    ]
  };

  // 5. Humidity vs Rentals Trend Line Chart
  const humChartData = {
    labels: trendData?.hum_vs_rentals.map(d => (d.humidity * 100).toFixed(0) + '%') ?? [],
    datasets: [
      {
        fill: true,
        label: 'Avg Rental Count',
        data: trendData?.hum_vs_rentals.map(d => d.avg_rentals) ?? [],
        borderColor: '#a855f7',
        backgroundColor: 'rgba(168, 85, 247, 0.15)',
        tension: 0.4,
        pointRadius: 2,
      }
    ]
  };

  if (loading && monthlyData.length === 0) {
    return (
      <div className="animate-fade-in text-center mt-1" style={{ paddingTop: '20vh' }}>
        <RefreshCw className="upload-icon" style={{ animation: 'spin 2s linear infinite', margin: '0 auto 1.5rem' }} />
        <h2>Generating Interactive Charts...</h2>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header d-flex justify-between align-center">
        <div>
          <h2 className="page-title">Analytics Dashboard</h2>
          <p className="page-subtitle">Examine rental trends relative to temporal, weather, and environmental variables.</p>
        </div>
        <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={fetchAnalytics} disabled={loading}>
          <RefreshCw size={16} style={{ animation: loading ? 'spin 1.5s linear infinite' : 'none' }} />
          Sync
        </button>
      </div>

      {error && (
        <div className="card text-danger mb-2" style={{ borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.05)' }}>
          <p>{error}</p>
        </div>
      )}

      {/* Filter Block */}
      <div className="filters-container">
        <div className="filter-item">
          <Filter size={14} className="text-cyan" />
          <span style={{ color: 'var(--text-secondary)' }}>Season Filter:</span>
          <select 
            value={selectedSeasonFilter} 
            onChange={(e) => setSelectedSeasonFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">All Seasons</option>
            <option value="1">Spring</option>
            <option value="2">Summer</option>
            <option value="3">Fall</option>
            <option value="4">Winter</option>
          </select>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid-split" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '1.5rem' }}>
        {/* Monthly Bar Chart */}
        <div className="card" style={{ height: '350px' }}>
          <h3 className="form-label" style={{ marginBottom: '1rem' }}>Rentals by Month</h3>
          <div style={{ position: 'relative', height: '80%' }}>
            <Bar data={monthlyChartData} options={chartOptions} />
          </div>
        </div>

        {/* Season Doughnut Chart */}
        <div className="card" style={{ height: '350px' }}>
          <h3 className="form-label" style={{ marginBottom: '1rem' }}>Rentals by Season</h3>
          <div style={{ position: 'relative', height: '80%' }}>
            <Doughnut 
              data={seasonChartData} 
              options={{
                ...chartOptions,
                scales: { x: { display: false }, y: { display: false } }
              }} 
            />
          </div>
        </div>
      </div>

      <div className="grid-split" style={{ gridTemplateColumns: '1fr', marginBottom: '1.5rem' }}>
        {/* Weather Bar Chart */}
        <div className="card" style={{ height: '350px' }}>
          <h3 className="form-label" style={{ marginBottom: '1rem' }}>Average Rentals by Weather Situation</h3>
          <div style={{ position: 'relative', height: '80%' }}>
            <Bar 
              data={weatherChartData} 
              options={{
                ...chartOptions,
                indexAxis: 'y' // Horizontal bar
              }} 
            />
          </div>
        </div>
      </div>

      <div className="grid-split" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Temp Line Chart */}
        <div className="card" style={{ height: '350px' }}>
          <h3 className="form-label" style={{ marginBottom: '1rem' }}>Temperature vs. Average Rental Demand</h3>
          <div style={{ position: 'relative', height: '80%' }}>
            <Line data={tempChartData} options={chartOptions} />
          </div>
        </div>

        {/* Humidity Line Chart */}
        <div className="card" style={{ height: '350px' }}>
          <h3 className="form-label" style={{ marginBottom: '1rem' }}>Humidity vs. Average Rental Demand</h3>
          <div style={{ position: 'relative', height: '80%' }}>
            <Line data={humChartData} options={chartOptions} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Analytics;
