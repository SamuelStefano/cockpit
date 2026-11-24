// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CodeEditor } from './CodeEditor';

describe('CodeEditor', () => {
  it('its textarea has an accessible name', () => {
    const { getByLabelText } = render(<CodeEditor value="const a = 1" onChange={() => {}} mode="react" />);
    expect(getByLabelText('Editor de código').tagName).toBe('TEXTAREA');
  });
});
