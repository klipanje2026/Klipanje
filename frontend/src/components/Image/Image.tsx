import type { ImgHTMLAttributes } from 'react';
type Props = ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean };
export default function Image({ priority, alt, ...props }: Props) {
  return <img alt={alt ?? ''} loading={priority ? 'eager' : 'lazy'} decoding="async" {...props} />;
}
