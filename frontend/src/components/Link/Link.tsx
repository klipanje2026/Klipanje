import type { AnchorHTMLAttributes } from 'react';
import { Link as RouterLink } from 'react-router-dom';
export default function Link({ href = '/', ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return /^(https?:|mailto:|tel:|#)/.test(href)
    ? <a href={href} {...props} /> : <RouterLink to={href} {...props} />;
}
