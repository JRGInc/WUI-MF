import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './providers/AuthProvider';
import { OfflineProvider } from './providers/OfflineProvider';
import { ThemeProvider } from './providers/ThemeProvider';
import { Layout } from '@/shared/components/Layout';
import { ProtectedRoute } from '@/shared/components/ProtectedRoute';
import { LoadingScreen } from '@/shared/components/LoadingScreen';
import { ToastContainer } from '@/shared/components/ToastContainer';

// Lazy load feature modules for code splitting
const Dashboard = lazy(() => import('@/features/dashboard/Dashboard'));
const AssessmentWizard = lazy(() => import('@/features/assessment/AssessmentWizard'));
const AssessmentDetail = lazy(() => import('@/features/assessment/AssessmentDetail'));
const RiskMap = lazy(() => import('@/features/maps/components/RiskMap'));
const ARViewer = lazy(() => import('@/features/augmented-reality/components/ARViewer'));
const TrainingHub = lazy(() => import('@/features/training/TrainingHub'));
const LessonViewer = lazy(() => import('@/features/training/components/LessonViewer'));
const Settings = lazy(() => import('@/features/settings/Settings'));
const Login = lazy(() => import('@/features/auth/Login'));
const Register = lazy(() => import('@/features/auth/Register'));

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <OfflineProvider>
          <div className="min-h-screen bg-background">
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Protected routes with layout */}
                <Route element={<ProtectedRoute />}>
                  <Route element={<Layout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/assessment/new" element={<AssessmentWizard />} />
                    <Route path="/assessment/:id" element={<AssessmentDetail />} />
                    <Route path="/assessment/:id/edit" element={<AssessmentWizard />} />
                    <Route path="/map" element={<RiskMap />} />
                    <Route path="/map/:assessmentId" element={<RiskMap />} />
                    <Route path="/ar" element={<ARViewer />} />
                    <Route path="/ar/:assessmentId" element={<ARViewer />} />
                    <Route path="/training" element={<TrainingHub />} />
                    <Route path="/training/:courseId" element={<LessonViewer />} />
                    <Route path="/training/:courseId/:lessonId" element={<LessonViewer />} />
                    <Route path="/settings" element={<Settings />} />
                  </Route>
                </Route>

                {/* Shared report view (public with token) */}
                <Route path="/report/:token" element={<AssessmentDetail />} />
              </Routes>
            </Suspense>
            <ToastContainer />
          </div>
        </OfflineProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
