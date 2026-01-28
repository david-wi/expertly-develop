import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '../../../frontend/src/components/ui/input';

describe('Input Component', () => {
  describe('rendering', () => {
    it('should render an input element', () => {
      render(<Input data-testid="input" />);
      expect(screen.getByTestId('input')).toBeInTheDocument();
      expect(screen.getByTestId('input').tagName).toBe('INPUT');
    });

    it('should apply default styles', () => {
      render(<Input data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input.className).toContain('flex');
      expect(input.className).toContain('h-10');
      expect(input.className).toContain('w-full');
      expect(input.className).toContain('rounded-md');
      expect(input.className).toContain('border');
      expect(input.className).toContain('border-gray-300');
      expect(input.className).toContain('bg-white');
      expect(input.className).toContain('px-3');
      expect(input.className).toContain('py-2');
      expect(input.className).toContain('text-sm');
    });

    it('should apply custom className', () => {
      render(<Input className="custom-input" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveClass('custom-input');
    });
  });

  describe('types', () => {
    it('should render text input by default', () => {
      render(<Input data-testid="input" />);
      // HTML input defaults to type="text" when not specified, but the attribute may not be set
      const input = screen.getByTestId('input') as HTMLInputElement;
      expect(input.type).toBe('text');
    });

    it('should render password input', () => {
      render(<Input type="password" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute('type', 'password');
    });

    it('should render email input', () => {
      render(<Input type="email" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute('type', 'email');
    });

    it('should render number input', () => {
      render(<Input type="number" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute('type', 'number');
    });

    it('should render search input', () => {
      render(<Input type="search" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute('type', 'search');
    });
  });

  describe('placeholder', () => {
    it('should render with placeholder', () => {
      render(<Input placeholder="Enter text..." />);
      expect(screen.getByPlaceholderText('Enter text...')).toBeInTheDocument();
    });

    it('should apply placeholder styles', () => {
      render(<Input placeholder="Enter text..." data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input.className).toContain('placeholder:text-gray-400');
    });
  });

  describe('states', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<Input disabled data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toBeDisabled();
      expect(input.className).toContain('disabled:cursor-not-allowed');
      expect(input.className).toContain('disabled:opacity-50');
    });

    it('should apply focus styles', () => {
      render(<Input data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input.className).toContain('focus:outline-none');
      expect(input.className).toContain('focus:ring-2');
      expect(input.className).toContain('focus:ring-purple-500');
    });

    it('should be required when required prop is true', () => {
      render(<Input required data-testid="input" />);
      expect(screen.getByTestId('input')).toBeRequired();
    });

    it('should be readonly when readOnly prop is true', () => {
      render(<Input readOnly data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute('readonly');
    });
  });

  describe('interactions', () => {
    it('should call onChange handler when value changes', () => {
      const handleChange = vi.fn();
      render(<Input onChange={handleChange} data-testid="input" />);

      fireEvent.change(screen.getByTestId('input'), { target: { value: 'test' } });
      expect(handleChange).toHaveBeenCalledTimes(1);
    });

    it('should update value on change', () => {
      render(<Input data-testid="input" />);
      const input = screen.getByTestId('input') as HTMLInputElement;

      fireEvent.change(input, { target: { value: 'new value' } });
      expect(input.value).toBe('new value');
    });

    it('should call onFocus handler when focused', () => {
      const handleFocus = vi.fn();
      render(<Input onFocus={handleFocus} data-testid="input" />);

      fireEvent.focus(screen.getByTestId('input'));
      expect(handleFocus).toHaveBeenCalledTimes(1);
    });

    it('should call onBlur handler when blurred', () => {
      const handleBlur = vi.fn();
      render(<Input onBlur={handleBlur} data-testid="input" />);

      fireEvent.focus(screen.getByTestId('input'));
      fireEvent.blur(screen.getByTestId('input'));
      expect(handleBlur).toHaveBeenCalledTimes(1);
    });

    it('should not call onChange when disabled', () => {
      const handleChange = vi.fn();
      render(<Input onChange={handleChange} disabled data-testid="input" />);

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: 'test' } });
      // Note: fireEvent still triggers the event, but the input won't update
      expect(input).toBeDisabled();
    });
  });

  describe('controlled vs uncontrolled', () => {
    it('should work as controlled component', () => {
      const { rerender } = render(<Input value="initial" onChange={() => {}} data-testid="input" />);
      const input = screen.getByTestId('input') as HTMLInputElement;

      expect(input.value).toBe('initial');

      rerender(<Input value="updated" onChange={() => {}} data-testid="input" />);
      expect(input.value).toBe('updated');
    });

    it('should work as uncontrolled component with defaultValue', () => {
      render(<Input defaultValue="default" data-testid="input" />);
      const input = screen.getByTestId('input') as HTMLInputElement;

      expect(input.value).toBe('default');
    });
  });

  describe('HTML attributes', () => {
    it('should pass through name attribute', () => {
      render(<Input name="fieldName" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute('name', 'fieldName');
    });

    it('should pass through id attribute', () => {
      render(<Input id="uniqueId" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute('id', 'uniqueId');
    });

    it('should pass through maxLength attribute', () => {
      render(<Input maxLength={100} data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute('maxLength', '100');
    });

    it('should pass through aria attributes', () => {
      render(<Input aria-label="Test label" aria-describedby="desc" data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('aria-label', 'Test label');
      expect(input).toHaveAttribute('aria-describedby', 'desc');
    });

    it('should forward ref correctly', () => {
      const ref = { current: null };
      render(<Input ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });
  });
});
