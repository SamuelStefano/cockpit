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

describe('AttachmentChips thumbnails', () => {
  it('requests a thumb for a local image and renders it once available', () => {
    const onThumb = vi.fn();
    const { rerender, container } = render(
      <AttachmentChips attachments={[{ name: 'shot.png', path: 'attachments/a/shot.png' }]} onRemoveAttachment={vi.fn()} onThumb={onThumb} />,
    );
    expect(onThumb).toHaveBeenCalledWith('attachments/a/shot.png');
    expect(container.querySelector('img')).toBeNull();
    URL.createObjectURL = vi.fn(() => 'blob:thumb');
    URL.revokeObjectURL = vi.fn();
    rerender(
      <AttachmentChips attachments={[{ name: 'shot.png', path: 'attachments/a/shot.png' }]} onRemoveAttachment={vi.fn()} onThumb={onThumb} thumbs={{ 'attachments/a/shot.png': 'AAAA' }} />,
    );
    expect(container.querySelector('img')?.getAttribute('src')).toBe('blob:thumb');
  });

  it('does not request a thumb while uploading or for non-images', () => {
    const onThumb = vi.fn();
    render(
      <AttachmentChips attachments={[{ name: 'a.png', path: 'p1', uploading: true }, { name: 'b.pdf', path: 'p2' }]} onRemoveAttachment={vi.fn()} onThumb={onThumb} />,
    );
    expect(onThumb).not.toHaveBeenCalled();
  });
});
