import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from '@testing-library/react';
import { useBuildStore } from '@/store/buildStore';
import ExportImport from './ExportImport';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const RESET_STATE = {
  allItems: [],
  isLoaded: true,
  loadError: null,
  plan: { entries: [{ item_id: 'windtrap', quantity: 2 }], dd_mode: false },
  storageConfig: { containers: [] },
};

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  useBuildStore.setState(RESET_STATE);
  vi.stubGlobal('alert', vi.fn());
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ExportImport', () => {
  // ── Rendering ────────────────────────────────────────────────────────────────

  it('renders Export, Import, and Share buttons', () => {
    render(<ExportImport />);
    expect(screen.getByTitle('Export build plan as JSON')).toBeTruthy();
    expect(screen.getByTitle('Import build plan from JSON')).toBeTruthy();
    expect(screen.getByTitle('Copy share link')).toBeTruthy();
  });

  // ── handleExport ─────────────────────────────────────────────────────────────

  it('export: calls URL.createObjectURL with a JSON Blob', () => {
    render(<ExportImport />);
    fireEvent.click(screen.getByTitle('Export build plan as JSON'));

    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/json');
  });

  it('export: calls URL.revokeObjectURL after creating the download link', () => {
    render(<ExportImport />);
    fireEvent.click(screen.getByTitle('Export build plan as JSON'));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('export: blob contains valid JSON matching the current plan', async () => {
    render(<ExportImport />);
    fireEvent.click(screen.getByTitle('Export build plan as JSON'));

    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    const text = await blob.text();
    const parsed = JSON.parse(text) as unknown;
    expect(parsed).toEqual(RESET_STATE.plan);
  });

  // ── handleImport — valid ──────────────────────────────────────────────────────

  it('import: parses a valid JSON file and updates the plan', async () => {
    const newPlan = { entries: [{ item_id: 'solar', quantity: 1 }], dd_mode: true };
    const file = new File([JSON.stringify(newPlan)], 'plan.json', { type: 'application/json' });

    render(<ExportImport />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    await waitFor(() => {
      expect(useBuildStore.getState().plan).toEqual(newPlan);
    });
  });

  it('import: resets the file input value after a successful import', async () => {
    const newPlan = { entries: [{ item_id: 'solar', quantity: 1 }], dd_mode: false };
    const file = new File([JSON.stringify(newPlan)], 'plan.json', { type: 'application/json' });

    render(<ExportImport />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    await waitFor(() => {
      expect(useBuildStore.getState().plan).toEqual(newPlan);
    });
    expect(input.value).toBe('');
  });

  // ── handleImport — structurally invalid ──────────────────────────────────────

  it('import: shows an alert for structurally invalid plan JSON', async () => {
    const badPlan = { not_entries: [], dd_mode: false };
    const file = new File([JSON.stringify(badPlan)], 'bad.json', { type: 'application/json' });

    render(<ExportImport />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        'Invalid plan file. Expected a JSON file exported from Arrakis Planner.'
      );
    });
  });

  it('import: does not call importPlan for structurally invalid plan', async () => {
    const badPlan = { entries: 'not-an-array', dd_mode: false };
    const file = new File([JSON.stringify(badPlan)], 'bad.json', { type: 'application/json' });

    render(<ExportImport />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledOnce();
    });
    // Plan should remain unchanged
    expect(useBuildStore.getState().plan).toEqual(RESET_STATE.plan);
  });

  it('import: resets file input after invalid plan', async () => {
    const badPlan = { entries: 'not-an-array', dd_mode: false };
    const file = new File([JSON.stringify(badPlan)], 'bad.json', { type: 'application/json' });

    render(<ExportImport />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledOnce();
    });
    expect(input.value).toBe('');
  });

  // ── handleImport — malformed JSON ─────────────────────────────────────────────

  it('import: shows an alert for malformed JSON', async () => {
    const file = new File(['not { valid } json'], 'bad.json', { type: 'application/json' });

    render(<ExportImport />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        'Failed to parse plan file. Ensure it is valid JSON.'
      );
    });
  });

  it('import: does not call importPlan for malformed JSON', async () => {
    const file = new File(['{broken json}'], 'bad.json', { type: 'application/json' });

    render(<ExportImport />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledOnce();
    });
    expect(useBuildStore.getState().plan).toEqual(RESET_STATE.plan);
  });

  // ── handleCopyLink ────────────────────────────────────────────────────────────

  it('share: calls clipboard.writeText with the current URL', async () => {
    render(<ExportImport />);
    fireEvent.click(screen.getByTitle('Copy share link'));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(window.location.href);
    });
  });

  it('share: button shows "Copied!" after click', async () => {
    render(<ExportImport />);
    fireEvent.click(screen.getByTitle('Copy share link'));

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeTruthy();
    });
  });

  it('share: button reverts to "Share" after 1500ms', async () => {
    vi.useFakeTimers();
    render(<ExportImport />);

    await act(async () => {
      fireEvent.click(screen.getByTitle('Copy share link'));
      // Flush the clipboard Promise microtask
      await Promise.resolve();
    });

    expect(screen.getByText('Copied!')).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.queryByText('Copied!')).toBeNull();
    vi.useRealTimers();
  });

  it('share: button gets green styling when copied', async () => {
    render(<ExportImport />);
    const shareBtn = screen.getByTitle('Copy share link');

    fireEvent.click(shareBtn);

    await waitFor(() => {
      expect(shareBtn.className).toContain('text-green-400');
    });
  });
});
