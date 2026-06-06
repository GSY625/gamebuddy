import { MascotSvg } from './MascotSvg';

type Props = {
  title: string;
  description?: string;
  variant?: 'sleep' | 'search' | 'party' | 'chat' | 'wave';
};

export function EmptyState({ title, description, variant = 'sleep' }: Props) {
  return (
    <div className="empty-state">
      <MascotSvg variant={variant} className="empty-state-mascot" />
      <h3>{title}</h3>
      {description && <p className="muted">{description}</p>}
    </div>
  );
}
