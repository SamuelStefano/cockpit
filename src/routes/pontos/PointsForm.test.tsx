// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { PointsForm } from './PointsForm';

afterEach(cleanup);

describe('PointsForm', () => {
  it('accepts a comma decimal ("2,5") as typed in pt-BR', () => {
    const onAdd = vi.fn();
    const { getByPlaceholderText, container } = render(<PointsForm onAdd={onAdd} onCancel={vi.fn()} />);
    const inputs = container.querySelectorAll('input');
    fireEvent.change(inputs[0], { target: { value: 'Review' } });
    fireEvent.change(getByPlaceholderText('pt'), { target: { value: '2,5' } });
    fireEvent.keyDown(inputs[0], { key: 'Enter', ctrlKey: true });
    expect(onAdd).toHaveBeenCalledWith('Review', 2.5, undefined);
  });
});
