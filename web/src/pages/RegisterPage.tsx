import { useTranslation } from 'react-i18next';
import { AuthForm } from '@/features/auth';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function RegisterPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('auth.register.title'));

  return (
    <div className="px-5 py-8">
      <AuthForm mode="register" />
    </div>
  );
}
