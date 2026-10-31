import React from 'react';

const animatedProps = new Set(['initial', 'animate', 'exit', 'transition', 'variants', 'whileHover', 'whileTap', 'whileInView', 'viewport', 'layout', 'layoutId', 'onAnimationComplete']);
const components = new Map();
function wrap(tag) {
  if (!components.has(tag)) {
    const Component = React.forwardRef(({ children, ...props }, ref) =>
      React.createElement(tag, { ...Object.fromEntries(Object.entries(props).filter(([key]) => !animatedProps.has(key))), ref }, children));
    Component.displayName = `TestMotion(${typeof tag === 'string' ? tag : 'component'})`;
    components.set(tag, Component);
  }
  return components.get(tag);
}
export const motion = new Proxy(wrap, { get: (_, key) => wrap(key) });
export const AnimatePresence = ({ children }) => children;
export const useReducedMotion = () => true;
export const useScroll = () => ({ scrollYProgress: 0 });
export const useSpring = value => value;
