import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import GamesPage from './pages/GamesPage';
import GameDetailPage from './pages/GameDetailPage';
import GameModeSelectPage from './pages/GameModeSelectPage';
import GameRegionSelectPage from './pages/GameRegionSelectPage';
import LfgPage from './pages/LfgPage';
import InvitesPage from './pages/InvitesPage';
import PartiesPage from './pages/PartiesPage';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import FriendsPage from './pages/FriendsPage';
import UserProfilePage from './pages/UserProfilePage';
import NotificationsPage from './pages/NotificationsPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import DirectMessagesPage from './pages/DirectMessagesPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminReportsPage from './pages/AdminReportsPage';
import AdminReportDetailPage from './pages/AdminReportDetailPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminUserDetailPage from './pages/AdminUserDetailPage';
import AdminAiStatsPage from './pages/AdminAiStatsPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="app-bg">
        <div className="loading">加载中… ✨</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="app-bg">
        <div className="loading">加载中...</div>
      </div>
    );
  }
  if (user?.role !== 'admin' && user?.role !== 'superAdmin') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<GamesPage />} />
        <Route path="games" element={<GamesPage />} />
        <Route path="games/:id/region" element={<GameRegionSelectPage />} />
        <Route path="games/:id/mode" element={<GameModeSelectPage />} />
        <Route path="games/:id" element={<GameDetailPage />} />
        <Route path="lfg" element={<LfgPage />} />
        <Route path="invites" element={<InvitesPage />} />
        <Route path="parties" element={<PartiesPage />} />
        <Route path="chat/:roomId" element={<ChatPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="friends" element={<FriendsPage />} />
        <Route path="messages" element={<DirectMessagesPage />} />
        <Route path="messages/:friendId" element={<DirectMessagesPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="users/:userId" element={<UserProfilePage />} />
        <Route
          path="admin"
          element={
            <AdminRoute>
              <AdminDashboardPage />
            </AdminRoute>
          }
        />
        <Route
          path="admin/ai"
          element={
            <AdminRoute>
              <AdminAiStatsPage />
            </AdminRoute>
          }
        />
        <Route
          path="admin/reports"
          element={
            <AdminRoute>
              <AdminReportsPage />
            </AdminRoute>
          }
        />
        <Route
          path="admin/reports/:reportId"
          element={
            <AdminRoute>
              <AdminReportDetailPage />
            </AdminRoute>
          }
        />
        <Route
          path="admin/users"
          element={
            <AdminRoute>
              <AdminUsersPage />
            </AdminRoute>
          }
        />
        <Route
          path="admin/users/:userId"
          element={
            <AdminRoute>
              <AdminUserDetailPage />
            </AdminRoute>
          }
        />
      </Route>
    </Routes>
  );
}
