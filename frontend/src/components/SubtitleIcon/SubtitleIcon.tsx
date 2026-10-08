import type { ReactNode } from 'react';
type IconName =
  | "upload"
  | "play"
  | "sparkle"
  | "captions"
  | "check"
  | "arrow"
  | "download"
  | "back"
  | "plus"
  | "trash"
  | "split"
  | "merge";
export function SubtitleIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    upload: (
      <>
        <path d="M12 16V4m0 0L7 9m5-5 5 5" />
        <path d="M5 15v4h14v-4" />
      </>
    ),
    play: <path d="m9 7 8 5-8 5V7Z" />,
    sparkle: (
      <>
        <path d="m12 3 1.2 4.1L17 9l-3.8 1.9L12 15l-1.2-4.1L7 9l3.8-1.9L12 3Z" />
        <path d="m18.5 15 .6 2.1L21 18l-1.9.9-.6 2.1-.6-2.1L16 18l1.9-.9.6-2.1Z" />
      </>
    ),
    captions: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="M7 10h4m2 0h4M7 14h6m2 0h2" />
      </>
    ),
    check: <path d="m6 12 4 4 8-9" />,
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m14 7 5 5-5 5" />
      </>
    ),
    download: (
      <>
        <path d="M12 4v11m0 0 4-4m-4 4-4-4" />
        <path d="M5 19h14" />
      </>
    ),
    back: (
      <>
        <path d="M19 12H5" />
        <path d="m10 7-5 5 5 5" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    trash: (
      <>
        <path d="M5 7h14M9 7V4h6v3m-8 0 1 13h8l1-13" />
      </>
    ),
    split: (
      <>
        <circle cx="6" cy="7" r="2" />
        <circle cx="6" cy="17" r="2" />
        <path d="m8 8 10 7M8 16l10-7" />
      </>
    ),
    merge: (
      <>
        <path d="M5 7h5a4 4 0 0 1 4 4v6" />
        <path d="M5 17h5a4 4 0 0 0 4-4V7" />
        <path d="m11 10 3-3 3 3" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
