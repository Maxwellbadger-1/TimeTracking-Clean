import { useState, FormEvent } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../ui/Card';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { LogIn } from 'lucide-react';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const { login, isLoading, error, clearError } = useAuthStore();

  const validateForm = (): boolean => {
    let isValid = true;

    // Reset errors
    setUsernameError('');
    setPasswordError('');

    // Validate username
    if (!username.trim()) {
      setUsernameError('Benutzername ist erforderlich');
      isValid = false;
    }

    // Validate password
    if (!password) {
      setPasswordError('Passwort ist erforderlich');
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Clear previous error
    clearError();

    // Validate
    if (!validateForm()) {
      return;
    }

    // Attempt login
    const success = await login(username, password);

    if (!success) {
      // Error handling is done by store
      console.error('Login failed');
    }
    // Success: authStore will update, App.tsx will redirect
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-center mb-2">
            <LogIn className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-center text-2xl">
            Stiftung der DPolG TimeTracker
          </CardTitle>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <Input
              type="text"
              label="Benutzername"
              placeholder="Ihr Benutzername"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              error={usernameError}
              disabled={isLoading}
              required
              autoFocus
            />

            <Input
              type="password"
              label="Passwort"
              placeholder="Ihr Passwort"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={passwordError}
              disabled={isLoading}
              required
            />

            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-800 dark:text-red-200">
                  {error}
                </p>
              </div>
            )}
          </CardContent>

          <CardFooter>
            <Button
              type="submit"
              fullWidth
              disabled={isLoading}
              className="relative"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Anmelden...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  Anmelden
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
