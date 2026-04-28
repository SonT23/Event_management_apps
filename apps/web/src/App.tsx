import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { showLabFeature } from '@/lib/features'
import { ProtectedAppLayout } from '@/components/layout/ProtectedAppLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { EventBoothPage } from '@/pages/EventBoothPage'
import { MeetingBoothPage } from '@/pages/MeetingBoothPage'
import { EventDetailPage } from '@/pages/EventDetailPage'
import { EventsPage } from '@/pages/EventsPage'
import { HomePage } from '@/pages/HomePage'
import { LabPage } from '@/pages/LabPage'
import { LoginPage } from '@/pages/LoginPage'
import { MembersPage } from '@/pages/MembersPage'
import { MemberProfilePage } from '@/pages/MemberProfilePage'
import { RegisterPage } from '@/pages/RegisterPage'
import { MemberDisciplinePage } from '@/pages/MemberDisciplinePage'
import { ClubMeetingsPage } from '@/pages/ClubMeetingsPage'
import { OrgReportsPage } from '@/pages/OrgReportsPage'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/app" element={<ProtectedAppLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="events/:id" element={<EventDetailPage />} />
        <Route path="members/:userId" element={<MemberProfilePage />} />
        <Route path="members" element={<MembersPage />} />
        <Route path="meetings" element={<ClubMeetingsPage />} />
        <Route path="reports" element={<OrgReportsPage />} />
        <Route path="discipline" element={<MemberDisciplinePage />} />
        <Route path="booth/:eventId" element={<EventBoothPage />} />
        <Route
          path="booth-meeting/:eventId/:meetingId"
          element={<MeetingBoothPage />}
        />
        <Route
          path="lab"
          element={
            showLabFeature() ? (
              <LabPage />
            ) : (
              <Navigate to="/app/dashboard" replace />
            )
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
