// ============================================================
// CrystalScene — 実3Dのクリスタル・ロータス (three.js)
//
// 参照: danielsnows「CRYSTAL LOTUS」— ガラスの花が開いていく動画。
// 「ほぼそのまま同じレベル」を目標に:
//   - MeshPhysicalMaterial (transmission / clearcoat / iridescence) の
//     本物のガラス花弁 × 環境反射 (RoomEnvironment)
//   - 花弁は3D曲面 (カール+カップ) を手続き生成
//   - マウント時に外輪→内輪へ本物の3D開花 (pivot回転・easeOutExpo)
//   - 状態反応: idle=ゆっくり回転+呼吸 / listening=さらに開く /
//               thinking=回転が速まる / speaking=芯の光が脈動
//   - WebGL不可なら null を返し、呼び出し側が SVG 版へフォールバック
// ============================================================
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export type CrystalState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface Props {
  state: CrystalState;
  accent: string;
}

// ─── 花弁の曲面ジオメトリ (カール=外反り, カップ=横断面の窪み) ───
function makePetalGeometry(length: number, width: number, curl: number, cup: number): THREE.BufferGeometry {
  const segU = 26, segV = 12;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // 中心線を先に積分 (曲げ角 θ(u) = curl * u^1.5)
  const spineY: number[] = [0];
  const spineZ: number[] = [0];
  for (let i = 1; i <= segU; i++) {
    const u = i / segU;
    const du = 1 / segU;
    const theta = curl * Math.pow(u, 1.5);
    spineY.push(spineY[i - 1] + Math.cos(theta) * du * length);
    spineZ.push(spineZ[i - 1] + Math.sin(theta) * du * length);
  }

  for (let i = 0; i <= segU; i++) {
    const u = i / segU;
    // 幅: 根元と先端が尖る
    const w = width * Math.pow(Math.sin(Math.PI * Math.min(Math.max(u, 0.02), 0.98)), 0.72);
    for (let j = 0; j <= segV; j++) {
      const v = j / segV;
      const x = (v - 0.5) * w;
      // カップ: 断面を放物線で窪ませる (中央が奥へ)
      const cupZ = cup * w * (1 - Math.pow((v - 0.5) * 2, 2)) * 0.5;
      positions.push(x, spineY[i], spineZ[i] + cupZ);
      uvs.push(v, u);
    }
  }
  for (let i = 0; i < segU; i++) {
    for (let j = 0; j < segV; j++) {
      const a = i * (segV + 1) + j;
      const b = a + segV + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// 決定的な微揺らぎ (花弁ごとの個体差)
function jitter(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) - 0.5;
}

interface Ring {
  count: number;
  target: number;      // 開ききった時の傾き (rad)
  stagger: number;     // 開花開始の遅れ (s)
  duration: number;    // 開花にかける時間 (s)
  pivots: THREE.Object3D[];
}

export default function CrystalScene({ state, accent }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<CrystalState>(state);
  stateRef.current = state;
  const accentRef = useRef(accent);
  accentRef.current = accent;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch {
      setFailed(true);
      return;
    }
    const reduceMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const isNarrow = host.clientWidth < 700;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isNarrow ? 1.6 : 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    // 背景: ページと同系のスチールブルーのグラデ (ガラスの透過にも使われる)
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = 64; bgCanvas.height = 512;
    const bctx = bgCanvas.getContext('2d');
    if (bctx) {
      const g = bctx.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, '#5d7398');
      g.addColorStop(0.45, '#394866');
      g.addColorStop(1, '#1c2438');
      bctx.fillStyle = g;
      bctx.fillRect(0, 0, 64, 512);
    }
    const bgTex = new THREE.CanvasTexture(bgCanvas);
    bgTex.colorSpace = THREE.SRGBColorSpace;
    scene.background = bgTex;

    // 環境反射 (ガラスの命)
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.06).texture;

    const camera = new THREE.PerspectiveCamera(38, host.clientWidth / host.clientHeight, 0.1, 60);
    const frameCamera = () => {
      const aspect = Math.max(host.clientWidth, 1) / Math.max(host.clientHeight, 1);
      // 縦長 (スマホ) では引いて、花が横に見切れないように
      const dist = aspect >= 1 ? 8.6 : Math.min((8.6 / aspect) * 0.78, 13.5);
      camera.aspect = aspect;
      camera.position.set(0, 2.1 * (dist / 8.6), dist);
      camera.lookAt(0, -0.85, 0); // 花を画面のやや上に据える (下は字幕と入力のための余白)
      camera.updateProjectionMatrix();
    };
    frameCamera();

    // ライト: キー光 + 奥からのリム光 (花弁の縁を光らせる)
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3.5, 6, 4);
    scene.add(key);
    const rim = new THREE.PointLight(0x9fb9e6, 14, 30);
    rim.position.set(-2.5, -1.5, -5);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0x8fa5c8, 0.35));

    const flower = new THREE.Group();
    flower.position.y = 0.15;
    scene.add(flower);

    // ─── ガラス材質 ───
    const whiteGlass = new THREE.MeshPhysicalMaterial({
      color: 0xe8f0fa, metalness: 0, roughness: 0.06,
      transmission: 0.92, thickness: 0.55, ior: 1.45,
      clearcoat: 1, clearcoatRoughness: 0.08,
      iridescence: 0.22, iridescenceIOR: 1.3,
      attenuationColor: new THREE.Color(0xcfe0f5), attenuationDistance: 3,
      envMapIntensity: 1.5, side: THREE.DoubleSide,
      transparent: true,
    });
    const blueGlass = new THREE.MeshPhysicalMaterial({
      color: 0x27466e, metalness: 0, roughness: 0.05,
      transmission: 0.8, thickness: 0.9, ior: 1.5,
      clearcoat: 1, clearcoatRoughness: 0.06,
      attenuationColor: new THREE.Color(0x16304f), attenuationDistance: 1.6,
      envMapIntensity: 1.7, side: THREE.DoubleSide,
      transparent: true,
    });
    const brightGlass = whiteGlass.clone();
    brightGlass.color = new THREE.Color(0xf6fafe);
    brightGlass.transmission = 0.85;
    brightGlass.iridescence = 0.35;

    // ─── 花弁リング (外=濃紺の萼 → 白ガラス → 芯) ───
    const ringDefs = [
      { count: 8, len: 2.7, wid: 1.5, curl: 0.9, cup: 0.85, mat: blueGlass, target: 1.5, stagger: 0.2, duration: 1.9, lift: -0.12 },
      { count: 9, len: 2.45, wid: 1.25, curl: 0.75, cup: 0.9, mat: whiteGlass, target: 1.08, stagger: 0.62, duration: 1.7, lift: 0 },
      { count: 7, len: 2.0, wid: 1.05, curl: 0.6, cup: 0.95, mat: whiteGlass, target: 0.74, stagger: 1.05, duration: 1.5, lift: 0.06 },
      { count: 6, len: 1.5, wid: 0.85, curl: 0.5, cup: 1.0, mat: brightGlass, target: 0.42, stagger: 1.45, duration: 1.3, lift: 0.1 },
    ];
    const rings: Ring[] = [];
    const disposables: Array<{ dispose: () => void }> = [bgTex, whiteGlass, blueGlass, brightGlass];

    ringDefs.forEach((def, r) => {
      const geo = makePetalGeometry(def.len, def.wid, def.curl, def.cup);
      disposables.push(geo);
      const pivots: THREE.Object3D[] = [];
      for (let i = 0; i < def.count; i++) {
        const azimuth = new THREE.Group();
        azimuth.rotation.y = (i / def.count) * Math.PI * 2 + r * 0.35;
        const open = new THREE.Group();
        open.position.y = def.lift;
        open.rotation.x = 0.06 + jitter(r * 31 + i) * 0.02; // 蕾: ほぼ直立
        const mesh = new THREE.Mesh(geo, def.mat);
        open.add(mesh);
        azimuth.add(open);
        flower.add(azimuth);
        pivots.push(open);
      }
      rings.push({ count: def.count, target: def.target, stagger: def.stagger, duration: def.duration, pivots });
    });

    // ─── 芯: 金色の光 ───
    const coreGeo = new THREE.SphereGeometry(0.3, 32, 32);
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: 0xf3ddb0, emissive: new THREE.Color(accentRef.current || '#C9A96E'),
      emissiveIntensity: 1.4, roughness: 0.25, metalness: 0.1,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = 0.28;
    flower.add(core);
    disposables.push(coreGeo, coreMat);

    // 芯のまわりの光 (加算スプライト)
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = glowCanvas.height = 256;
    const gctx = glowCanvas.getContext('2d');
    if (gctx) {
      const rg = gctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      rg.addColorStop(0, 'rgba(255,244,214,0.9)');
      rg.addColorStop(0.35, 'rgba(240,222,176,0.35)');
      rg.addColorStop(1, 'rgba(240,222,176,0)');
      gctx.fillStyle = rg;
      gctx.fillRect(0, 0, 256, 256);
    }
    const glowTex = new THREE.CanvasTexture(glowCanvas);
    const glowMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.setScalar(2.4);
    glow.position.y = 0.3;
    flower.add(glow);
    disposables.push(glowTex, glowMat);

    // ─── アニメーションループ ───
    const easeOutExpo = (p: number) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
    const clock = new THREE.Clock();
    let raf = 0;
    let spin = 0;
    let listenBoost = 0;
    let prevT = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = clock.getElapsedTime();
      const dt = Math.min(Math.max(t - prevT, 0.001), 0.05);
      prevT = t;
      const st = stateRef.current;

      // 開花 + 状態で開き具合を足す
      const targetBoost = st === 'listening' ? 0.16 : st === 'speaking' ? 0.06 : 0;
      listenBoost += (targetBoost - listenBoost) * 0.06;
      for (const ring of rings) {
        for (let i = 0; i < ring.pivots.length; i++) {
          const p = Math.min(Math.max((t - ring.stagger - i * 0.045) / ring.duration, 0), 1);
          const open = 0.06 + (ring.target - 0.06) * easeOutExpo(p) + listenBoost * ring.target * 0.35;
          ring.pivots[i].rotation.x = open + jitter(i * 7.3) * 0.03;
        }
      }

      // 回転: idle=そよぐ / thinking=考えるように速く
      const spinTarget = reduceMotion ? 0 : st === 'thinking' ? 0.55 : 0.07;
      spin += (spinTarget - spin) * 0.04;
      flower.rotation.y += spin * dt * 3.2;

      // 呼吸
      const breathe = reduceMotion ? 1 : 1 + Math.sin(t * 0.9) * 0.012;
      flower.scale.setScalar(breathe);

      // 芯の脈動 (speaking)
      const pulse = st === 'speaking' ? 1 + Math.sin(t * 6) * 0.28 : 1;
      glow.scale.setScalar(2.4 * pulse);
      coreMat.emissiveIntensity = st === 'speaking' ? 1.9 + Math.sin(t * 6) * 0.5 : st === 'listening' ? 1.8 : 1.4;

      renderer.render(scene, camera);
    };
    tick();

    // リサイズ追従
    const onResize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      frameCamera();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(host);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      disposables.forEach(d => d.dispose());
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (failed) return null;
  return <div ref={hostRef} aria-hidden style={{ position: 'absolute', inset: 0 }} />;
}
