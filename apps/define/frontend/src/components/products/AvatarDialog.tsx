import { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ProductAvatar } from './ProductAvatar'
import { avatarsApi, Product } from '@/api/client'
import { Sparkles, Upload, Trash2, Loader2 } from 'lucide-react'

interface AvatarDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product
  onAvatarChange: (avatarUrl: string | null) => void
}

export function AvatarDialog({
  open,
  onOpenChange,
  product,
  onAvatarChange,
}: AvatarDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)
    try {
      const result = await avatarsApi.generate(
        product.id,
        product.name,
        product.description
      )
      onAvatarChange(result.avatar_url)
    } catch (err: unknown) {
      // Extract error detail from API response if available
      const axiosError = err as { response?: { data?: { detail?: string } } }
      const detail = axiosError.response?.data?.detail
      setError(detail || (err instanceof Error ? err.message : 'Failed to generate avatar'))
    } finally {
      setIsGenerating(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setError(null)
    try {
      const result = await avatarsApi.upload(product.id, file)
      onAvatarChange(result.avatar_url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload avatar')
    } finally {
      setIsUploading(false)
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemove = async () => {
    if (!product.avatar_url) return

    setIsRemoving(true)
    setError(null)
    try {
      await avatarsApi.remove(product.id)
      onAvatarChange(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove avatar')
    } finally {
      setIsRemoving(false)
    }
  }

  const isLoading = isGenerating || isUploading || isRemoving

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Product Avatar</DialogTitle>
          <DialogDescription>
            Generate an AI avatar or upload a custom image for {product.name}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          <ProductAvatar
            name={product.name}
            avatarUrl={product.avatar_url}
            size="lg"
            loading={isLoading}
            className="w-24 h-24 text-2xl"
          />

          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md w-full text-center">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3 w-full">
            <Button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate with AI
                </>
              )}
            </Button>

            <div className="relative">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Custom Image
                  </>
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={handleUpload}
                className="hidden"
              />
            </div>

            {product.avatar_url && (
              <Button
                variant="outline"
                onClick={handleRemove}
                disabled={isLoading}
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                {isRemoving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove Avatar
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
