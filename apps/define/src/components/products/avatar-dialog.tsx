'use client';

import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ProductAvatar } from './product-avatar';
import { Loader2, Sparkles, Upload, Trash2 } from 'lucide-react';

interface AvatarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  productDescription?: string | null;
  currentAvatarUrl?: string | null;
  onAvatarChange: (avatarUrl: string | null) => void;
}

export function AvatarDialog({
  open,
  onOpenChange,
  productId,
  productName,
  productDescription,
  currentAvatarUrl,
  onAvatarChange,
}: AvatarDialogProps) {
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayUrl = previewUrl || currentAvatarUrl;

  async function generateAvatar() {
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/generate-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          productName,
          productDescription,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate avatar');
      }

      const data = await response.json();
      setPreviewUrl(data.avatarUrl);
      onAvatarChange(data.avatarUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate avatar');
    } finally {
      setGenerating(false);
    }
  }

  async function handleFileUpload(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Create FormData and upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('productId', productId);

      const response = await fetch('/api/upload-avatar', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload avatar');
      }

      const data = await response.json();
      setPreviewUrl(data.avatarUrl);
      onAvatarChange(data.avatarUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload avatar');
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    setError(null);

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: productName,
          avatarUrl: null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to remove avatar');
      }

      setPreviewUrl(null);
      onAvatarChange(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove avatar');
    }
  }

  function handleClose() {
    setPreviewUrl(null);
    setError(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Product Avatar</DialogTitle>
          <DialogDescription>
            Generate an AI avatar or upload a custom image for {productName}.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {/* Avatar Preview */}
          <div className="flex justify-center mb-6">
            <ProductAvatar
              name={productName}
              avatarUrl={displayUrl}
              size="lg"
              loading={generating || uploading}
              className="w-24 h-24"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={generateAvatar}
              disabled={generating || uploading}
              className="w-full"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {displayUrl ? 'Regenerate with AI' : 'Generate with AI'}
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={generating || uploading}
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload Custom Image
                </>
              )}
            </Button>

            {displayUrl && (
              <Button
                variant="ghost"
                onClick={removeAvatar}
                disabled={generating || uploading}
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Remove Avatar
              </Button>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleFileUpload(file);
              }
              e.target.value = '';
            }}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
