export type Product = {
  id: string
  title: string
  description: string
  price: number
  regularPrice?: number
  images: string[]
  category?: string 
  slug?: string;
}

export const PRODUCTS: Product[] = [ ]
