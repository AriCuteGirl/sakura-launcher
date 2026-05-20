import { useEffect, useRef } from "react";

interface Petal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotSpeed: number;
  size: number;
  opacity: number;
  drift: number;
  driftSpeed: number;
  driftOffset: number;
}

export default function PetalAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const petalsRef = useRef<Petal[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const PETAL_COUNT = 28;

    const createPetal = (fromTop = false): Petal => ({
      x: Math.random() * canvas.width,
      y: fromTop ? -20 : Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.6,
      vy: 0.4 + Math.random() * 0.8,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.04,
      size: 5 + Math.random() * 9,
      opacity: 0.3 + Math.random() * 0.5,
      drift: 1.2 + Math.random() * 1.5,
      driftSpeed: 0.005 + Math.random() * 0.01,
      driftOffset: Math.random() * Math.PI * 2,
    });

    petalsRef.current = Array.from({ length: PETAL_COUNT }, () => createPetal(false));

    function drawPetal(ctx: CanvasRenderingContext2D, p: Petal) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.opacity;

      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
      grad.addColorStop(0, "#ffb3d9");
      grad.addColorStop(0.5, "#ff6eb4");
      grad.addColorStop(1, "rgba(255,110,180,0)");

      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.ellipse(0, -p.size * 0.5, p.size * 0.45, p.size, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    let t = 0;
    function animate() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      t += 0.016;

      petalsRef.current.forEach((p, i) => {
        p.x += p.vx + Math.sin(t * p.driftSpeed + p.driftOffset) * p.drift * 0.04;
        p.y += p.vy;
        p.rotation += p.rotSpeed;

        if (p.y > canvas!.height + 30 || p.x < -30 || p.x > canvas!.width + 30) {
          petalsRef.current[i] = createPetal(true);
        } else {
          drawPetal(ctx!, p);
        }
      });

      rafRef.current = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
