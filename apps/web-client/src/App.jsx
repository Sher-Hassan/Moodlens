import { Routes, Route, useLocation } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import { HealthDataProvider } from './context/HealthDataContext';
import Navbar from './components/Navbar/Navbar';
import ProtectedRoute from './components/common/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import PhysicalAnalysis from './pages/PhysicalAnalysis';
import MentalAnalysis from './pages/MentalAnalysis';
import Meditate from './pages/Meditate';
import Settings from './pages/Settings';
import ShortcutSetup from './pages/ShortcutSetup';
import ChatBot from './features/chatbot/components/ChatBot';

function App() {
    const location = useLocation();
    const hideNavbar =
        location.pathname === '/login' || location.pathname === '/register';

    return (
        <UserProvider>
            <HealthDataProvider>
                {!hideNavbar && <Navbar />}
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route
                        path="/dashboard"
                        element={
                            <ProtectedRoute>
                                <Dashboard />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/physical"
                        element={
                            <ProtectedRoute>
                                <PhysicalAnalysis />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/mental"
                        element={
                            <ProtectedRoute>
                                <MentalAnalysis />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/meditate"
                        element={
                            <ProtectedRoute>
                                <Meditate />
                            </ProtectedRoute>
                        }
                    />
                    <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                    <Route path="/shortcut-setup" element={<ProtectedRoute><ShortcutSetup /></ProtectedRoute>} />
                </Routes>
                <ChatBot />
            </HealthDataProvider>
        </UserProvider>
    );
}

export default App;