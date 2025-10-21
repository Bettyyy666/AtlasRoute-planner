import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface FBIStaffData {
  query: {
    granularity: string;
  };
  year: number;
  staffStats: {
    year: string;
    officerCount: number;
    civilianCount: number;
    officersPer1000: number;
    population: number;
  };
  rawData: any;
}

const FBIDataTest: React.FC = () => {
  const [data, setData] = useState<FBIStaffData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFBIData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Fetching FBI staff data...');
      const response = await axios.get('http://localhost:3001/fbi-staff-data', {
        params: {
          granularity: 'national',
          year: 2024
        }
      });
      
      console.log('Response received:', response.data);
      setData(response.data);
    } catch (err: any) {
      console.error('Error:', err);
      setError(`Error: ${err.response?.status} - ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFBIData();
  }, []);

  if (loading) return <div>Loading FBI data...</div>;
  if (error) return <div style={{color: 'red'}}>Error: {error}</div>;
  if (!data) return <div>No data available</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2>FBI Staff Data Test</h2>
      <div style={{ marginBottom: '20px' }}>
        <strong>Year:</strong> {data.year} | <strong>Granularity:</strong> {data.query.granularity}
      </div>
      
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ backgroundColor: '#f0f0f0' }}>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>Year</th>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>Officer Count</th>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>Civilian Count</th>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>Officers per 1,000</th>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>Population</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ border: '1px solid #ddd', padding: '8px' }}>{data.staffStats.year}</td>
            <td style={{ border: '1px solid #ddd', padding: '8px' }}>{data.staffStats.officerCount.toLocaleString()}</td>
            <td style={{ border: '1px solid #ddd', padding: '8px' }}>{data.staffStats.civilianCount.toLocaleString()}</td>
            <td style={{ border: '1px solid #ddd', padding: '8px' }}>{data.staffStats.officersPer1000}</td>
            <td style={{ border: '1px solid #ddd', padding: '8px' }}>{data.staffStats.population.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
      
      <div style={{ marginTop: '20px' }}>
        <button onClick={fetchFBIData} style={{ padding: '10px 20px', fontSize: '16px' }}>
          Refresh Data
        </button>
      </div>
      
      <details style={{ marginTop: '20px' }}>
        <summary>Raw Data (Click to expand)</summary>
        <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', overflow: 'auto' }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
};

export default FBIDataTest;