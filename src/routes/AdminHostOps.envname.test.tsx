// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { AdminHostOps } from './AdminHostOps';

afterEach(cleanup);

describe('AdminHostOps env name', () => {
  it('refuses an invalid name before sending, keeping the typed secret', () => {
    const onEnvSet = vi.fn();
    const props = { health: null, onEnvSet, onEnvUnset: vi.fn(), onMcpAdd: vi.fn(), onMcpRemove: vi.fn(), onCliInstall: vi.fn(), adminOp: null } as unknown as Parameters<typeof AdminHostOps>[0];
    const { getByLabelText, getByRole } = render(<AdminHostOps {...props} />);
    fireEvent.change(getByLabelText('Nome do token de ambiente'), { target: { value: 'MY-TOKEN' } });
    const value = getByLabelText('Valor do token de ambiente') as HTMLInputElement;
    fireEvent.change(value, { target: { value: 's3cret' } });
    expect(getByRole('alert').textContent).toContain('Nome inválido');
    fireEvent.keyDown(value, { key: 'Enter' });
    expect(onEnvSet).not.toHaveBeenCalled();
    expect(value.value).toBe('s3cret');
  });

  it('keeps name and secret when the send did not go out', () => {
    const onEnvSet = vi.fn(() => false);
    const props = { health: null, onEnvSet, onEnvUnset: vi.fn(), onMcpAdd: vi.fn(), onMcpRemove: vi.fn(), onCliInstall: vi.fn(), adminOp: null } as unknown as Parameters<typeof AdminHostOps>[0];
    const { getByLabelText } = render(<AdminHostOps {...props} />);
    fireEvent.change(getByLabelText('Nome do token de ambiente'), { target: { value: 'MY_TOKEN' } });
    const value = getByLabelText('Valor do token de ambiente') as HTMLInputElement;
    fireEvent.change(value, { target: { value: 's3cret' } });
    fireEvent.keyDown(value, { key: 'Enter' });
    expect(onEnvSet).toHaveBeenCalledWith('MY_TOKEN', 's3cret');
    expect(value.value).toBe('s3cret');
  });
});
