// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const getSession = vi.fn();
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { getSession: () => getSession() } }, SUPABASE_ENABLED: true }));
const request = vi.fn();
vi.mock('../../lib/accountDeletion', async (orig) => ({ ...(await orig<typeof import('../../lib/accountDeletion')>()), requestAccountDeletion: (...a: unknown[]) => request(...a) }));

import { DeleteAccount } from './DeleteAccount';

beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: { access_token: 'jwt', user: { email: 'ana@x.com' } } } });
  request.mockReset();
});

async function open(onSignOut = vi.fn()) {
  render(<DeleteAccount onSignOut={onSignOut} />);
  fireEvent.click(screen.getByRole('button', { name: 'Excluir conta' }));
  await screen.findByText('ana@x.com');
  return onSignOut;
}

describe('DeleteAccount', () => {
  it('keeps the confirm button off until the email is typed, and says local data stays', async () => {
    await open();
    const confirm = screen.getByRole('button', { name: /Excluir minha conta/ }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect(screen.getByRole('dialog').textContent).toContain('continua lá');
    fireEvent.change(screen.getByLabelText('Seu e-mail para confirmar'), { target: { value: 'outra@x.com' } });
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Seu e-mail para confirmar'), { target: { value: 'ANA@x.com' } });
    expect(confirm.disabled).toBe(false);
  });

  it('deletes through the relay with the session token, then signs out', async () => {
    request.mockResolvedValue({ ok: true });
    const out = await open();
    fireEvent.change(screen.getByLabelText('Seu e-mail para confirmar'), { target: { value: 'ana@x.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Excluir minha conta/ }));
    await waitFor(() => expect(out).toHaveBeenCalled());
    expect(request).toHaveBeenCalledWith('jwt');
  });

  it('shows the error and does not sign out when the relay refuses', async () => {
    request.mockResolvedValue({ ok: false, message: 'Contas de dono não podem ser excluídas por aqui.' });
    const out = await open();
    fireEvent.change(screen.getByLabelText('Seu e-mail para confirmar'), { target: { value: 'ana@x.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Excluir minha conta/ }));
    await screen.findByRole('alert');
    expect(out).not.toHaveBeenCalled();
  });
});
