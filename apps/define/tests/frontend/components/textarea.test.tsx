import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Textarea } from '../../../frontend/src/components/ui/textarea';

describe('Textarea Component', () => {
  describe('rendering', () => {
    it('should render a textarea element', () => {
      render(<Textarea data-testid="textarea" />);
      expect(screen.getByTestId('textarea')).toBeInTheDocument();
      expect(screen.getByTestId('textarea').tagName).toBe('TEXTAREA');
    });

    it('should apply default styles', () => {
      render(<Textarea data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea.className).toContain('flex');
      expect(textarea.className).toContain('min-h-[80px]');
      expect(textarea.className).toContain('w-full');
      expect(textarea.className).toContain('rounded-md');
      expect(textarea.className).toContain('border');
      expect(textarea.className).toContain('border-gray-300');
      expect(textarea.className).toContain('bg-white');
      expect(textarea.className).toContain('px-3');
      expect(textarea.className).toContain('py-2');
      expect(textarea.className).toContain('text-sm');
    });

    it('should apply custom className', () => {
      render(<Textarea className="custom-textarea" data-testid="textarea" />);
      expect(screen.getByTestId('textarea')).toHaveClass('custom-textarea');
    });
  });

  describe('placeholder', () => {
    it('should render with placeholder', () => {
      render(<Textarea placeholder="Enter description..." />);
      expect(screen.getByPlaceholderText('Enter description...')).toBeInTheDocument();
    });

    it('should apply placeholder styles', () => {
      render(<Textarea placeholder="Enter text..." data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea.className).toContain('placeholder:text-gray-400');
    });
  });

  describe('rows', () => {
    it('should accept rows attribute', () => {
      render(<Textarea rows={5} data-testid="textarea" />);
      expect(screen.getByTestId('textarea')).toHaveAttribute('rows', '5');
    });

    it('should not have rows attribute by default', () => {
      render(<Textarea data-testid="textarea" />);
      // Textarea without explicit rows attribute won't have the attribute
      const textarea = screen.getByTestId('textarea');
      expect(textarea.getAttribute('rows')).toBeNull();
    });
  });

  describe('states', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<Textarea disabled data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea).toBeDisabled();
      expect(textarea.className).toContain('disabled:cursor-not-allowed');
      expect(textarea.className).toContain('disabled:opacity-50');
    });

    it('should apply focus styles', () => {
      render(<Textarea data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea.className).toContain('focus:outline-none');
      expect(textarea.className).toContain('focus:ring-2');
      expect(textarea.className).toContain('focus:ring-purple-500');
    });

    it('should be required when required prop is true', () => {
      render(<Textarea required data-testid="textarea" />);
      expect(screen.getByTestId('textarea')).toBeRequired();
    });

    it('should be readonly when readOnly prop is true', () => {
      render(<Textarea readOnly data-testid="textarea" />);
      expect(screen.getByTestId('textarea')).toHaveAttribute('readonly');
    });
  });

  describe('interactions', () => {
    it('should call onChange handler when value changes', () => {
      const handleChange = vi.fn();
      render(<Textarea onChange={handleChange} data-testid="textarea" />);

      fireEvent.change(screen.getByTestId('textarea'), { target: { value: 'test content' } });
      expect(handleChange).toHaveBeenCalledTimes(1);
    });

    it('should update value on change', () => {
      render(<Textarea data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea') as HTMLTextAreaElement;

      fireEvent.change(textarea, { target: { value: 'new content' } });
      expect(textarea.value).toBe('new content');
    });

    it('should call onFocus handler when focused', () => {
      const handleFocus = vi.fn();
      render(<Textarea onFocus={handleFocus} data-testid="textarea" />);

      fireEvent.focus(screen.getByTestId('textarea'));
      expect(handleFocus).toHaveBeenCalledTimes(1);
    });

    it('should call onBlur handler when blurred', () => {
      const handleBlur = vi.fn();
      render(<Textarea onBlur={handleBlur} data-testid="textarea" />);

      fireEvent.focus(screen.getByTestId('textarea'));
      fireEvent.blur(screen.getByTestId('textarea'));
      expect(handleBlur).toHaveBeenCalledTimes(1);
    });

    it('should handle multiline input', () => {
      render(<Textarea data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea') as HTMLTextAreaElement;

      const multilineContent = 'Line 1\nLine 2\nLine 3';
      fireEvent.change(textarea, { target: { value: multilineContent } });
      expect(textarea.value).toBe(multilineContent);
    });
  });

  describe('controlled vs uncontrolled', () => {
    it('should work as controlled component', () => {
      const { rerender } = render(<Textarea value="initial" onChange={() => {}} data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea') as HTMLTextAreaElement;

      expect(textarea.value).toBe('initial');

      rerender(<Textarea value="updated" onChange={() => {}} data-testid="textarea" />);
      expect(textarea.value).toBe('updated');
    });

    it('should work as uncontrolled component with defaultValue', () => {
      render(<Textarea defaultValue="default content" data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea') as HTMLTextAreaElement;

      expect(textarea.value).toBe('default content');
    });
  });

  describe('HTML attributes', () => {
    it('should pass through name attribute', () => {
      render(<Textarea name="description" data-testid="textarea" />);
      expect(screen.getByTestId('textarea')).toHaveAttribute('name', 'description');
    });

    it('should pass through id attribute', () => {
      render(<Textarea id="uniqueId" data-testid="textarea" />);
      expect(screen.getByTestId('textarea')).toHaveAttribute('id', 'uniqueId');
    });

    it('should pass through maxLength attribute', () => {
      render(<Textarea maxLength={500} data-testid="textarea" />);
      expect(screen.getByTestId('textarea')).toHaveAttribute('maxLength', '500');
    });

    it('should pass through aria attributes', () => {
      render(<Textarea aria-label="Description field" aria-describedby="desc" data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea).toHaveAttribute('aria-label', 'Description field');
      expect(textarea).toHaveAttribute('aria-describedby', 'desc');
    });

    it('should forward ref correctly', () => {
      const ref = { current: null };
      render(<Textarea ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
    });
  });

  describe('use cases', () => {
    it('should work for requirement descriptions', () => {
      render(
        <Textarea
          placeholder="Users can..."
          rows={3}
          data-testid="textarea"
        />
      );

      const textarea = screen.getByTestId('textarea') as HTMLTextAreaElement;
      fireEvent.change(textarea, {
        target: { value: 'Users can view and manage their project requirements in a hierarchical tree structure.' },
      });

      expect(textarea.value).toContain('Users can');
    });

    it('should work for acceptance criteria', () => {
      render(
        <Textarea
          placeholder="• Criterion 1"
          rows={4}
          data-testid="textarea"
        />
      );

      const multilineCriteria = `• Users can create new requirements
• Users can edit existing requirements
• Users can delete requirements
• Changes are saved automatically`;

      const textarea = screen.getByTestId('textarea') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: multilineCriteria } });

      expect(textarea.value).toContain('• Users can create new requirements');
      expect(textarea.value.split('\n')).toHaveLength(4);
    });
  });
});
