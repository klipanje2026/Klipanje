import { Children, isValidElement, type ReactNode } from 'react';
import { BillingSelect } from './BillingSelect';
import { StudioIcon } from '../StudioIcon/StudioIcon';

// Keep the existing report handlers and use the same accessible picker as the editor.
export function AdminSelect({label,value,disabled,children,onChange}:{label:string;value:string|number;disabled?:boolean;children:ReactNode;onChange:(event:{target:{value:string}})=>void}) {
  const options=Children.toArray(children).flatMap(child=>{
    if(!isValidElement<{value?:string|number;children:ReactNode}>(child))return [];
    const text=Children.toArray(child.props.children).join('');
    return [{value:String(child.props.value??text),label:text}];
  });
  const selected=options.find(option=>option.value===String(value));
  return <BillingSelect label={label} value={String(value)} disabled={disabled} options={options}
    icon={<span className="admin-select-value"><StudioIcon name="filters"/><span>{selected?.label||'Odaberi'}</span></span>}
    onChange={next=>onChange({target:{value:next}})}/>;
}
