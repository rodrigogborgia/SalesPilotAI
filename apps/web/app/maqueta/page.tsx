import type { Metadata } from 'next';
import MaquetaWorkspace from './MaquetaWorkspace';

export const metadata: Metadata = {
  title: 'Maqueta de trabajo | SalesPilotAI',
  description: 'Propuesta de bandeja de trabajo para Ventas y Mantenimiento.',
  openGraph: {
    title: 'Maqueta de trabajo | SalesPilotAI',
    description: 'Conoce una propuesta simple para las tareas de Ventas y Mantenimiento.',
    type: 'website'
  }
};

type MaquetaPageProps = {
  searchParams: { perfil?: string | string[] };
};

export default function MaquetaPage({ searchParams }: MaquetaPageProps) {
  const selectedProfile = Array.isArray(searchParams.perfil)
    ? searchParams.perfil[0]
    : searchParams.perfil;

  const initialProfile = selectedProfile === 'luciana' ? 'luciana' : 'david';
  return <MaquetaWorkspace key={initialProfile} initialProfile={initialProfile} />;
}
