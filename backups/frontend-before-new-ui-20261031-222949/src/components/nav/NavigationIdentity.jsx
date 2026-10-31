import React from 'react';
import { Link } from 'react-router-dom';

export function BrandMark() {
  return <span className="bms-brand"><svg viewBox="0 0 30 36" fill="none" aria-hidden="true"><path d="M3 32V12L15 3l12 9v20M8 32V15l7-5 7 5v17M3 32h24" stroke="currentColor" strokeWidth="1.4" /><path d="M12 29v-9h6v9" fill="#D71935" /></svg><span>BookMySeat<span className="bms-brand__caption">THE CINEMA AWAITS</span></span></span>;
}

export function NavigationItem({ link, active, mobile = false, onClick, linkRef }) {
  return <Link ref={linkRef} to={link.to} onClick={onClick} data-nav-link data-testid={mobile ? `sheet-${link.id}` : link.id} aria-current={active ? 'page' : undefined} className={mobile ? 'bms-menu-link' : 'bms-nav-link'}>
    <span className="bms-nav-number" aria-hidden="true">{link.number}</span>
    <span className="bms-nav-word"><span>{link.label}</span><span aria-hidden="true">{link.label}</span></span>
    {mobile && <span className="bms-menu-arrow" aria-hidden="true">↗</span>}
  </Link>;
}
