'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { cn } from '@/lib/utils/cn';
import { getEditorContent, isRichTextJson, isContentEmpty } from '@/lib/utils/rich-text';

interface RichTextViewerProps {
  content: string | null | undefined;
  className?: string;
  emptyText?: string;
}

export function RichTextViewer({ content, className, emptyText = 'Not defined yet.' }: RichTextViewerProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Image.configure({
        inline: false,
      }),
      Link.configure({
        openOnClick: true,
        autolink: false,
      }),
    ],
    content: getEditorContent(content),
    editable: false,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm max-w-none',
          '[&_p]:my-1 [&_ul]:my-2 [&_ol]:my-2 [&_h2]:my-3 [&_h3]:my-2',
          '[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6',
          '[&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-medium',
          '[&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-2',
          '[&_a]:text-primary-600 [&_a]:underline'
        ),
      },
    },
  });

  // Handle empty content
  if (isContentEmpty(content)) {
    return <p className={cn('text-gray-500', className)}>{emptyText}</p>;
  }

  // For plain text content (not JSON), render as simple text with whitespace preserved
  if (!isRichTextJson(content)) {
    return (
      <div className={cn('text-gray-600 whitespace-pre-wrap', className)}>
        {content}
      </div>
    );
  }

  // Render rich text content
  if (!editor) {
    return null;
  }

  return (
    <div className={cn('text-gray-600', className)}>
      <EditorContent editor={editor} />
    </div>
  );
}
