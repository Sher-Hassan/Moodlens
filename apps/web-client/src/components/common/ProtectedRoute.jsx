import { Navigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';

export default function ProtectedRoute({ children }) {
    const { user } = useUser();

    if (!user) {
        // Redirect to login if not authenticated
        return <Navigate to="/login" replace />;
    }

    return children;
}