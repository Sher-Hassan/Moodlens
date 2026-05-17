import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useUser } from '../../context/UserContext';
import './Navbar.css';

export default function Navbar() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useUser();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const tabs = [
        { path: '/dashboard', label: 'Dashboard' },
        { path: '/physical', label: 'Physical' },
        { path: '/mental', label: 'Mental' },
        { path: '/meditate', label: 'Meditate' },
    ];

    const isActive = (path) => location.pathname === path;

    const handleMobileTabClick = (path) => {
        setShowMobileMenu(false);
        navigate(path);
    };

    return (
        <nav className="ml-navbar">
            <div className="ml-navbar__container">
                {/* Brand */}
                <Link to="/dashboard" className="ml-brand">
                    <span className="ml-brand__mark">
                        <span className="ml-brand__pulse" />
                    </span>
                    <span className="ml-brand__word">
                        MoodLens<span className="ml-brand__dot">.</span>
                    </span>
                </Link>

                {/* Desktop Tabs */}
                <div className="ml-navbar__tabs">
                    {tabs.map((tab) => (
                        <Link
                            key={tab.path}
                            to={tab.path}
                            className={`ml-tab ${isActive(tab.path) ? 'active' : ''}`}
                        >
                            {tab.label}
                        </Link>
                    ))}
                </div>

                {/* Right side controls */}
                <div className="ml-navbar__controls">
                    {/* Hamburger button (mobile only) */}
                    <button
                        className={`ml-hamburger ${showMobileMenu ? 'active' : ''}`}
                        onClick={() => setShowMobileMenu(!showMobileMenu)}
                        aria-label="Toggle menu"
                        aria-expanded={showMobileMenu}
                    >
                        <span className="ml-hamburger__line" />
                        <span className="ml-hamburger__line" />
                        <span className="ml-hamburger__line" />
                    </button>

                    {/* User dropdown */}
                    {user && (
                        <div className="navbar__user">
                            <button
                                className="navbar__user-btn"
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                aria-label="User menu"
                                aria-expanded={showUserMenu}
                            >
                                <span className="navbar__user-avatar">
                                    {user.name?.charAt(0).toUpperCase() || 'U'}
                                </span>
                                <span className="navbar__user-name">
                                    {user.name?.split(' ')[0] || 'User'}
                                </span>
                            </button>

                            {showUserMenu && (
                                <>
                                    <div
                                        className="navbar__user-backdrop"
                                        onClick={() => setShowUserMenu(false)}
                                    />
                                    <div className="navbar__user-menu">
                                        <div className="navbar__user-info">
                                            <p className="navbar__user-info-name">{user.name}</p>
                                            <p className="navbar__user-info-email">{user.email}</p>
                                        </div>
                                        <div className="navbar__user-divider" />
                                        <Link
                                            to="/settings"
                                            className="navbar__user-item"
                                            onClick={() => setShowUserMenu(false)}
                                        >
                                            Settings
                                        </Link>
                                        <Link
                                            to="/shortcut-setup"
                                            className="navbar__user-item"
                                            onClick={() => setShowUserMenu(false)}
                                        >
                                            iOS Shortcut
                                        </Link>
                                        <div className="navbar__user-divider" />
                                        <button
                                            onClick={handleLogout}
                                            className="navbar__user-item navbar__user-item--danger"
                                        >
                                            Sign out
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile dropdown menu */}
            {showMobileMenu && (
                <>
                    <div
                        className="ml-mobile-backdrop"
                        onClick={() => setShowMobileMenu(false)}
                    />
                    <div className="ml-mobile-menu">
                        {tabs.map((tab) => (
                            <button
                                key={tab.path}
                                onClick={() => handleMobileTabClick(tab.path)}
                                className={`ml-mobile-tab ${isActive(tab.path) ? 'active' : ''}`}
                            >
                                <span className="ml-mobile-tab__label">{tab.label}</span>
                                {isActive(tab.path) && (
                                    <span className="ml-mobile-tab__indicator" />
                                )}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </nav>
    );
}