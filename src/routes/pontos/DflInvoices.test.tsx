// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { DflInvoices } from './DflInvoices';

afterEach(cleanup);

describe('DflInvoices', () => {
  it('tells "never synced" apart from "no invoices"', () => {
    const { getByText, rerender } = render(<DflInvoices invoices={null} />);
    expect(getByText('Sem dados do DFL')).toBeTruthy();
    rerender(<DflInvoices invoices={[]} />);
    expect(getByText('Nenhuma fatura')).toBeTruthy();
  });
});
