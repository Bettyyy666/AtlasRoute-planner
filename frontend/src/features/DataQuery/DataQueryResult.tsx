import "./DataQueryPanel.css";

interface QueryResult {
  headers: string[];
  rows: any[][];
  rawData?: any; // Add rawData for enhanced FBI display
}

interface DataQueryResultProps {
  queryResult: QueryResult | null;
  loading: boolean;
  error: string | null;
}

export default function DataQueryResult({ queryResult, loading, error }: DataQueryResultProps) {
  const renderFBIEnhancedData = (rawData: any) => {
    if (!rawData) return null;

    // Check if this is FBI staff data with the expected structure
    if (rawData.staffStats) {
      return (
        <div className="fbi-enhanced-data" style={{ marginTop: '20px' }}>
          {/* <h4>FBI Staff Data Details</h4> */}
          <div style={{ marginBottom: '20px', color: '#fff' }}>
            <p><strong>Query Information:</strong></p>
            <ul>
              <li>Year: {rawData.year}</li>
              <li>Granularity: {rawData.query?.granularity || 'national'}</li>
              {rawData.query?.state && <li>State: {rawData.query.state}</li>}
              {rawData.query?.agency && <li>Agency: {rawData.query.agency}</li>}
            </ul>
          </div>
          
          {/* Additional raw data display for debugging */}
          {rawData.rawData && (
            <details style={{ marginTop: '20px', color: '#fff' }}>
              <summary>Raw API Response (Click to expand)</summary>
              <pre style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)', color: '#fff', padding: '10px', overflow: 'auto', fontSize: '12px' }}>
                {JSON.stringify(rawData.rawData, null, 2)}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="data-query-results">
      <h3>Query Results</h3>
      
      {loading && <div className="loading-message">Loading...</div>}
      
      {error && <div className="error-message">{error}</div>}
      
      {queryResult && !loading && !error ? (
        <div className="results-table-container">
          {/* Main Results Table */}
          <table className="results-table">
            <thead>
              <tr>
                {queryResult.headers.map((header, index) => (
                  <th key={index}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {queryResult.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Enhanced FBI Data Display */}
          {queryResult.rawData && renderFBIEnhancedData(queryResult.rawData)}
        </div>
      ) : !loading && !error && (
        <p>No data to display. Run a query to see results.</p>
      )}
    </div>
  );
}