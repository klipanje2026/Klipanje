import Link from "../Link/Link";
import Image from "../Image/Image";
import type { ReactNode } from 'react';

export function InnerShell({
  children,
}: {
  children: ReactNode;
}) {
  const home = '/';

  return (
    <>
      <header className="site-header">
        <div className="shell header-inner">
          <Link className="brand" href={home} aria-label="Gordon home">
            <Image src="/gordon-logo.png" alt="Gordon Digital Marketing" width={1000} height={211} priority />
          </Link>
          <div className="header-actions">
            <Link className="back-home" href={home}>
              ← Back to home
            </Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="site-footer">
        <div className="shell footer-inner">
          <Image src="/gordon-logo.png" alt="Gordon Digital Marketing" width={1000} height={211} />
          <p>© {new Date().getFullYear()} Gordon Digital Marketing</p>
          <div>
            <a href="https://www.instagram.com/gordonkast/">Instagram</a>
            <a href="mailto:info@gordondm.com">Email</a>
          </div>
        </div>
      </footer>
    </>
  );
}
