import { useState } from 'react';
import { User, Lock, Settings as SettingsIcon, Download } from 'lucide-react';
import { useCurrentUser } from '../hooks';
import PasswordChangeForm from '../components/settings/PasswordChangeForm';
import EmailChangeForm from '../components/settings/EmailChangeForm';
import UpdateChecker from '../components/settings/UpdateChecker';

type Tab = 'profile' | 'security' | 'updates';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const { data: currentUser } = useCurrentUser();

  const tabs = [
    { id: 'profile' as Tab, label: 'Profil', icon: User },
    { id: 'security' as Tab, label: 'Sicherheit', icon: Lock },
    ...(currentUser?.role === 'admin'
      ? [
          { id: 'updates' as Tab, label: 'Updates', icon: Download },
