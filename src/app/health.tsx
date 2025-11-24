'use client'
import { useState, useEffect } from 'react';
export default function Health() {
  const [healthStatus, setHealthStatus] = useState('');
  useEffect(() => {
    const fetchHealth = async () => {
      const response = await fetch('/api/health');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      setHealthStatus(data.status);
    };

    fetchHealth();
  }, []);
  return (
    <div className="text-lg mb-4">
      <p>API Health Check Status:</p>
      {healthStatus && <p className="text-green-500 font-bold">{healthStatus}</p>}
    </div>
  )
}
