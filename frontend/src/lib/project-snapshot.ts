export type ProjectSnapshot = { data: Record<string, unknown>; files: { key: string; file: File }[] };
export async function collectLatestSnapshot(read: () => Promise<ProjectSnapshot>, upload: (source: ProjectSnapshot['files'][number]) => Promise<string>) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const snapshot = await read();
    const references = [];
    for (const source of snapshot.files) references.push({ key: source.key, id: await upload(source) });
    const latest = await read();
    if (latest.files.length === snapshot.files.length && latest.files.every(source => snapshot.files.some(item => item.key === source.key && item.file === source.file))) {
      return { version: 1, data: latest.data, files: references };
    }
  }
  throw new Error('Mediji se još mijenjaju. Sačekaj da se učitaju pa ponovo spremi projekat.');
}
