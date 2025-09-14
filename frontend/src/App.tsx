import { useEffect, useState } from 'react';
import axios from 'axios';
import { Box, Card, CardContent, Typography } from '@mui/material';

function App() {
  const [healthStatus, setHealthStatus] = useState<string>('checking...');

  useEffect(() => {
    axios.get('/api/health')
      .then(response => {
        setHealthStatus(response.data.status);
      })
      .catch(error => {
        console.error('Error fetching health status:', error);
        setHealthStatus('error');
      });
  }, []);

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Card sx={{ minWidth: 275 }}>
        <CardContent>
          <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>
            API Health Check
          </Typography>
          <Typography variant="h5" component="div">
            Status: {healthStatus}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}

export default App;