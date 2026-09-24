// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { FlowEditor } from './FlowEditor';

afterEach(cleanup);

const flow = { id: 'flow-1', from: 's:a', to: 's:b', template: '{{result}}', enabled: true, createdAt: 0, fires: 0 };

describe('FlowEditor delete', () => {
  it('asks for a second tap before deleting the flow', () => {
    const onDelete = vi.fn();
    const { getByText } = render(<FlowEditor flow={flow} isNew={false} node={() => undefined} onSave={vi.fn()} onDelete={onDelete} onClose={vi.fn()} />);
    fireEvent.click(getByText('excluir'));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(getByText('confirmar?'));
    expect(onDelete).toHaveBeenCalledWith('flow-1');
  });
});
