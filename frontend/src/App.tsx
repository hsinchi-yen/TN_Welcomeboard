import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Playlists from './pages/Playlists';
import Upload from './pages/Upload';
import Schedules from './pages/Schedules';
import Displays from './pages/Displays';
import { useTheme } from './hooks/useTheme';

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function App() {
  const location = useLocation();
  const { theme, toggle } = useTheme();

  const navItems = [
    { name: 'Dashboard', path: '/' },
    { name: 'Displays', path: '/displays' },
    { name: 'Playlists', path: '/playlists' },
    { name: 'Upload', path: '/upload' },
    { name: 'Schedules', path: '/schedules' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col transition-colors duration-200">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm px-4 pt-4 pb-0">
        {/* Row 1: Logo | Title | Theme toggle */}
        <div className="w-full grid grid-cols-3 items-center pb-3">
          <div className="flex items-center justify-start">
            <img
              src={theme === 'dark' ? '/technexion_logo-white.svg' : '/technexion_logo.svg'}
              alt="TechNexion"
              className="h-8"
            />
          </div>
          <div className="flex items-center justify-center">
            <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-900 to-slate-900 dark:from-blue-400 dark:to-emerald-400 whitespace-nowrap">
              Welcome Board Admin
            </h1>
          </div>
          <div className="flex items-center justify-end">
            <button
              onClick={toggle}
              aria-label="Toggle dark mode"
              className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-gray-700" />

        {/* Row 2: Navigation */}
        <div className="flex justify-center py-2">
          <nav className="flex space-x-1">
            {navItems.map(item => (
              <Link
                key={item.name}
                to={item.path}
                className={`px-3 py-2 rounded-md transition-colors font-medium text-sm ${
                  (location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path)))
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="w-full">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/displays" element={<Displays />} />
            <Route path="/playlists" element={<Playlists />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/schedules" element={<Schedules />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default App;