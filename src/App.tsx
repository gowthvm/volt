import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import LandingPage from '@/features/landing/LandingPage';
import LoginPage from '@/features/auth/LoginPage';
import SignupPage from '@/features/auth/SignupPage';
import NotFound from '@/pages/NotFound';
import EditorPage from '@/features/editor/EditorPage';
import ProjectsPage from '@/features/projects/ProjectsPage';
import ProtectedRoute from '@/components/ProtectedRoute';
import SharedProjectViewer from '@/components/SharedProjectViewer';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useAuth } from '@/hooks/useAuth';

function App() {
  useAuth();

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/editor"
          element={
            <ErrorBoundary>
              <ProtectedRoute>
                <EditorPage />
              </ProtectedRoute>
            </ErrorBoundary>
          }
        />
        <Route
          path="/projects"
          element={
            <ErrorBoundary>
              <ProtectedRoute>
                <ProjectsPage />
              </ProtectedRoute>
            </ErrorBoundary>
          }
        />
        <Route
          path="/shared/:token"
          element={
            <ErrorBoundary>
              <SharedProjectViewer />
            </ErrorBoundary>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
