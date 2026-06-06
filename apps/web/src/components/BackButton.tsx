import { useNavigate } from 'react-router-dom';

type Props = {
  /** 无历史记录时的回退路径 */
  fallback?: string;
  className?: string;
};

export function BackButton({ fallback = '/games', className = '' }: Props) {
  const nav = useNavigate();

  const goBack = () => {
    if (window.history.length > 1) {
      nav(-1);
    } else {
      nav(fallback);
    }
  };

  return (
    <button
      type="button"
      className={`back-btn-top ${className}`.trim()}
      onClick={goBack}
      aria-label="返回"
    >
      ←
    </button>
  );
}
