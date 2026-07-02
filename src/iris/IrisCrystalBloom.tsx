// ============================================================
// IrisCrystalBloom — Iris ブランドロゴ「6弁の花」の実3Dクリスタル
//
// 参照: src/prism/concierge/CrystalScene.tsx (ガラスの花の実装パターン)
// ロゴに忠実に:
//   - 外輪6弁 = 細長く尖った花弁。ホットピンク #E1306C →深紅のガラス
//     (MeshPhysicalMaterial transmission 高め + iridescence)
//   - 内輪6弁 = 30°オフセット・小さめ。オレンジ #F77737 〜ゴールド #FCB045 のガラス
//   - 中心 = ゴールドピンクの発光コア (やわらかく脈動)
//   - 背景 = 深いインクプラム #1A0A26 → #2E1038 → 上部にほんのりピンクの光
//   - マウント時に外輪→内輪の開花 (easeOutExpo)、常時ゆっくり回転+呼吸
//   - WebGL 不可なら null を返す (呼び出し側が CSS/SVG 版へフォールバック)
// ============================================================
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

interface Props {
  /** 指定すると relative なブロック要素として描画。未指定なら親に absolute で全面フィット */
  height?: string;
}

// ─── 花弁の曲面ジオメトリ (カール=外反り, カップ=横断面の窪み, tip=先端の尖り) ───
function makePetalGeometry(
  length: number, width: number, curl: number, cup: number, tip: number,
): THREE.BufferGeometry {
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
    // 幅: tip を上げるほど根元と先端が細く尖る (ロゴの細長い花弁)
    const w = width * Math.pow(Math.sin(Math.PI * Math.min(Math.max(u, 0.02), 0.98)), tip);
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
  target: number;   // 開ききった時の傾き (rad)
  stagger: number;  // 開花開始の遅れ (s)
  duration: number; // 開花にかける時間 (s)
  pivots: THREE.Object3D[];
}

export default function IrisCrystalBloom({ height }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
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

    // 背景: 深いインクプラム → 上部にほんのりピンクの光 (ガラスの透過にも使われる)
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = 64; bgCanvas.height = 512;
    const bctx = bgCanvas.getContext('2d');
    if (bctx) {
      const g = bctx.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, '#2E1038');
      g.addColorStop(0.55, '#221030');
      g.addColorStop(1, '#1A0A26');
      bctx.fillStyle = g;
      bctx.fillRect(0, 0, 64, 512);
      // 上部のピンクの光 (ほんのり)
      const glow = bctx.createRadialGradient(32, 60, 0, 32, 60, 240);
      glow.addColorStop(0, 'rgba(255,122,166,0.30)');
      glow.addColorStop(0.45, 'rgba(225,48,108,0.12)');
      glow.addColorStop(1, 'rgba(225,48,108,0)');
      bctx.fillStyle = glow;
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
      const dist = aspect >= 1 ? 8.4 : Math.min((8.4 / aspect) * 0.8, 14);
      camera.aspect = aspect;
      camera.position.set(0, 2.0 * (dist / 8.4), dist);
      camera.lookAt(0, -0.7, 0); // 花を画面のやや上に据える (下は見出しのための余白)
      camera.updateProjectionMatrix();
    };
    frameCamera();

    // ライト: キー光 + 紫のリム光 + ピンクのリム光 (ロゴのグラデ3色を光で再現)
    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(3.5, 6, 4);
    scene.add(key);
    const rimPurple = new THREE.PointLight(0xb07bd9, 13, 30); // #833AB4 系
    rimPurple.position.set(-2.5, -1.0, -5);
    scene.add(rimPurple);
    const rimPink = new THREE.PointLight(0xff7aa8, 8, 26);
    rimPink.position.set(3, -2, -4);
    scene.add(rimPink);
    scene.add(new THREE.AmbientLight(0x9a76b8, 0.35));

    const flower = new THREE.Group();
    flower.position.y = 0.15;
    scene.add(flower);

    // ─── ガラス材質 (ロゴのグラデに忠実) ───
    // 外輪: ホットピンク #E1306C → 深紅へ沈むガラス
    const pinkGlass = new THREE.MeshPhysicalMaterial({
      color: 0xe84a80, metalness: 0, roughness: 0.05,
      transmission: 0.92, thickness: 0.7, ior: 1.45,
      clearcoat: 1, clearcoatRoughness: 0.07,
      iridescence: 0.35, iridescenceIOR: 1.3,
      attenuationColor: new THREE.Color(0x8e1030), attenuationDistance: 1.5,
      envMapIntensity: 1.65, side: THREE.DoubleSide,
      transparent: true,
    });
    // 内輪: オレンジ #F77737 〜ゴールド #FCB045 のガラス
    const goldGlass = new THREE.MeshPhysicalMaterial({
      color: 0xfca24f, metalness: 0, roughness: 0.06,
      transmission: 0.88, thickness: 0.5, ior: 1.45,
      clearcoat: 1, clearcoatRoughness: 0.08,
      iridescence: 0.25, iridescenceIOR: 1.3,
      attenuationColor: new THREE.Color(0xe05a1e), attenuationDistance: 1.8,
      envMapIntensity: 1.6, side: THREE.DoubleSide,
      transparent: true,
    });

    // ─── 花弁リング: 外輪6弁 (細長く尖る) + 内輪6弁 (30°オフセット・小さめ) ───
    const ringDefs = [
      { count: 6, len: 2.9, wid: 1.0, curl: 0.82, cup: 0.8, tip: 1.45, mat: pinkGlass, target: 1.16, stagger: 0.15, duration: 1.9, lift: -0.08, offset: 0 },
      { count: 6, len: 1.85, wid: 0.82, curl: 0.58, cup: 0.92, tip: 1.15, mat: goldGlass, target: 0.74, stagger: 0.8, duration: 1.5, lift: 0.05, offset: Math.PI / 6 },
    ];
    const rings: Ring[] = [];
    const disposables: Array<{ dispose: () => void }> = [bgTex, pinkGlass, goldGlass];

    ringDefs.forEach((def, r) => {
      const geo = makePetalGeometry(def.len, def.wid, def.curl, def.cup, def.tip);
      disposables.push(geo);
      const pivots: THREE.Object3D[] = [];
      for (let i = 0; i < def.count; i++) {
        const azimuth = new THREE.Group();
        azimuth.rotation.y = (i / def.count) * Math.PI * 2 + def.offset;
        const open = new THREE.Group();
        open.position.y = def.lift;
        open.rotation.x = 0.06 + jitter(r * 31 + i) * 0.02; // 蕾: ほぼ直立
        const mesh = new THREE.Mesh(geo, def.mat);
        open.add(mesh);
        azimuth.add(open);
        flower.add(azimuth);
        pivots.push(open);
      }
      rings.push({ target: def.target, stagger: def.stagger, duration: def.duration, pivots });
    });

    // ─── 中心: ゴールドピンクの発光コア ───
    const coreGeo = new THREE.SphereGeometry(0.28, 32, 32);
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: 0xffe3c8, emissive: new THREE.Color('#FFAE78'),
      emissiveIntensity: 1.5, roughness: 0.25, metalness: 0.1,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = 0.26;
    flower.add(core);
    disposables.push(coreGeo, coreMat);

    // コアのまわりの光 (加算スプライト)
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = glowCanvas.height = 256;
    const gctx = glowCanvas.getContext('2d');
    if (gctx) {
      const rg = gctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      rg.addColorStop(0, 'rgba(255,226,205,0.95)');
      rg.addColorStop(0.35, 'rgba(255,158,142,0.4)');
      rg.addColorStop(1, 'rgba(255,158,142,0)');
      gctx.fillStyle = rg;
      gctx.fillRect(0, 0, 256, 256);
    }
    const glowTex = new THREE.CanvasTexture(glowCanvas);
    const glowMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.setScalar(2.3);
    glow.position.y = 0.28;
    flower.add(glow);
    disposables.push(glowTex, glowMat);

    // ─── アニメーションループ ───
    const easeOutExpo = (p: number) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
    const clock = new THREE.Clock();
    let raf = 0;
    let prevT = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = clock.getElapsedTime();
      const dt = Math.min(Math.max(t - prevT, 0.001), 0.05);
      prevT = t;

      // 開花: 外輪→内輪 (easeOutExpo, 花弁ごとに少しずつ遅れる)
      for (const ring of rings) {
        for (let i = 0; i < ring.pivots.length; i++) {
          const p = Math.min(Math.max((t - ring.stagger - i * 0.06) / ring.duration, 0), 1);
          const open = 0.06 + (ring.target - 0.06) * easeOutExpo(p);
          ring.pivots[i].rotation.x = open + jitter(i * 7.3) * 0.03;
        }
      }

      // 常時ゆっくり回転 + 呼吸
      if (!reduceMotion) {
        flower.rotation.y += dt * 0.22;
        flower.scale.setScalar(1 + Math.sin(t * 0.85) * 0.012);
      }

      // コアの光がやわらかく脈動
      const pulse = reduceMotion ? 0.5 : Math.sin(t * 1.5) * 0.5 + 0.5;
      coreMat.emissiveIntensity = 1.35 + pulse * 0.5;
      glow.scale.setScalar(2.3 * (1 + (pulse - 0.5) * 0.1));

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
  return (
    <div
      ref={hostRef}
      aria-hidden
      style={height
        ? { position: 'relative', width: '100%', height, overflow: 'hidden' }
        : { position: 'absolute', inset: 0 }}
    />
  );
}
