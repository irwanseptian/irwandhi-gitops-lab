import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, ProtectedRoute, AdminRoute } from './context/AuthContext';
import Layout      from './components/Layout';
import Dashboard   from './pages/Dashboard';
import Jobs        from './pages/Jobs';
import JobDetail   from './pages/JobDetail';
import NewJob      from './pages/NewJob';
import EditJob     from './pages/EditJob';
import Login       from './pages/Login';
import Register    from './pages/Register';
import AdminJobs   from './pages/admin/AdminJobs';
import AdminUsers  from './pages/admin/AdminUsers';
import Profile     from './pages/Profile';
import Report      from './pages/Report';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"     element={<Dashboard />} />
            <Route path="jobs"          element={<Jobs />} />
            <Route path="jobs/new"      element={<NewJob />} />
            <Route path="jobs/:id"      element={<JobDetail />} />
            <Route path="jobs/:id/edit" element={<EditJob />} />

            <Route path="profile" element={<Profile />} />
            <Route path="report"  element={<Report />} />

            <Route path="admin/jobs"  element={<AdminRoute><AdminJobs /></AdminRoute>} />
            <Route path="admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
