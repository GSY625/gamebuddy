import { ReactNode } from 'react';
import { ParticleBackground } from './ParticleBackground';
import { MascotSvg } from './MascotSvg';

type Props = {
  children: ReactNode;
  showDecor?: boolean;
};

/** 全局暗色背景 + 粒子 + 角落萌系装饰 */
export function AppShell({ children, showDecor = true }: Props) {
  return (
    <div className="app-bg">
      <ParticleBackground />
      <div className="bg-glow bg-glow-a" />
      <div className="bg-glow bg-glow-b" />
      {showDecor && (
        <>
          <MascotSvg variant="wave" className="decor-mascot decor-left" />
          <MascotSvg variant="party" className="decor-mascot decor-right" />
        </>
      )}
      <div className="app-bg-content">{children}</div>
    </div>
  );
}
