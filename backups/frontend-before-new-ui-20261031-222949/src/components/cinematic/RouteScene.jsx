import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { animate, useReducedMotion } from 'framer-motion';
import { historyDirection, routeLabel, routeTreatment, SCENE_EASE } from './navigation';

function focusDestination(container, hash) {
  let target;
  try { target = hash && document.getElementById(decodeURIComponent(hash.slice(1))); } catch { /* malformed URL fragment */ }
  target = target || container.querySelector('h1') || container.querySelector('main') || container;
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

function RoutePosition({ scene }) {
  const location = useLocation();
  const action = useNavigationType();
  const current = useRef(null);
  const positions = useRef(new Map());
  useEffect(() => {
    const original = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    const save = () => {
      if (current.current) positions.current.set(current.current.key, window.scrollY);
    };
    window.addEventListener('scroll', save, { passive: true });
    return () => { window.removeEventListener('scroll', save); window.history.scrollRestoration = original; };
  }, []);

  useLayoutEffect(() => {
    const previous = current.current;
    if (previous) positions.current.set(previous.key, window.scrollY);
    current.current = location;
    const pathChanged = previous && previous.pathname !== location.pathname;
    const stored = positions.current.get(location.key);
    const restore = action === 'POP' && typeof stored === 'number';
    const shouldTop = pathChanged && !restore && !location.hash;
    let frame;
    let attempts = 0;
    let cancelled = false;
    const stop = () => { cancelled = true; cancelAnimationFrame(frame); };
    const place = () => {
      if (cancelled) return;
      let anchor;
      try { anchor = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { /* malformed hash stays navigable */ }
      const y = anchor ? Math.max(0, window.scrollY + anchor.getBoundingClientRect().top - 88) : restore ? stored : shouldTop ? 0 : null;
      if (y !== null) window.scrollTo({ top: y, left: 0, behavior: 'instant' });
      // Async page data can grow the document after a history visit. Stop as soon
      // as the position is reachable, on user input, or after two seconds at 60Hz.
      const pending = (location.hash && !anchor) || (restore && Math.abs(window.scrollY - stored) > 2);
      if (pending && ++attempts < 120) frame = requestAnimationFrame(place);
    };
    place();
    const focusFrame = requestAnimationFrame(() => {
      if ((pathChanged || location.hash) && !cancelled && !document.querySelector('[role="dialog"][data-state="open"]')) focusDestination(scene.current, location.hash);
    });
    ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(type => window.addEventListener(type, stop, { passive: true, once: true }));
    // Bound memory in a long-lived browsing session.
    if (positions.current.size > 100) positions.current.delete(positions.current.keys().next().value);
    return () => {
      stop(); cancelAnimationFrame(focusFrame);
      ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(type => window.removeEventListener(type, stop));
    };
  }, [location, action, scene]);
  return null;
}

/** One live route tree. Animation is a disposable visual layer, never a router. */
export default function RouteScene({ children }) {
  const location = useLocation();
  const action = useNavigationType();
  const reduced = useReducedMotion();
  const scene = useRef(null);
  const veil = useRef(null);
  const panel = useRef(null);
  const previous = useRef(null);

  useLayoutEffect(() => {
    const index = window.history.state?.idx;
    const from = previous.current;
    previous.current = { pathname: location.pathname, index };
    const node = scene.current;
    const overlay = veil.current;
    const sheet = panel.current;
    const controls = [];
    const reset = () => {
      node.style.transform = ''; node.style.opacity = ''; node.style.willChange = '';
      overlay.style.visibility = 'hidden'; sheet.style.transform = '';
      overlay.dataset.phase = 'idle';
    };
    reset();
    const toMode = routeTreatment(location.pathname);
    const fromMode = from && routeTreatment(from.pathname);
    if (!from || from.pathname === location.pathname || reduced || toMode === 'none' || fromMode === 'none') return reset;

    const direction = historyDirection(from.index, index, action);
    overlay.dataset.direction = String(direction);
    const spatial = toMode === 'spatial' && fromMode === 'spatial';
    overlay.dataset.phase = spatial ? 'spatial' : 'quiet';
    // Only discovery pages are transformed. Never transform a seat map or Elements.
    node.style.willChange = 'transform, opacity';
    controls.push(animate(node, spatial ? { x: [direction * Math.min(110, window.innerWidth * .12), 0], opacity: [.35, 1], scale: [.985, 1] } : { opacity: [.7, 1] }, {
      duration: spatial ? .82 : .18, ease: SCENE_EASE,
      onComplete: () => { node.style.transform = ''; node.style.opacity = ''; node.style.willChange = ''; },
    }));
    if (spatial) {
      overlay.style.visibility = 'visible';
      controls.push(animate(sheet, { x: [direction * -105 + '%', '0%', direction * 105 + '%'] }, {
        duration: .78, times: [0, .38, 1], ease: [.76, 0, .24, 1],
        onComplete: () => { overlay.style.visibility = 'hidden'; overlay.dataset.phase = 'idle'; },
      }));
    }
    // New navigation/reduced-motion/unmount cancels every unfinished animation.
    return () => { controls.forEach(control => control.stop()); reset(); };
  }, [location.pathname, location.key, action, reduced]);

  return <>
    <RoutePosition scene={scene} />
    <div className="bms-scene-viewport">
      <div ref={scene} id="bms-route-content" className="bms-scene" tabIndex={-1}>{children}</div>
    </div>
    <div ref={veil} className="bms-scene-veil" aria-hidden="true" data-phase="idle">
      <div ref={panel} className="bms-scene-panel">
        <span className="bms-scene-panel__edge" />
        <div className="bms-scene-slate"><span>BookMySeat / Next scene</span><strong>{routeLabel(location.pathname)}</strong><i>────→</i></div>
      </div>
    </div>
    <span className="sr-only" role="status" aria-live="polite">{routeLabel(location.pathname)}</span>
  </>;
}
