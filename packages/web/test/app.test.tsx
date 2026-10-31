// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { createRequire } from 'node:module';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';

const require = createRequire(import.meta.url);
const topology = readFileSync(require.resolve('world-atlas/countries-50m.json'), 'utf8');

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  // A fixed seed keeps these tests deterministic: this one seats the human in the middle of the turn order,
  // so the rivals have acted by the time the human's turn arrives.
  vi.stubGlobal('crypto', {
    getRandomValues: (a: Uint32Array) => {
      a[0] = 2;
      return a;
    },
    randomUUID: () => webcrypto.randomUUID(),
  });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(topology, { status: 200 })));
  Element.prototype.scrollIntoView = vi.fn();
  localStorage.clear();
  sessionStorage.clear();
  history.replaceState({}, '', '/');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function enterAsGuest(): Promise<void> {
  render(<App />);
  fireEvent.click(screen.getByText('Enter'));
  await advance(600);
  fireEvent.click(screen.getByText(/Continue as a local guest/));
  await advance(300);
}

describe('the whole app, through the UI', () => {
  it('shows the login screen first and offers no credentials', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Enter'));
    await advance(600);
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/student|inf4001n/i);
    // In dev with no Firebase there is a clearly-labelled guest, never a hidden backdoor.
    expect(screen.getByText(/Development mode/)).toBeTruthy();
  });

  it('starts a game: ten badges, ten players, protection shields, and rivals explaining themselves', async () => {
    await enterAsGuest();
    fireEvent.click(screen.getByText(/Start as/));
    await advance(1500);
    expect(document.querySelectorAll('g.badge')).toHaveLength(10);
    expect(document.querySelectorAll('.players li')).toHaveLength(10);
    expect(document.querySelectorAll('.tag.shield').length).toBeGreaterThan(0);
    await advance(8000);
    expect(document.querySelectorAll('.feed li').length).toBeGreaterThan(1);
  });

  it('plays on until it is the human\'s turn, then lets the human act, and saves the game so it can be resumed', async () => {
    await enterAsGuest();
    fireEvent.click(screen.getByText(/Start as/));
    await advance(500);
    fireEvent.click(screen.getByText(/To my turn/));
    for (let i = 0; i < 300 && !document.querySelector('.dock select, .dock .alloc, .end-banner'); i++) await advance(500);
    expect(document.querySelector('.dock .alloc, .dock select, .end-banner')).toBeTruthy();

    // End the turn (placing reinforcements first if asked)
    if (document.querySelector('.dock .alloc')) {
      fireEvent.click(screen.getByText(/Rest on/));
      fireEvent.click(screen.getByText('Confirm placement'));
      await advance(2500);
    }
    const end = screen.queryByText(/end turn/i);
    if (end) {
      fireEvent.click(end);
      await advance(2500);
    }

    // The game is stored, and "Menu" then "Resume" brings the same game back.
    expect(Object.keys(localStorage).some((k) => k.includes(':game:'))).toBe(true);
    fireEvent.click(screen.getByText(/Menu/));
    await advance(800);
    const resume = screen.queryByText('Resume');
    if (resume) {
      fireEvent.click(resume);
      await advance(1500);
      expect(document.querySelectorAll('g.badge')).toHaveLength(10);
    }
  }, 60_000);

  it('a visitor with only a spectator link needs no account and cannot play', async () => {
    history.replaceState({}, '', '/?watch=does-not-exist');
    render(<App />);
    await advance(13_000);
    expect(screen.getByText(/Game not found/)).toBeTruthy();
    expect(screen.queryByText(/Roll the dice/)).toBeNull();
  });
});
