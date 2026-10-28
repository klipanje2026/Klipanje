import { localTools } from '../lib/local-tools';
export function LocalToolLinks() { return <>{localTools.filter(tool => tool.label).map(tool => <a key={tool.path} href={tool.href || tool.path} target={tool.href ? '_blank' : undefined} rel={tool.href ? 'noopener noreferrer' : undefined}>{tool.label}</a>)}</>; }
