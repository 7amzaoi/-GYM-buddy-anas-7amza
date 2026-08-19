import * as THREE from 'three';
import { BRAND_ACCENT } from '../lib/personalization.js';
import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, extend, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, useGLTF, useTexture } from '@react-three/drei';
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  useRopeJoint,
  useSphericalJoint,
} from '@react-three/rapier';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';

extend({ MeshLineGeometry, MeshLineMaterial });

const CARD_GLB = '/card.glb';
const CARD_TEXTURE = '/membership-card.png';

// Pre-load assets so the suspense fallback only flashes once.
useGLTF.preload(CARD_GLB);
useTexture.preload(CARD_TEXTURE);

/* ============================================================
 *  Public component
 * ============================================================ */
export default function MembershipCard({
  position = [0, 0, 13],
  gravity = [0, -40, 0],
  fov = 25,
}) {
  return (
    <div className="lanyard-wrapper" aria-label="Interactive GymBuddy membership card">
      <AssetErrorBoundary>
        <Suspense fallback={<LanyardSkeleton />}>
          <Canvas
            camera={{ position, fov }}
            gl={{ alpha: true, antialias: true }}
            dpr={[1, 2]}
          >
            <ambientLight intensity={Math.PI} />
            <Physics interpolate gravity={gravity} timeStep={1 / 60}>
              <Band />
            </Physics>
            <Environment blur={0.75}>
              <Lightformer intensity={2} color="white" position={[0, -1, 5]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
              <Lightformer intensity={3} color="white" position={[-1, -1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
              <Lightformer intensity={3} color="white" position={[1,  1,  1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
              <Lightformer intensity={10} color="white" position={[-10, 0, 14]} rotation={[0, Math.PI / 2, Math.PI / 3]} scale={[100, 10, 1]} />
            </Environment>
          </Canvas>
        </Suspense>
      </AssetErrorBoundary>
    </div>
  );
}

/* ============================================================
 *  Band — rigid bodies, joints, mesh, and the dragging logic
 * ============================================================ */
function Band({ maxSpeed = 50, minSpeed = 0 }) {
  const band = useRef();
  const fixed = useRef();
  const j1 = useRef();
  const j2 = useRef();
  const j3 = useRef();
  const card = useRef();

  // Reusable scratch vectors so we don't allocate every frame
  const vec = useMemo(() => new THREE.Vector3(), []);
  const ang = useMemo(() => new THREE.Vector3(), []);
  const rot = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);

  const segmentProps = {
    type: 'dynamic',
    canSleep: true,
    colliders: false,
    angularDamping: 4,
    linearDamping: 4,
  };

  const { nodes, materials } = useGLTF(CARD_GLB);
  // Pre-designed PNG dropped in /public — single source of truth for the
  // card face. Replaces the older canvas-generated texture entirely.
  const cardImage = useTexture(CARD_TEXTURE);
  // Strap texture is generated in code — clean GymBuddy stripes,
  // no third-party logos baked in.
  const lanyardTexture = useMemo(() => buildStrapTexture(), []);
  useThree((s) => s.size); // subscribe to size for reactivity

  const [curve] = useState(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
      ])
  );
  const [dragged, drag] = useState(false);
  const [hovered, hover] = useState(false);
  const [isSmall, setIsSmall] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 1024
  );

  // Apply the designed PNG to the GLB's `base` material.
  //
  // The React Bits card.glb has its UVs split horizontally:
  //   • front face → U range [0.0, 0.5]   (left half of the texture)
  //   • back face  → U range [0.5, 1.0]   (right half of the texture)
  // A full-card design fed in as a single image therefore only renders
  // its left half on each face. Setting repeat.x = 2 stretches the
  // texture so each half of UV space samples the FULL image, and
  // RepeatWrapping makes the back face wrap cleanly around to 0..1.
  //
  // GLB UVs use bottom-up convention, so flipY also stays false.
  useEffect(() => {
    if (!materials?.base || !cardImage) return;
    cardImage.flipY = false;
    cardImage.colorSpace = THREE.SRGBColorSpace;
    cardImage.anisotropy = 16;
    cardImage.wrapS = THREE.RepeatWrapping;
    cardImage.wrapT = THREE.RepeatWrapping;
    cardImage.repeat.set(2, 1);
    cardImage.needsUpdate = true;
    materials.base.map = cardImage;
    materials.base.needsUpdate = true;
  }, [materials, cardImage]);

  // Rope joints + spherical joint that holds the card to the strap
  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1]);
  useSphericalJoint(j3, card, [[0, 0, 0], [0, 1.45, 0]]);

  // Cursor feedback when hovering / dragging
  useEffect(() => {
    if (!hovered) return undefined;
    document.body.style.cursor = dragged ? 'grabbing' : 'grab';
    return () => {
      document.body.style.cursor = 'auto';
    };
  }, [hovered, dragged]);

  useEffect(() => {
    const onResize = () => setIsSmall(window.innerWidth < 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useFrame((state, delta) => {
    if (dragged) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      [card, j1, j2, j3, fixed].forEach((r) => r.current?.wakeUp());
      card.current?.setNextKinematicTranslation({
        x: vec.x - dragged.x,
        y: vec.y - dragged.y,
        z: vec.z - dragged.z,
      });
    }
    if (fixed.current) {
      [j1, j2].forEach((ref) => {
        if (!ref.current.lerped) {
          ref.current.lerped = new THREE.Vector3().copy(ref.current.translation());
        }
        const clamped = Math.max(
          0.1,
          Math.min(1, ref.current.lerped.distanceTo(ref.current.translation()))
        );
        ref.current.lerped.lerp(
          ref.current.translation(),
          delta * (minSpeed + clamped * (maxSpeed - minSpeed))
        );
      });
      curve.points[0].copy(j3.current.translation());
      curve.points[1].copy(j2.current.lerped);
      curve.points[2].copy(j1.current.lerped);
      curve.points[3].copy(fixed.current.translation());
      band.current.geometry.setPoints(curve.getPoints(32));
      ang.copy(card.current.angvel());
      rot.copy(card.current.rotation());
      card.current.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z });
    }
  });

  curve.curveType = 'chordal';
  lanyardTexture.wrapS = lanyardTexture.wrapT = THREE.RepeatWrapping;

  return (
    <>
      <group position={[0, 4, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody position={[0.5, 0, 0]} ref={j1} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1, 0, 0]} ref={j2} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1.5, 0, 0]} ref={j3} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody
          position={[2, 0, 0]}
          ref={card}
          {...segmentProps}
          type={dragged ? 'kinematicPosition' : 'dynamic'}
        >
          <CuboidCollider args={[0.8, 1.125, 0.01]} />
          <group
            scale={2.25}
            position={[0, -1.2, -0.05]}
            onPointerOver={() => hover(true)}
            onPointerOut={() => hover(false)}
            onPointerUp={(e) => {
              e.target.releasePointerCapture(e.pointerId);
              drag(false);
            }}
            onPointerDown={(e) => {
              e.target.setPointerCapture(e.pointerId);
              drag(new THREE.Vector3().copy(e.point).sub(vec.copy(card.current.translation())));
            }}
          >
            <mesh geometry={nodes.card.geometry}>
              <meshPhysicalMaterial
                map={materials.base.map}
                map-anisotropy={16}
                clearcoat={1}
                clearcoatRoughness={0.15}
                roughness={0.85}
                metalness={0.4}
              />
            </mesh>
            <mesh geometry={nodes.clip.geometry} material={materials.metal} material-roughness={0.3} />
            <mesh geometry={nodes.clamp.geometry} material={materials.metal} />
          </group>
        </RigidBody>
      </group>

      <mesh ref={band}>
        <meshLineGeometry />
        <meshLineMaterial
          color={BRAND_ACCENT.hex}
          depthTest={false}
          resolution={isSmall ? [1000, 2000] : [1000, 1000]}
          useMap
          map={lanyardTexture}
          repeat={[-4, 1]}
          lineWidth={1}
        />
      </mesh>
    </>
  );
}

/* ============================================================
 *  Strap texture — clean GymBuddy stripes, no logos / wordmark
 * ============================================================ */
function buildStrapTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');

  // Dark base
  ctx.fillStyle = '#0B0B0B';
  ctx.fillRect(0, 0, 256, 32);

  // Three-stripe pattern: thin neon edge, dark middle, thin neon edge
  ctx.fillStyle = BRAND_ACCENT.hex;
  ctx.fillRect(0, 0, 256, 4);   // top edge
  ctx.fillRect(0, 28, 256, 4);  // bottom edge

  // Subtle inner highlight
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, 4, 256, 1);
  ctx.fillRect(0, 27, 256, 1);

  // Centered dotted accent for texture (no logo, just visual rhythm)
  ctx.fillStyle = `rgba(${BRAND_ACCENT.rgb}, 0.45)`;
  for (let x = 8; x < 256; x += 32) {
    ctx.fillRect(x, 14, 4, 4);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ============================================================
 *  Skeleton + error fallback
 * ============================================================ */
function LanyardSkeleton() {
  return (
    <div className="lanyard-skeleton">
      <div className="lanyard-skeleton-strap" />
      <div className="lanyard-skeleton-card">
        <div className="lanyard-skeleton-shimmer" />
      </div>
      <p>Loading membership card…</p>
    </div>
  );
}

class AssetErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, message: String(err?.message || err) };
  }
  componentDidCatch(err) {
    console.warn('[MembershipCard] failed to load 3D assets:', err);
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="lanyard-error">
        <strong>3D card couldn’t load.</strong>
        <span>
          Make sure <code>card.glb</code> and <code>membership-card.png</code> are in
          {' '}<code>public/</code>.
        </span>
      </div>
    );
  }
}
