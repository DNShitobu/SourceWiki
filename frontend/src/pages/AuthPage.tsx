import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useAuth } from '../lib/auth-context';
import { authApi } from '../lib/api';
import { COUNTRIES } from '../lib/mock-data';
import { toast } from 'sonner';
import { Globe, Loader2 } from 'lucide-react';

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [loading, setLoading] = useState(false);

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerCountry, setRegisterCountry] = useState('');
  const [wikipediaConfigured, setWikipediaConfigured] = useState(false);
  const [checkingWikipedia, setCheckingWikipedia] = useState(true);

  useEffect(() => {
    const loadWikipediaStatus = async () => {
      try {
        const response = await authApi.getWikipediaStatus();
        setWikipediaConfigured(Boolean(response.configured));
      } catch (error) {
        setWikipediaConfigured(false);
      } finally {
        setCheckingWikipedia(false);
      }
    };

    loadWikipediaStatus();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const success = await login(loginUsername, loginPassword);
      if (success) {
        navigate('/');
      }
    } catch (error) {
      // Error already handled in auth context
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!registerCountry) {
      toast.error('Please select a country');
      return;
    }

    setLoading(true);

    try {
      const success = await register(registerUsername, registerEmail, registerPassword, registerCountry);
      if (success) {
        navigate('/');
      }
    } catch (error) {
      // Error already handled in auth context
    } finally {
      setLoading(false);
    }
  };

  const handleWikipediaLogin = () => {
    window.location.assign(authApi.getWikipediaLoginUrl('/'));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="mb-2">Welcome to WikiSourceVerifier</h1>
          <p className="text-gray-600">Sign in or create an account to get started</p>
        </div>

        <Card className="mb-6 border-blue-200 bg-blue-50/70">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <Globe className="h-5 w-5 text-blue-700" />
              Continue with Wikipedia
            </CardTitle>
            <CardDescription className="text-center">
              Sign in with your Wikimedia account and use the same SourceWiki roles and workflows.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full border-blue-300 bg-white"
              onClick={handleWikipediaLogin}
              disabled={checkingWikipedia || !wikipediaConfigured}
            >
              {checkingWikipedia ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking Wikipedia login...
                </>
              ) : (
                'Login with Wikipedia'
              )}
            </Button>
            <p className="text-center text-xs text-blue-900">
              {wikipediaConfigured
                ? 'Use your existing Wikipedia account. New Wikipedia-backed users start as contributors.'
                : 'Wikipedia login is unavailable until the server is configured with Wikimedia OAuth credentials.'}
            </p>
          </CardContent>
        </Card>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>Login</CardTitle>
                <CardDescription>
                  Enter your credentials to access your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-username">Username</Label>
                    <Input
                      id="login-username"
                      type="text"
                      placeholder="Your username"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="Your password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="bg-blue-50 p-4 rounded-md">
                    <p className="text-sm text-blue-800">
                      <strong>Demo accounts:</strong>
                      <br />• WikiEditor2024 (Contributor)
                      <br />• SourceVerifier (Verifier)
                      <br />• AdminUser (Admin)
                    </p>
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Logging in...
                      </>
                    ) : (
                      'Login'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle>Create Account</CardTitle>
                <CardDescription>
                  Join the Wikipedia source verification community
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-username">Username</Label>
                    <Input
                      id="register-username"
                      type="text"
                      placeholder="Choose a username"
                      value={registerUsername}
                      onChange={(e) => setRegisterUsername(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="your.email@example.com"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-country">Country</Label>
                    <Select value={registerCountry} onValueChange={setRegisterCountry}>
                      <SelectTrigger id="register-country">
                        <SelectValue placeholder="Select your country" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.flag} {country.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-password">Password</Label>
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="Create a password"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="bg-amber-50 p-4 rounded-md">
                    <p className="text-sm text-amber-800">
                      By registering, you agree to help maintain Wikipedia's source quality standards.
                    </p>
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
