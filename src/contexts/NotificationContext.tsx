import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Reminder {
  id: string;
  title: string;
  date: string;
  status: 'pending' | 'completed';
  description?: string;
  createdAt: number;
}

export interface Notebook {
  id: string;
  title: string;
  notes: string;
  createdAt: string;
}

interface NotificationContextType {
  reminders: Reminder[];
  notebooks: Notebook[];
  activeNotifications: number;
  addReminder: (r: Reminder) => void;
  updateReminder: (id: string, updates: Partial<Reminder>) => void;
  deleteReminder: (id: string) => void;
  addNotebook: (n: Notebook) => void;
  updateNotebook: (id: string, updates: Partial<Notebook>) => void;
  deleteNotebook: (id: string) => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeNotifications, setActiveNotifications] = useState(0);

  // Load from Supabase on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return; // Not logged in

        const [remindersResponse, notebooksResponse] = await Promise.all([
          supabase.from('reminders').select('*').order('created_at', { ascending: false }),
          supabase.from('notebooks').select('*').order('created_at', { ascending: false })
        ]);

        if (remindersResponse.error && remindersResponse.error.code !== '42P01') {
          console.error('Error loading reminders:', remindersResponse.error);
        } else if (remindersResponse.data) {
          setReminders(remindersResponse.data.map(r => ({
            id: r.id,
            title: r.title,
            date: r.due_date,
            status: r.status,
            description: r.description,
            createdAt: new Date(r.created_at).getTime()
          })));
        }

        if (notebooksResponse.error && notebooksResponse.error.code !== '42P01') {
          console.error('Error loading notebooks:', notebooksResponse.error);
        } else if (notebooksResponse.data) {
          setNotebooks(notebooksResponse.data.map(n => ({
            id: n.id,
            title: n.title,
            notes: n.notes,
            createdAt: n.created_at
          })));
        }
      } catch (err) {
        console.error('Unexpected error loading notifications:', err);
      }
    };
    loadData();
  }, []);

  // Check for due reminders every 10 seconds
  useEffect(() => {
    const checkNotifications = () => {
      const now = new Date();
      let dueCount = 0;
      reminders.forEach(reminder => {
        if (reminder.status === 'pending') {
          const dueDate = new Date(reminder.date);
          if (dueDate <= now) {
            dueCount++;
          }
        }
      });
      setActiveNotifications(dueCount);
    };

    checkNotifications();
    const intervalId = setInterval(checkNotifications, 10000);
    return () => clearInterval(intervalId);
  }, [reminders]);

  const addReminder = async (r: Reminder) => {
    // Optimistic update
    setReminders(prev => [...prev, r]);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      // We don't send id because it might not be a valid uuid if generated from Date.now()
      const { error } = await supabase.from('reminders').insert([{
        user_id: userData.user.id,
        title: r.title,
        description: r.description || null,
        due_date: r.date,
        status: r.status
      }]);
      if (error) console.error('Error adding reminder to DB:', error);
    } catch (e) { console.error(e); }
  };

  const updateReminder = async (id: string, updates: Partial<Reminder>) => {
    // Optimistic update
    setReminders(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    try {
      // If it's a UUID, we can update it in DB
      if (id.length > 20) {
        const payload: any = {};
        if (updates.title) payload.title = updates.title;
        if (updates.description !== undefined) payload.description = updates.description;
        if (updates.date) payload.due_date = updates.date;
        if (updates.status) payload.status = updates.status;
        
        if (Object.keys(payload).length > 0) {
           await supabase.from('reminders').update(payload).eq('id', id);
        }
      }
    } catch (e) { console.error(e); }
  };

  const deleteReminder = async (id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id));
    if (id.length > 20) {
      await supabase.from('reminders').delete().eq('id', id);
    }
  };

  const addNotebook = async (n: Notebook) => {
    setNotebooks(prev => [...prev, n]);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { error } = await supabase.from('notebooks').insert([{
        user_id: userData.user.id,
        title: n.title,
        notes: n.notes
      }]);
      if (error) console.error('Error adding notebook to DB:', error);
    } catch (e) { console.error(e); }
  };

  const updateNotebook = async (id: string, updates: Partial<Notebook>) => {
    setNotebooks(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
    if (id.length > 20) {
      const payload: any = {};
      if (updates.title) payload.title = updates.title;
      if (updates.notes) payload.notes = updates.notes;
      if (Object.keys(payload).length > 0) {
        await supabase.from('notebooks').update(payload).eq('id', id);
      }
    }
  };

  const deleteNotebook = async (id: string) => {
    setNotebooks(prev => prev.filter(n => n.id !== id));
    if (id.length > 20) {
      await supabase.from('notebooks').delete().eq('id', id);
    }
  };

  const clearNotifications = () => {
    setActiveNotifications(0);
  };

  return (
    <NotificationContext.Provider value={{
      reminders, notebooks, activeNotifications,
      addReminder, updateReminder, deleteReminder,
      addNotebook, updateNotebook, deleteNotebook,
      clearNotifications
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
