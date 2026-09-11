// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { AttachmentChips } from './AttachmentChips';

afterEach(cleanup);

describe('AttachmentChips', () => {
  it('opens a confirmed attachment in the preview modal', () => {
    const onOpen = vi.fn();
    render(<AttachmentChips attachments={[{ name: 'print.png', path: 'attachments/s/abc-print.png' }]} onRemoveAttachment={vi.fn()} onOpen={onOpen} />);
    fireEvent.click(screen.getByTitle('Ver print.png'));
    expect(onOpen).toHaveBeenCalledWith('attachments/s/abc-print.png', 'print.png');
  });

  it('does not open a chip that is still uploading', () => {
    const onOpen = vi.fn();
    render(<AttachmentChips attachments={[{ name: 'video.mp4', path: 'up-1', uploading: true }]} onRemoveAttachment={vi.fn()} onOpen={onOpen} />);
    fireEvent.click(screen.getByTitle('Enviando…'));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('flags attachments already sent and repeated ones', () => {
    render(
      <AttachmentChips
        attachments={[
          { name: 'a.png', path: 'p1', hash: 'x', dup: 'sent' },
          { name: 'b.png', path: 'p2', hash: 'y' },
          { name: 'c.png', path: 'p3', hash: 'y', dup: 'composer' },
        ]}
        onRemoveAttachment={vi.fn()}
      />,
    );
    expect(screen.getByText('já enviado')).toBeTruthy();
    expect(screen.getByText('repetido')).toBeTruthy();
  });
});
