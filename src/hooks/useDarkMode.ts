import { useState, useEffect } from 'react';

export const useDarkMode = () => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const item = window.localStorage.getItem('theme');
      return item === 'dark';
    } catch (error) {
      return false;
    }
  });

  useEffect(() => {
    try {
      if (isDarkMode) {
        window.document.body.classList.add('dark-mode');
        window.localStorage.setItem('theme', 'dark');
      } else {
        window.document.body.classList.remove('dark-mode');
        window.localStorage.setItem('theme', 'light');
      }
    } catch (error) {
      console.warn('Error setting theme in localStorage', error);
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  return { isDarkMode, toggleDarkMode };
};
