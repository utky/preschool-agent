import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider, Outlet } from 'react-router-dom'
import { AuthProvider } from '@/hooks/useAuth'
import Layout from '@/components/layout/Layout'
import Login from '@/pages/Login'
import Documents from '@/pages/Documents'
import DocumentDetail from '@/pages/DocumentDetail'
import Search from '@/pages/Search'
import Events from '@/pages/Events'

function Root() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<Root />}>
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Events />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/documents/:id" element={<DocumentDetail />} />
        <Route path="/search" element={<Search />} />
        <Route path="/events" element={<Events />} />
      </Route>
    </Route>
  )
)

export default function App() {
  return <RouterProvider router={router} />
}
