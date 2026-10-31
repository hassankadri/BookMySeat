import { act } from 'react';
import { createRoot } from 'react-dom/client';

const mounted = new Set();
export async function settle() {
  await act(async () => {
    // Drain dependent Axios/effect promise chains without real time or network.
    for (let i = 0; i < 15; i += 1) await Promise.resolve();
  });
}
export async function render(ui) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const view = {
    container,
    async rerender(next) { await act(async () => root.render(next)); await settle(); },
    async unmount() { await act(async () => root.unmount()); container.remove(); mounted.delete(view); },
  };
  mounted.add(view);
  await view.rerender(ui);
  return view;
}
export async function click(element) {
  if (!element) throw new Error('Expected an interactive element');
  await act(async () => element.click());
  await settle();
}
export function button(container, text) {
  return [...container.querySelectorAll('button')].find(el => el.textContent.includes(text));
}
export async function advance(ms) {
  await act(async () => jest.advanceTimersByTime(ms));
  await settle();
}
export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
afterEach(async () => {
  for (const view of [...mounted]) await view.unmount();
});
