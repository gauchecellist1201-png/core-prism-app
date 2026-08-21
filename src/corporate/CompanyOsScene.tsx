// ============================================================
// CompanyOsScene — AI COMPANY OS の図を「実3D」で描く（WebGL / three.js）
//
// 2026-08-21 オーナー指示:「この絵がしょぼい。3Dにして視覚効果を作って」
//
// 図が言いたいこと（見た目より先に、意味を決める）:
//   ・会社の中に点在する 9 つの業務が、
//   ・中心の CORE（AI COMPANY OS）へ、実際に「流れ込んでいる」
//   → だから線は飾りではなく、node → center へ光の粒が流れる。
//
// ブランド:
//   中心は CORE のロゴ（発光する核＋交差する2本の軌道）をそのまま立体にした。
//   色は既存の金×黒のまま。動きは 0.9s 以上のゆっくりした所作だけで、
//   ちかちかする演出はしない（既存サイトの所作に合わせる）。
//
// 文字は WebGL に焼かない:
//   日本語をテクスチャに描くと必ず眠くなるので、ラベルは HTML のまま
//   3D座標を毎フレーム投影して置く。奥のノードほど小さく薄くなるので、
//   文字はくっきりしたまま奥行きだけが出る。読み上げにもそのまま乗る。
//
// WebGL が無い環境では null を返す。呼び出し側が既存の SVG 図に戻す。
// ============================================================
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { COMPANY_OS_NODES } from './transformData';
import { FONT_DISPLAY, FONT_SERIF_JA, FONT_SANS } from './corpTheme';

const GOLD = 0xc9a96e;
const GOLD_LIGHT = 0xe7c987;

/** 軌道の半径（ワールド単位）。中心の核は半径 0.86。 */
const RING_R = 3.2;
/** 見下ろす角度。0 だと真横＝楕円が潰れて読めない。 */
const ELEVATION = (31 * Math.PI) / 180;
const FOV = 40;

interface Props {
  /** 'full' = 9業務＋中心 / 'core' = 中心の核だけ（狭い画面用） */
  variant?: 'full' | 'core';
  /** WebGL が使えなかったとき。呼び出し側が SVG 版へ戻すために使う。 */
  onUnavailable?: () => void;
}

/** 光のにじみ（スプライト用の放射グラデーション）。 */
function makeGlowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.22, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.13)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 核の輪郭だけを光らせる（フレネル）。面は黒いまま、縁に金が乗る。 */
function makeRimMaterial(color: number, intensity: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
    },
    vertexShader: `
      varying vec3 vNormalW;
      varying vec3 vToEye;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormalW = normalize(normalMatrix * normal);
        vToEye = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uIntensity;
      varying vec3 vNormalW;
      varying vec3 vToEye;
      void main() {
        float f = pow(1.0 - max(dot(normalize(vNormalW), normalize(vToEye)), 0.0), 2.6);
        gl_FragColor = vec4(uColor, f * uIntensity);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

export default function CompanyOsScene({ variant = 'full', onUnavailable }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const centerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const failRef = useRef(onUnavailable);

  // 下のシーン本体より先に走らせる（失敗通知の宛先を確定させてから作る）
  useEffect(() => {
    failRef.current = onUnavailable;
  }, [onUnavailable]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      failRef.current?.();
      return;
    }

    const full = variant === 'full';
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);

    const disposables: { dispose(): void }[] = [];
    const glowTex = makeGlowTexture();
    disposables.push(glowTex);

    const track = <T extends { dispose(): void }>(x: T): T => {
      disposables.push(x);
      return x;
    };

    // ── 中心の核（CORE のロゴを立体にしたもの） ────────────────
    const core = new THREE.Group();
    scene.add(core);

    // 黒曜石の球。奥のワイヤーを隠すために不透明にしてある。
    core.add(new THREE.Mesh(
      track(new THREE.SphereGeometry(0.86, 48, 32)),
      track(new THREE.MeshBasicMaterial({ color: 0x060505 })),
    ));
    // 縁の金
    core.add(new THREE.Mesh(
      track(new THREE.SphereGeometry(0.88, 48, 32)),
      track(makeRimMaterial(GOLD_LIGHT, 1.15)),
    ));
    // 内側の骨格（ゆっくり逆回転する）
    const lattice = new THREE.Mesh(
      track(new THREE.IcosahedronGeometry(0.99, 1)),
      track(new THREE.MeshBasicMaterial({
        color: GOLD, wireframe: true, transparent: true, opacity: 0.22,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })),
    );
    core.add(lattice);

    // ロゴの「交差する2本の軌道」
    const orbits = new THREE.Group();
    const orbitGeo = track(new THREE.TorusGeometry(1.42, 0.009, 8, 160));
    const orbitMatA = track(new THREE.MeshBasicMaterial({
      color: GOLD_LIGHT, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    const orbitMatB = track(new THREE.MeshBasicMaterial({
      color: GOLD, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    const orbitA = new THREE.Mesh(orbitGeo, orbitMatA);
    orbitA.rotation.set(Math.PI / 2, 0, 0);
    orbitA.rotateX((-24 * Math.PI) / 180);
    const orbitB = new THREE.Mesh(orbitGeo, orbitMatB);
    orbitB.rotation.set(Math.PI / 2, 0, 0);
    orbitB.rotateX((34 * Math.PI) / 180);
    orbitB.rotateZ((62 * Math.PI) / 180);
    orbits.add(orbitA, orbitB);
    core.add(orbits);

    // 核のにじみ
    const coreGlowMat = track(new THREE.SpriteMaterial({
      map: glowTex, color: GOLD_LIGHT, transparent: true, opacity: 0.42,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    const coreGlow = new THREE.Sprite(coreGlowMat);
    coreGlow.scale.setScalar(full ? 6.4 : 4.6);
    scene.add(coreGlow);

    // ── 9つの業務（'full' のときだけ） ────────────────────────
    const orbit = new THREE.Group();
    scene.add(orbit);

    const nodeCount = COMPANY_OS_NODES.length;
    const nodePos: THREE.Vector3[] = [];
    const pulses: THREE.Sprite[] = [];

    if (full) {
      for (let i = 0; i < nodeCount; i++) {
        const a = (Math.PI * 2 * i) / nodeCount - Math.PI / 2;
        nodePos.push(new THREE.Vector3(Math.cos(a) * RING_R, 0, Math.sin(a) * RING_R));
      }

      // 業務が乗っている軌道
      const ring = new THREE.Mesh(
        track(new THREE.TorusGeometry(RING_R, 0.006, 6, 200)),
        track(new THREE.MeshBasicMaterial({
          color: GOLD, transparent: true, opacity: 0.26, blending: THREE.AdditiveBlending, depthWrite: false,
        })),
      );
      ring.rotation.x = Math.PI / 2;
      orbit.add(ring);

      // 業務 → 中心 の線。中心側ほど明るい（流れ込む向きが色で分かる）
      const pos = new Float32Array(nodeCount * 6);
      const col = new Float32Array(nodeCount * 6);
      const far = new THREE.Color(GOLD).multiplyScalar(0.16);
      const near = new THREE.Color(GOLD_LIGHT).multiplyScalar(0.8);
      for (let i = 0; i < nodeCount; i++) {
        const p = nodePos[i];
        pos.set([p.x, p.y, p.z, 0, 0, 0], i * 6);
        col.set([far.r, far.g, far.b, near.r, near.g, near.b], i * 6);
      }
      const lineGeo = track(new THREE.BufferGeometry());
      lineGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      lineGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      orbit.add(new THREE.LineSegments(lineGeo, track(new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      }))));

      // 各業務の足元の光と、中心へ流れる粒
      const haloMat = track(new THREE.SpriteMaterial({
        map: glowTex, color: GOLD_LIGHT, transparent: true, opacity: 0.34,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      const pulseMat = track(new THREE.SpriteMaterial({
        map: glowTex, color: 0xf7ead0, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      for (let i = 0; i < nodeCount; i++) {
        const halo = new THREE.Sprite(haloMat);
        halo.position.copy(nodePos[i]);
        halo.scale.setScalar(1.15);
        orbit.add(halo);

        const pulse = new THREE.Sprite(pulseMat.clone());
        disposables.push(pulse.material);
        pulse.scale.setScalar(0.34);
        orbit.add(pulse);
        pulses.push(pulse);
      }
    }

    // ── 画面に合わせて寄り引きを決める ────────────────────────
    // 見下ろしている図なので、手前のノードは遠近で大きく外へ出る。
    // 計算で近似すると必ず下が切れるので、実際に投影して収まるまで詰める。
    const fitSamples: THREE.Vector3[] = full
      ? nodePos
      : [1.62, -1.62].flatMap(v => [
        new THREE.Vector3(v, 0, 0), new THREE.Vector3(0, v, 0), new THREE.Vector3(0, 0, v),
      ]);
    const probe = new THREE.Vector3();

    const TAN_Y = Math.tan((FOV * Math.PI) / 360);
    /** 画面に合わせて決めた見下ろし距離。ラベルの大小もこれを基準にする。 */
    let fitDist = 8;

    /** 距離 d で見下ろし、高さ off だけ上下に振る（振ると図が上下に動く）。 */
    const setCam = (d: number, off: number) => {
      camera.position.set(0, Math.sin(ELEVATION) * d + off, Math.cos(ELEVATION) * d);
      camera.lookAt(0, off, 0);
      camera.updateProjectionMatrix();
    };

    const frame = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;

      // ラベルの半分（横 92px / 縦 40px）を余白として空ける
      const marginX = full ? 92 : 10;
      const marginY = full ? 40 : 10;
      const availX = Math.max(w / 2 - marginX, 40) / (w / 2);
      const availY = Math.max(h / 2 - marginY, 30) / (h / 2);

      let d = full ? 8 : 6;
      let off = 0;
      for (let i = 0; i < 12; i++) {
        setCam(d, off);
        let mx = 0;
        let yMin = Infinity;
        let yMax = -Infinity;
        for (const p of fitSamples) {
          probe.copy(p).project(camera);
          mx = Math.max(mx, Math.abs(probe.x));
          yMin = Math.min(yMin, probe.y);
          yMax = Math.max(yMax, probe.y);
        }
        const k = Math.max(mx / availX, (yMax - yMin) / 2 / availY);
        if (!Number.isFinite(k) || k <= 0) break;
        // 上下の中央に置き直す（手前のノードだけ遠近で下へ伸びるため、
        // 単純に中心を合わせると上に大きな空きができる）
        off += ((yMax + yMin) / 2) * TAN_Y * d;
        d = Math.min(Math.max(d * k, 2.6), 40);
        if (Math.abs(k - 1) < 0.004) break;
      }
      fitDist = d * 1.02;
      setCam(fitDist, off);
      renderer.setSize(w, h, false);
    };
    frame();

    // ── マウスに合わせてほんの少しだけ向きを変える（奥行きの実感） ──
    let mx = 0;
    let my = 0;
    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      my = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    const onLeave = () => {
      mx = 0;
      my = 0;
    };
    if (!reduceMotion) {
      host.addEventListener('pointermove', onMove);
      host.addEventListener('pointerleave', onLeave);
    }

    // ── ラベルの投影 ──────────────────────────────────────
    const world = new THREE.Vector3();
    const projected = new THREE.Vector3();
    const ORIGIN = new THREE.Vector3(0, 0, 0);

    const placeLabel = (el: HTMLDivElement | null, p: THREE.Vector3, isCenter: boolean) => {
      if (!el) return;
      world.copy(p);
      orbit.localToWorld(world);
      const dist = camera.position.distanceTo(world);
      projected.copy(world).project(camera);
      const x = (projected.x * 0.5 + 0.5) * host.clientWidth;
      const y = (-projected.y * 0.5 + 0.5) * host.clientHeight;
      const s = isCenter ? 1 : Math.min(Math.max(fitDist / dist, 0.74), 1.18);
      // 奥ほど薄く。前後関係は z-index でも合わせる。
      const depth = Math.min(Math.max((dist - (fitDist - RING_R)) / (RING_R * 2), 0), 1);
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${s.toFixed(3)})`;
      // 奥は薄くするが、読めなくなるまでは落とさない（本文と同じ濃さの下限を守る）
      el.style.opacity = isCenter ? '1' : (1 - depth * 0.32).toFixed(3);
      el.style.zIndex = String(100 - Math.round(depth * 90));
    };

    // ── 描画ループ（見えていない間は回さない） ──────────────
    const clock = new THREE.Clock();
    let raf = 0;
    let visible = true;
    let running = false;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      if (!reduceMotion) {
        orbit.rotation.y += dt * 0.075;           // 一周およそ 84 秒
        lattice.rotation.y -= dt * 0.12;
        lattice.rotation.x += dt * 0.04;
        orbits.rotation.y += dt * 0.16;
        core.rotation.x = my * -0.1;
        core.rotation.z = mx * 0.06;
        orbit.rotation.x = my * -0.08;
        orbit.rotation.z = mx * 0.05;
      }

      // 業務 → 中心 へ流れる光
      for (let i = 0; i < pulses.length; i++) {
        const cycle = 4.6;
        const p = reduceMotion ? 0.5 : ((t / cycle + i / pulses.length) % 1);
        const e = p * p;                            // 中心へ近づくほど速い
        pulses[i].position.copy(nodePos[i]).multiplyScalar(1 - e);
        const mat = pulses[i].material as THREE.SpriteMaterial;
        mat.opacity = reduceMotion ? 0.35 : Math.sin(Math.PI * p) * 0.85;
        pulses[i].scale.setScalar(0.2 + (1 - e) * 0.22);
      }

      // 核の呼吸
      const breathe = reduceMotion ? 0 : Math.sin(t * 0.7);
      coreGlowMat.opacity = 0.38 + breathe * 0.06;
      coreGlow.scale.setScalar((full ? 6.4 : 4.6) * (1 + breathe * 0.02));

      if (full) {
        for (let i = 0; i < nodeCount; i++) placeLabel(labelRefs.current[i], nodePos[i], false);
      }
      placeLabel(centerRef.current, ORIGIN, true);

      renderer.render(scene, camera);
      if (reduceMotion) {
        // 動かさない設定では 1 枚描いて止める
        cancelAnimationFrame(raf);
        running = false;
      }
    };

    const start = () => {
      if (running) return;
      running = true;
      clock.getDelta();
      tick();
    };
    const stop = () => {
      if (!running) return;
      cancelAnimationFrame(raf);
      running = false;
    };

    const io = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) start();
      else stop();
    }, { rootMargin: '120px' });
    io.observe(host);
    start();
    // 1枚目を描いてから文字を出す（左上に固まったラベルが一瞬映らないように）
    if (layerRef.current) layerRef.current.style.opacity = '1';

    const ro = new ResizeObserver(() => {
      frame();
      if (!running && visible) start();
      else if (reduceMotion) start();
    });
    ro.observe(host);

    const onLost = (e: Event) => {
      e.preventDefault();
      stop();
      failRef.current?.();
    };
    renderer.domElement.addEventListener('webglcontextlost', onLost);

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      renderer.domElement.removeEventListener('webglcontextlost', onLost);
      disposables.forEach(d => d.dispose());
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
    };
  }, [variant]);

  const full = variant === 'full';

  return (
    <div
      ref={hostRef}
      className={full ? 'corp-os3d corp-os3d-full' : 'corp-os3d corp-os3d-core'}
      role="img"
      aria-label="営業・顧客管理・問い合わせ・会議・タスク・契約・請求・マーケティング・経営分析が、中心の CORE（AI COMPANY OS）につながる立体の図"
    >
      {/* ラベルは HTML のまま。3D座標を毎フレーム投影して置く */}
      <div ref={layerRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0, transition: 'opacity 0.6s ease' }}>
        {full && COMPANY_OS_NODES.map((n, i) => (
          <div
            key={n.label}
            ref={el => { labelRefs.current[i] = el; }}
            className="corp-os3d-pill"
          >
            <span style={{
              fontFamily: FONT_SERIF_JA, fontSize: '0.95rem', fontWeight: 600,
              color: '#F1E6CE', letterSpacing: '0.06em', lineHeight: 1.4,
            }}>
              {n.label}
            </span>
            <span style={{
              fontFamily: FONT_SANS, fontSize: '0.64rem', color: 'rgba(240,233,216,0.7)',
              letterSpacing: '0.04em', lineHeight: 1.4,
            }}>
              {n.sub}
            </span>
          </div>
        ))}

        <div ref={centerRef} className="corp-os3d-center">
          <span style={{
            fontFamily: FONT_DISPLAY, fontSize: full ? '1.5rem' : '1.15rem', fontWeight: 700,
            letterSpacing: '0.26em', color: '#F5EAD4', paddingLeft: '0.26em', lineHeight: 1.2,
          }}>
            CORE
          </span>
          <span style={{
            fontFamily: FONT_DISPLAY, fontSize: full ? '0.6rem' : '0.55rem', fontWeight: 600,
            letterSpacing: '0.28em', color: 'rgba(201,169,110,0.92)', paddingLeft: '0.28em', marginTop: 6,
          }}>
            AI COMPANY OS
          </span>
        </div>
      </div>
    </div>
  );
}
