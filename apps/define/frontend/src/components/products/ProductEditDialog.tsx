import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { productsApi, Product } from '@/api/client'
import { Loader2 } from 'lucide-react'
import { InlineVoiceTranscription } from '@expertly/ui'

interface ProductEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product
  onProductUpdate: (product: Product) => void
}

export function ProductEditDialog({
  open,
  onOpenChange,
  product,
  onProductUpdate,
}: ProductEditDialogProps) {
  const [name, setName] = useState(product.name)
  const [description, setDescription] = useState(product.description || '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName(product.name)
      setDescription(product.description || '')
      setError(null)
    }
  }, [open, product])

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const updated = await productsApi.update(product.id, {
        name: name.trim(),
        description: description.trim() || null,
      })
      onProductUpdate(updated)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update product')
    } finally {
      setIsSaving(false)
    }
  }

  const hasChanges = name !== product.name || description !== (product.description || '')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>
            Update the name and description for this project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Name
            </label>
            <div className="flex gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Project name"
                className="flex-1"
              />
              <InlineVoiceTranscription
                wsUrl="wss://identity-api.ai.devintensive.com/ws/transcribe"
                onTranscribe={(text) => setName(name ? name + ' ' + text : text)}
                size="md"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Description
            </label>
            <div className="flex gap-2">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this project..."
                rows={4}
                className="flex-1"
              />
              <InlineVoiceTranscription
                wsUrl="wss://identity-api.ai.devintensive.com/ws/transcribe"
                onTranscribe={(text) => setDescription(description ? description + ' ' + text : text)}
                size="md"
                className="self-start mt-1"
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges || !name.trim()}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
