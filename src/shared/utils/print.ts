/**
 * Open the browser print dialog ("Save as PDF" on every platform). Before
 * printing it loads lazy images (photos below the fold would otherwise print
 * blank), waiting up to `imageTimeoutMs`. Printing always uses the light theme:
 * dark-mode text would print light-on-white once the browser drops background
 * colours. Layout chrome is hidden with Tailwind's `print:` variants.
 */
export async function printPage(imageTimeoutMs = 4000): Promise<void> {
  const lazy = Array.from(document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]'));
  for (const img of lazy) img.loading = 'eager';
  const pending = Array.from(document.images).filter((img) => !img.complete);
  if (pending.length > 0) {
    await Promise.race([
      Promise.all(
        pending.map(
          (img) =>
            new Promise<void>((resolve) => {
              img.addEventListener('load', () => resolve(), { once: true });
              img.addEventListener('error', () => resolve(), { once: true });
            })
        )
      ),
      new Promise<void>((resolve) => setTimeout(resolve, imageTimeoutMs)),
    ]);
  }

  const root = document.documentElement;
  const wasDark = root.classList.contains('dark');
  if (wasDark) root.classList.remove('dark');
  const restore = () => {
    if (wasDark) root.classList.add('dark');
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  window.print();
}
