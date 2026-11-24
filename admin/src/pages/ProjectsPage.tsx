import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { useIsAdmin } from '@/features/auth';
import { ProjectsPanel } from '@/features/projects';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function ProjectsPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('projects.title'));
  const isAdmin = useIsAdmin();
  return (
    <>
      <PageHeader title={t('projects.title')} description={t('projects.description')} />
      <ProjectsPanel canEdit={isAdmin} />
    </>
  );
}
