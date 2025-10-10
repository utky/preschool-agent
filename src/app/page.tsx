'use client';

import { useState, useEffect } from 'react';

export default function Home() {
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
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">Preschool Agent</h1>
      <div className="text-lg">
        <p>API Health Check Status:</p>
        {healthStatus && <p className="text-green-500 font-bold">{healthStatus}</p>}
      </div>
    </main>
  );
}
