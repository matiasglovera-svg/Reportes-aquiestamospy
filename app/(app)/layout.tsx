import { ProveedorDatos } from '@/components/datos';
import { Shell } from '@/components/shell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProveedorDatos>
      <Shell>{children}</Shell>
    </ProveedorDatos>
  );
}
