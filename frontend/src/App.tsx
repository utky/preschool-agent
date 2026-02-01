import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/hooks/useAuth'
import Layout from '@/components/layout/Layout'
import Home from '@/pages/Home'
import Login from '@/pages/Login'
import Documents from '@/pages/Documents'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/documents" element={<Documents />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App
