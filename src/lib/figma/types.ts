export type FigmaNode = {
  id: string
  name: string
  type: string
  children?: FigmaNode[]
}

export type FigmaFileResponse = {
  name: string
  document: FigmaNode
}

export type FigmaImagesResponse = {
  err: string | null
  images: Record<string, string | null>
}

export type SelectableScreen = {
  id: string
  name: string
  type: string
}
