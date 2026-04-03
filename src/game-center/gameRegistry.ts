import { createElement, type ReactNode } from 'react'

import { FruitNinjaThumbnail } from './thumbnails/FruitNinjaThumbnail'
import { Tank90Thumbnail } from './thumbnails/Tank90Thumbnail'

export type GameDescriptor = {
  id: 'tank90' | 'fruit-ninja'
  title: string
  cardLabel: string
  route: string
  description?: string
  thumbnail: ReactNode
}

export const games: GameDescriptor[] = [
  {
    id: 'tank90',
    title: '90 TANK BATTLE',
    cardLabel: '90 Tank Battle',
    route: '/games/tank90',
    description: 'Arcade tank combat',
    thumbnail: createElement(Tank90Thumbnail, { className: 'h-full w-full' }),
  },
  {
    id: 'fruit-ninja',
    title: 'FRUIT NINJA',
    cardLabel: 'Fruit Ninja',
    route: '/games/fruit-ninja',
    description: 'Dojo slicing — fruit, combos, bombs & lives',
    thumbnail: createElement(FruitNinjaThumbnail, { className: 'h-full w-full' }),
  },
]

