import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  
  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition shrink-0"
      style={{ padding: '7px', borderRadius: '8px' }}
    >
      {isDark ? (
        <Sun className="w-4.5 h-4.5" color="#FBBF24" />
      ) : (
        <Moon className="w-4.5 h-4.5" color="#9090A8" />
      )}
    </button>
  );
}

export default ThemeToggle;
