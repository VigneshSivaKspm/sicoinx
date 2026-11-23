import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export const PageTransition: React.FC<PageTransitionProps> = ({ children, className = '' }) => {
  const { pathname } = useLocation();

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to top on route change. The dashboard/admin layouts scroll inside
    // their own content pane ([data-scroll-root]); public pages scroll the window.
    const root = ref.current?.closest<HTMLElement>('[data-scroll-root]');
    (root ?? window).scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);

  return (
    <div ref={ref} key={pathname} className={`animate-fade-in ${className}`}>
      {children}
    </div>
  );
};
