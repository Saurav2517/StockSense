import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

// jsdom lacks a few browser APIs the UI touches defensively.
if (!window.matchMedia) {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
}
if (!window.scrollTo) window.scrollTo = () => {};
