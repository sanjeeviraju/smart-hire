import { Navigate, Route, Routes } from 'react-router-dom';
import PrivateRoute from './components/layout/PrivateRoute';
import Dashboard from './pages/Dashboard';
import InterviewCompletePage from './pages/InterviewCompletePage';
import InterviewInvalidPage from './pages/InterviewInvalidPage';
import InterviewPage from './pages/InterviewPage';
import LandingLogin from './pages/LandingLogin';
import Register from './pages/Register';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingLogin />} />
      <Route path="/register" element={<Register />} />
      <Route path="/interview/invalid" element={<InterviewInvalidPage />} />
      <Route path="/interview/complete" element={<InterviewCompletePage />} />
      <Route path="/interview/:token" element={<InterviewPage />} />

      <Route element={<PrivateRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
