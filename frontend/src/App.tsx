import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/hooks/useAuth'
import Layout from '@/components/layout/Layout'
import Home from '@/pages/Home'
import Login from '@/pages/Login'
import Documents from '@/pages/Documents'
import DocumentDetail from '@/pages/DocumentDetail'
import Chat from '@/pages/Chat'
import Events from '@/pages/Events'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/documents/:id" element={<DocumentDetail />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/events" element={<Events />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App
