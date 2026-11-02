import type { CSSProperties } from 'react';

type IconName = 'calendar' | 'orders' | 'customers' | 'plus' | 'history' | 'cheese' | 'arrow' | 'home';

export function Icon({ name, className = '', style }: { name: IconName; className?: string; style?: CSSProperties }) {
  const paths = {
    calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M7.5 3v4m9-4v4M3.5 10h17M8 14h2m4 0h2m-8 4h2" /></>,
    orders: <><path d="M8 5H5v16h14V5h-3" /><rect x="8" y="3" width="8" height="4" rx="1.5" /><path d="M8 12h8m-8 4h5" /></>,
    customers: <><path d="m3 9 2-6h14l2 6M4 12v9h16v-9M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 21v-7h6v7" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    history: <><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6m2-3v5l3 2" /></>,
    cheese: <><path d="m3 10 13-7 5 7v11H3V10Zm0 0h18" /><circle cx="8" cy="15" r="1" /><circle cx="16" cy="17" r="2" /></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    home: <><path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7" /></>,
  };
  return <svg className={`icon ${className}`} style={style} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
