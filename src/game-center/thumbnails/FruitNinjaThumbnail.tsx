import fruitNinjaCardPreview from '@/assets/fruit-ninja-card-preview.png'
import { cn } from '@/lib/utils'

export function FruitNinjaThumbnail({ className }: { className?: string }) {
  return (
    <img
      src={fruitNinjaCardPreview}
      alt=""
      className={cn('h-full w-full object-cover', className)}
      draggable={false}
    />
  )
}
