export type ProjectWorkflow = 'images' | 'video';
export function ProjectWorkflowField({value,onChange}:{value:ProjectWorkflow;onChange:(value:ProjectWorkflow)=>void}) {
  return <label>Vrsta projekta<select value={value} onChange={e=>onChange(e.target.value==='images'?'images':'video')}>
    <option value="images">Slike</option><option value="video">Videi</option>
  </select></label>;
}
