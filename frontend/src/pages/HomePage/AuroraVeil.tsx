import { useEffect, useRef } from 'react';

/** The selected design-lab Aurora field, drawn once; CSS handles the gentle drift. */
export function AuroraVeil() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !context) return;
    const width = canvas.width;
    const height = canvas.height;
    const image = context.createImageData(width, height);
    const gaussian = (value: number, spread: number) => Math.exp(-value * value / spread);

    for (let row = 0; row < height; row++) {
      const y = row / height;
      for (let column = 0; column < width; column++) {
        const x = column / width;
        const edge = Math.pow(Math.abs(x - .5) * 2, 1.55);
        let glow = 0;
        for (let layer = 0; layer < 3; layer++) {
          const line = .12 + layer * .11 + .055 * Math.sin(y * 5 + .84 + layer * .8) + y * .18;
          glow += edge * gaussian(x - line, .0015 + layer * .001) * (.6 - layer * .1);
          glow += edge * gaussian(x - (1.18 - line), .003) * (.42 - layer * .07);
        }
        glow *= .45 + .55 * gaussian(y - .38, .16);
        const base = gaussian(x - .87, .12) * gaussian(y - .07, .2) * .196;
        const ice = glow * .1;
        const center = 1 - .35 * gaussian(x - .5, .03) * gaussian(y - .42, .025);
        const grain = (((column * 13 + row * 17) % 11) / 11 - .5) * 1.25;
        const pixel = (row * width + column) * 4;
        image.data[pixel] = 4 + (base * 4 + glow * 4 + ice * 76) * center + grain;
        image.data[pixel + 1] = 16 + (base * 72 + glow * 82 + ice * 105) * center + grain;
        image.data[pixel + 2] = 24 + (base * 86 + glow * 93 + ice * 112) * center + grain;
        image.data[pixel + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
  }, []);

  return <div className="home-aurora" aria-hidden="true">
    <canvas ref={canvasRef} width={840} height={390} />
  </div>;
}
