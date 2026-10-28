import type { ComponentType } from 'react';
export type LocalTool = { path: string; label?: string; href?: string; Component?: ComponentType };
// Optional local additions are absent from the shared repository.
const modules = import.meta.glob<{ tools: LocalTool[] }>('../local-tools/register.ts', { eager: true });
export const localTools = Object.values(modules).flatMap(module => module.tools);
