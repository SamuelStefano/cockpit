// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';

const toastSpy = vi.hoisted(() => vi.fn());
vi.mock('../primitives', async (orig) => ({ ...(await orig<typeof import('../primitives')>()), toast: toastSpy }));
vi.mock('../../lib/export', () => ({
  threadToMarkdown: () => '', download: vi.fn(), fileSlug: () => 'x',
  threadToPdf: vi.fn(async () => { throw new Error('chunk load failed'); }),
}));

import { ExportMenu } from './ExportMenu';

afterEach(cleanup);

describe('ExportMenu', () => {
  it('tells the user when the PDF export fails', async () => {
    const { getByTitle } = render(<ExportMenu title="t" messages={[]} />);
    fireEvent.click(getByTitle('Baixar conversa em PDF'));
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('PDF'), { tone: 'error' }));
  });
});
