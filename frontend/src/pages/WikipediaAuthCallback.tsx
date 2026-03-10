import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth-context';

const sanitizeReturnTo = (value: string | null) => {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/';
  }

  return value;
};

export const WikipediaAuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { completeOAuthLogin } = useAuth();

  useEffect(() => {
    const finishWikipediaLogin = async () => {
      const error = searchParams.get('error');
      const returnTo = sanitizeReturnTo(searchParams.get('returnTo'));

      if (error) {
        toast.error(error);
        navigate('/auth', { replace: true });
        return;
      }

      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const accessToken = hashParams.get('accessToken');
      const refreshToken = hashParams.get('refreshToken');

      const success = await completeOAuthLogin(accessToken, refreshToken);

      if (success) {
        navigate(returnTo, { replace: true });
        return;
      }

      navigate('/auth', { replace: true });
    };

    finishWikipediaLogin();
  }, [completeOAuthLogin, navigate, searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-blue-600" />
        <h1 className="mt-4 text-2xl font-semibold">Finishing Wikipedia login</h1>
        <p className="mt-2 text-gray-600">Completing your SourceWiki session.</p>
      </div>
    </div>
  );
};
