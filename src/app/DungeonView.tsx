import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { FloorData } from '../sim';

/** First-person view of one labyrinth floor. Draws what the simulator says; holds no rules. */

export interface ViewMarker {
  kind: 'elite' | 'statue' | 'boss';
  x: number;
  y: number;
}

interface Props {
  floor: FloorData;
  floorId: string;
  x: number;
  y: number;
  facing: number;
  openGates: string[];
  markers: ViewMarker[];
  dimmed: boolean;
}

const CELL = 2;
const WALL_HEIGHT = 2.3;
const EYE = 1.05;
const FOG = 0x07090b;

function stoneTexture(base: string, mortar: string, bricks: boolean): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  // Fixed speckle so the texture is the same every time.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(${rand() > 0.5 ? '255,255,255' : '0,0,0'},${(rand() * 0.07).toFixed(3)})`;
    ctx.fillRect(rand() * size, rand() * size, 2 + rand() * 3, 2 + rand() * 3);
  }
  ctx.strokeStyle = mortar;
  ctx.lineWidth = 3;
  if (bricks) {
    for (let row = 0; row < 4; row++) {
      const y = row * 32;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
      for (let col = 0; col < 2; col++) {
        const x = col * 64 + (row % 2 === 0 ? 0 : 32);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 32);
        ctx.stroke();
      }
    }
  } else {
    ctx.strokeRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const yawFor = (facing: number) => -facing * (Math.PI / 2);

function buildFloor(floor: FloorData): THREE.Group {
  const group = new THREE.Group();
  const height = floor.grid.length;
  const width = floor.grid[0]?.length ?? 0;
  const isWall = (x: number, y: number) => (floor.grid[y]?.[x] ?? '#') === '#';

  const wallTexture = stoneTexture('#5d6670', '#262b31', true);
  const walls: [number, number][] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isWall(x, y)) continue;
      // Only walls that border walkable ground can ever be seen.
      const seen = [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => !isWall(x + dx, y + dy)));
      if (seen) walls.push([x, y]);
    }
  }
  const wallMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(CELL, WALL_HEIGHT, CELL),
    new THREE.MeshStandardMaterial({ map: wallTexture, roughness: 0.95 }),
    walls.length,
  );
  const matrix = new THREE.Matrix4();
  walls.forEach(([x, y], i) => wallMesh.setMatrixAt(i, matrix.makeTranslation(x * CELL, WALL_HEIGHT / 2, y * CELL)));
  group.add(wallMesh);

  const floorTexture = stoneTexture('#3b4148', '#1d2126', false);
  floorTexture.repeat.set(width, height);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(width * CELL, height * CELL), new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(((width - 1) * CELL) / 2, 0, ((height - 1) * CELL) / 2);
  group.add(ground);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(width * CELL, height * CELL), new THREE.MeshStandardMaterial({ color: 0x14171b, roughness: 1 }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(ground.position.x, WALL_HEIGHT, ground.position.z);
  group.add(ceiling);
  return group;
}

const glow = (color: number, intensity = 1.4) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.6 });

function buildMarkers(floor: FloorData, floorId: string, openGates: string[], markers: ViewMarker[], px: number, py: number): THREE.Group {
  const group = new THREE.Group();
  const at = (mesh: THREE.Object3D, x: number, y: number, h: number) => {
    mesh.position.set(x * CELL, h, y * CELL);
    group.add(mesh);
  };
  floor.grid.forEach((row, y) =>
    [...row].forEach((tile, x) => {
      // Anything standing upright is left out on the party's own tile, where it would fill the view.
      const underfoot = x === px && y === py;
      if (tile === '>' || tile === '<') {
        const down = tile === '>';
        at(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 1.5), glow(down ? 0x2f8f86 : 0x8fd9cc, 0.5)), x, y, 0.03);
        if (!underfoot) {
          const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 4), glow(down ? 0x2f8f86 : 0x8fd9cc, 0.9));
          if (down) arrow.rotation.x = Math.PI;
          at(arrow, x, y, 0.9);
        }
      } else if (tile === 'E') {
        // The way out: a ring of ward light set into the floor.
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 8, 40), glow(0x74c7b6, 0.7));
        ring.rotation.x = Math.PI / 2;
        at(ring, x, y, 0.05);
      } else if (tile === 'G') {
        if (!underfoot) at(new THREE.Mesh(new THREE.OctahedronGeometry(0.34), glow(0xd8a64a, 0.9)), x, y, 0.75);
        at(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 1 })), x, y, 0.15);
      } else if (tile === '~' && !underfoot) {
        const mist = new THREE.Mesh(new THREE.BoxGeometry(CELL, WALL_HEIGHT, CELL), new THREE.MeshBasicMaterial({ color: 0xcfd6e6, transparent: true, opacity: 0.16, depthWrite: false }));
        at(mist, x, y, WALL_HEIGHT / 2);
      } else if (tile === 'i') {
        // Frozen floor: a pale, glossy sheet laid over the stone.
        const ice = new THREE.Mesh(new THREE.PlaneGeometry(CELL, CELL), new THREE.MeshStandardMaterial({ color: 0xa9c7d8, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.55 }));
        ice.rotation.x = -Math.PI / 2;
        at(ice, x, y, 0.015);
      } else if (tile === 'w') {
        // A corridor under water: it can be seen into, not walked into.
        const water = new THREE.Mesh(new THREE.BoxGeometry(CELL, WALL_HEIGHT * 0.62, CELL), new THREE.MeshBasicMaterial({ color: 0x2c5f8a, transparent: true, opacity: 0.55, depthWrite: false }));
        at(water, x, y, (WALL_HEIGHT * 0.62) / 2);
      } else if (tile === '^') {
        // A pressure plate: easy to miss, impossible to mistake once seen.
        at(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 1.1), glow(0x8a2f29, 0.5)), x, y, 0.02);
      } else if (tile === 'K' && !underfoot) {
        at(new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.04, 8, 20), glow(0xd8a64a, 0.9)), x, y, 0.6);
      } else if (tile === '$' && !underfoot) {
        at(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.5), new THREE.MeshStandardMaterial({ color: 0x6b5a3a, emissive: 0xd8a64a, emissiveIntensity: 0.15, roughness: 0.8 })), x, y, 0.23);
      } else if (tile === 'C' && !underfoot) {
        at(new THREE.Mesh(new THREE.OctahedronGeometry(0.14), glow(0xf2b7cf, 1)), x, y, 0.5);
      } else if (tile === 'L' || (tile === '=' && !openGates.includes(`${floorId}:${x},${y}`))) {
        // A barred gate fills the corridor; the bars run across whichever way the corridor goes.
        const alongX = (floor.grid[y]?.[x - 1] ?? '#') !== '#';
        for (let i = -2; i <= 2; i++) {
          const barMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, WALL_HEIGHT, 6), new THREE.MeshStandardMaterial({ color: 0x8a8f99, metalness: 0.6, roughness: 0.5 }));
          barMesh.position.set(x * CELL + (alongX ? 0 : i * 0.4), WALL_HEIGHT / 2, y * CELL + (alongX ? i * 0.4 : 0));
          group.add(barMesh);
        }
      }
    }),
  );
  for (const m of markers) {
    if (m.x === px && m.y === py) continue;
    if (m.kind === 'statue') {
      const stone = new THREE.MeshStandardMaterial({ color: 0xa3a8b0, roughness: 0.9 });
      at(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.1, 10), stone), m.x, m.y, 0.55);
      at(new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), stone), m.x, m.y, 1.28);
    } else if (m.kind === 'elite') {
      at(new THREE.Mesh(new THREE.IcosahedronGeometry(0.55), glow(0xcf5f55, 0.9)), m.x, m.y, 1.05);
    } else {
      at(new THREE.Mesh(new THREE.DodecahedronGeometry(0.8), new THREE.MeshStandardMaterial({ color: 0x2a2d33, emissive: 0x7a2420, emissiveIntensity: 0.9, roughness: 0.7 })), m.x, m.y, 1.1);
    }
  }
  return group;
}

function dispose(object: THREE.Object3D): void {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const material of materials) {
      (material as THREE.MeshStandardMaterial).map?.dispose();
      material.dispose();
    }
  });
}

export function DungeonView({ floor, floorId, x, y, facing, openGates, markers, dimmed }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{ scene: THREE.Scene; statics: THREE.Group | null; dynamics: THREE.Group | null } | null>(null);
  const target = useRef({ x, y, yaw: yawFor(facing), snap: true });

  // Renderer, camera and frame loop: created once.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.style.display = 'block';
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(FOG);
    scene.fog = new THREE.FogExp2(FOG, 0.2);
    scene.add(new THREE.AmbientLight(0x8fa3b5, 0.55));
    const camera = new THREE.PerspectiveCamera(72, 16 / 10, 0.05, 60);
    camera.rotation.order = 'YXZ';
    const torch = new THREE.PointLight(0xffe2b8, 9, 11, 1.6);
    camera.add(torch);
    scene.add(camera);
    sceneRef.current = { scene, statics: null, dynamics: null };

    const resize = () => {
      const w = host.clientWidth;
      const h = Math.round((w * 10) / 16);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    let yaw = target.current.yaw;
    let last = performance.now();
    let frame = 0;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const goal = target.current;
      const k = goal.snap ? 1 : 1 - Math.exp(-dt * 14);
      goal.snap = false;
      camera.position.x += (goal.x * CELL - camera.position.x) * k;
      camera.position.z += (goal.y * CELL - camera.position.z) * k;
      camera.position.y = EYE;
      // Turn the short way round.
      let delta = (goal.yaw - yaw) % (Math.PI * 2);
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      yaw += delta * k;
      camera.rotation.y = yaw;
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      const held = sceneRef.current;
      if (held?.statics) dispose(held.statics);
      if (held?.dynamics) dispose(held.dynamics);
      sceneRef.current = null;
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  // Walls and ground: rebuilt when the floor changes.
  useEffect(() => {
    const held = sceneRef.current;
    if (!held) return;
    if (held.statics) {
      held.scene.remove(held.statics);
      dispose(held.statics);
    }
    held.statics = buildFloor(floor);
    held.scene.add(held.statics);
    target.current.snap = true;
  }, [floor]);

  // Things that change during play.
  const markerKey = markers.map((m) => `${m.kind}${m.x},${m.y}`).join('|');
  const gateKey = openGates.join('|');
  useEffect(() => {
    const held = sceneRef.current;
    if (!held) return;
    if (held.dynamics) {
      held.scene.remove(held.dynamics);
      dispose(held.dynamics);
    }
    held.dynamics = buildMarkers(floor, floorId, openGates, markers, x, y);
    held.scene.add(held.dynamics);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floor, floorId, markerKey, gateKey, x, y]);

  target.current.x = x;
  target.current.y = y;
  target.current.yaw = yawFor(facing);

  return <div ref={hostRef} className={`dungeon-view ${dimmed ? 'dimmed' : ''}`} />;
}
