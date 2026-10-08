export function confirmDelete(message: string): Promise<boolean> {
  if (document.querySelector(".edita-confirm-delete")) return Promise.resolve(false);
  return new Promise(resolve => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.createElement('dialog');
    dialog.className = 'edita-confirm-delete';
    const title = document.createElement('h2'); title.textContent = 'Želiš li obrisati?';
    const description = document.createElement('p'); description.textContent = message;
    const header = document.createElement('header');
    const close = document.createElement('button'); close.type = 'button'; close.className = 'delete-close'; close.setAttribute('aria-label', 'Zatvori');
    close.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg>';
    const actions = document.createElement('footer');
    const cancel = document.createElement('button'); cancel.textContent = 'Odustani'; cancel.autofocus = true;
    const confirm = document.createElement('button'); confirm.textContent = 'Obriši'; confirm.className = 'danger';
    const finish = (accepted: boolean) => { dialog.close(); dialog.remove(); previous?.focus(); resolve(accepted); };
    cancel.onclick = () => finish(false); confirm.onclick = () => finish(true);
    close.onclick = () => finish(false);
    dialog.oncancel = event => { event.preventDefault(); finish(false); };
    title.id = 'edita-delete-title'; dialog.setAttribute('aria-labelledby', title.id);
    description.id = 'edita-delete-description'; dialog.setAttribute('aria-describedby', description.id);
    header.append(title, close); actions.append(cancel, confirm); dialog.append(header, description, actions);
    document.body.append(dialog); dialog.showModal();
  });
}
