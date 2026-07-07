'use client';

/**
 * CKEditor 5 rich-text editor (loaded client-side only).
 *
 * Features: headings, font family/size/colour, bold/italic/underline/strike,
 * lists, links, tables, block quotes, code + code blocks, image upload with
 * drag & drop (routed through our backend), media embed, alignment, indent,
 * horizontal line, source editing, auto-save, and a full-screen toggle.
 * GeneralHtmlSupport keeps the output clean, SEO-friendly HTML.
 */

import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import {
  ClassicEditor,
  Essentials,
  Paragraph,
  Heading,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Subscript,
  Superscript,
  FontSize,
  FontFamily,
  FontColor,
  FontBackgroundColor,
  Link,
  AutoLink,
  List,
  ListProperties,
  BlockQuote,
  CodeBlock,
  Table,
  TableToolbar,
  TableProperties,
  TableCellProperties,
  TableColumnResize,
  Image,
  ImageToolbar,
  ImageCaption,
  ImageStyle,
  ImageResize,
  ImageUpload,
  ImageInsert,
  AutoImage,
  MediaEmbed,
  Autoformat,
  Alignment,
  Indent,
  IndentBlock,
  HorizontalLine,
  SourceEditing,
  GeneralHtmlSupport,
  RemoveFormat,
  Autosave,
  PasteFromOffice,
  WordCount,
  type EditorConfig,
} from 'ckeditor5';
import 'ckeditor5/ckeditor5.css';
import { adminApi } from '@/lib/admin.api';
import { cn } from '@/lib/utils';

/** Custom upload adapter: sends dropped/inserted images to our CMS upload endpoint. */
function UploadAdapterPlugin(editor: any) {
  editor.plugins.get('FileRepository').createUploadAdapter = (loader: any) => ({
    upload: async () => {
      const file: File = await loader.file;
      const { url } = await adminApi.cmsUploadImage(file);
      return { default: url };
    },
    abort: () => {},
  });
}

const TOOLBAR = [
  'undo', 'redo', '|',
  'sourceEditing', '|',
  'heading', '|',
  'fontFamily', 'fontSize', 'fontColor', 'fontBackgroundColor', '|',
  'bold', 'italic', 'underline', 'strikethrough', 'code', 'removeFormat', '|',
  'link', 'insertImage', 'mediaEmbed', 'insertTable', 'blockQuote', 'codeBlock', 'horizontalLine', '|',
  'alignment', 'bulletedList', 'numberedList', 'outdent', 'indent',
];

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  /** Called (debounced by CKEditor) when auto-save should persist the draft. */
  onAutoSave?: (html: string) => void | Promise<void>;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, onAutoSave, placeholder }: RichTextEditorProps) {
  const [ready, setReady] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [words, setWords] = useState(0);
  const latest = useRef(value);
  latest.current = value;

  // Lock body scroll while in full-screen.
  useEffect(() => {
    if (!fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setFullscreen(false);
    window.addEventListener('keydown', onEsc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onEsc);
    };
  }, [fullscreen]);

  const config: EditorConfig = {
    licenseKey: 'GPL',
    plugins: [
      Essentials, Paragraph, Heading, Bold, Italic, Underline, Strikethrough, Code, Subscript, Superscript,
      FontSize, FontFamily, FontColor, FontBackgroundColor, Link, AutoLink, List, ListProperties, BlockQuote,
      CodeBlock, Table, TableToolbar, TableProperties, TableCellProperties, TableColumnResize, Image, ImageToolbar,
      ImageCaption, ImageStyle, ImageResize, ImageUpload, ImageInsert, AutoImage, MediaEmbed, Autoformat, Alignment,
      Indent, IndentBlock, HorizontalLine, SourceEditing, GeneralHtmlSupport, RemoveFormat, PasteFromOffice, WordCount,
      ...(onAutoSave ? [Autosave] : []),
    ],
    extraPlugins: [UploadAdapterPlugin],
    toolbar: { items: TOOLBAR, shouldNotGroupWhenFull: false },
    heading: {
      options: [
        { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
        { model: 'heading1', view: 'h1', title: 'Heading 1', class: 'ck-heading_heading1' },
        { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
        { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' },
        { model: 'heading4', view: 'h4', title: 'Heading 4', class: 'ck-heading_heading4' },
      ],
    },
    image: {
      toolbar: ['imageTextAlternative', 'toggleImageCaption', '|', 'imageStyle:inline', 'imageStyle:block', 'imageStyle:side', '|', 'resizeImage'],
    },
    table: { contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells', 'tableProperties', 'tableCellProperties'] },
    mediaEmbed: { previewsInData: true },
    // Keep clean, SEO-friendly HTML but allow common tags/attributes through.
    htmlSupport: {
      allow: [
        { name: /^(p|h[1-6]|ul|ol|li|a|strong|em|u|s|code|pre|blockquote|figure|figcaption|img|table|thead|tbody|tr|td|th|hr|span|div|iframe)$/, attributes: true, classes: true, styles: true },
      ],
    },
    link: { defaultProtocol: 'https://', addTargetToExternalLinks: true },
    placeholder: placeholder || 'Write your content…',
    ...(onAutoSave
      ? { autosave: { waitingTime: 1500, save: async () => { await onAutoSave(latest.current); } } }
      : {}),
  };

  const editorEl = (
    <div className={cn('rte-wrap', fullscreen && 'rte-fullscreen')}>
      <div className="flex items-center justify-between gap-2 rounded-t-xl border border-b-0 border-border bg-muted/40 px-2 py-1">
        <span className="pl-1 text-xs text-muted-foreground">{words} words</span>
        <button
          type="button"
          onClick={() => setFullscreen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition hover:bg-background hover:text-foreground"
        >
          {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          {fullscreen ? 'Exit full screen' : 'Full screen'}
        </button>
      </div>
      {!ready && <div className="skeleton h-64 rounded-b-xl" />}
      <div className={cn(!ready && 'hidden')}>
        <CKEditor
          editor={ClassicEditor}
          config={config}
          data={value}
          onReady={(editor) => {
            setReady(true);
            const wc = editor.plugins.get('WordCount');
            wc.on('update', (_evt: any, stats: any) => setWords(stats.words));
          }}
          onChange={(_e, editor) => onChange(editor.getData())}
        />
      </div>
    </div>
  );

  return (
    <>
      {fullscreen ? <div className="fixed inset-0 z-[100] overflow-auto bg-background p-4 sm:p-8">{editorEl}</div> : editorEl}
      <RteStyles />
    </>
  );
}

/** Scoped CKEditor theme tweaks to blend with the app (incl. dark mode). */
function RteStyles() {
  return (
    <style jsx global>{`
      .rte-wrap .ck.ck-editor__main > .ck-editor__editable {
        min-height: 320px;
        border-bottom-left-radius: 0.75rem;
        border-bottom-right-radius: 0.75rem;
      }
      .rte-fullscreen .ck.ck-editor__main > .ck-editor__editable { min-height: calc(100vh - 160px); }
      .rte-wrap .ck.ck-toolbar { border-top-left-radius: 0; border-top-right-radius: 0; }
      html.dark .rte-wrap .ck.ck-editor__main > .ck-editor__editable {
        background: hsl(var(--card));
        color: hsl(var(--foreground));
      }
      html.dark .rte-wrap .ck.ck-toolbar,
      html.dark .rte-wrap .ck.ck-toolbar .ck-button,
      html.dark .rte-wrap .ck.ck-reset_all,
      html.dark .rte-wrap .ck-source-editing-area textarea {
        --ck-color-toolbar-background: hsl(var(--muted));
        --ck-color-toolbar-border: hsl(var(--border));
        --ck-color-base-border: hsl(var(--border));
        --ck-color-text: hsl(var(--foreground));
        --ck-color-button-default-hover-background: hsl(var(--accent) / 0.15);
        --ck-color-panel-background: hsl(var(--card));
        --ck-color-panel-border: hsl(var(--border));
        --ck-color-dropdown-panel-background: hsl(var(--card));
        --ck-color-input-background: hsl(var(--background));
        --ck-color-input-text: hsl(var(--foreground));
        color: hsl(var(--foreground));
      }
      html.dark .rte-wrap .ck-source-editing-area textarea {
        background: hsl(var(--card));
        color: hsl(var(--foreground));
      }
    `}</style>
  );
}

export default RichTextEditor;
