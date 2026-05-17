import { createContext, useContext, useState, useEffect } from 'react';

const UserContext = createContext();

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) throw new Error('useUser must be used within UserProvider');
    return context;
};

export function UserProvider({ children }) {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('moodlens.user');
        const token = localStorage.getItem('moodlens.token');
        
        if (storedUser && token) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (err) {
                console.error('Failed to parse stored user:', err);
                localStorage.clear();
            }
        }
    }, []);

    const login = (userData, token) => {
        setUser(userData);
        localStorage.setItem('moodlens.user', JSON.stringify(userData));
        localStorage.setItem('moodlens.token', token);
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('moodlens.user');
        localStorage.removeItem('moodlens.token');
        // Don't navigate here - let the component handle it
    };

    return (
        <UserContext.Provider value={{ user, login, logout }}>
            {children}
        </UserContext.Provider>
    );
}