import * as THREE from 'three'

export function disposeObject3D(root: THREE.Object3D) {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose()
      const m = child.material
      if (Array.isArray(m)) m.forEach((x) => x.dispose())
      else m?.dispose()
    }
  })
}

function fruitBodyMaterial(hex: number) {
  const c = new THREE.Color(hex)
  return new THREE.MeshPhysicalMaterial({
    color: c,
    roughness: 0.22,
    metalness: 0.05,
    clearcoat: 0.55,
    clearcoatRoughness: 0.35,
    emissive: c.clone().multiplyScalar(0.06),
    emissiveIntensity: 1,
  })
}

/** Stylized fruit: glossy body + stem + leaf */
export function createFruitMesh(radius: number, fruitColor: number): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 22), fruitBodyMaterial(fruitColor))
  body.castShadow = true
  body.receiveShadow = true
  g.add(body)

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.08, radius * 0.12, radius * 0.35, 8),
    new THREE.MeshStandardMaterial({ color: 0x3d2914, roughness: 0.9, metalness: 0 }),
  )
  stem.position.y = radius * 0.92
  stem.castShadow = true
  g.add(stem)

  const leaf = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.35, 12),
    new THREE.MeshStandardMaterial({
      color: 0x2d6b3a,
      roughness: 0.65,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    }),
  )
  leaf.position.set(radius * 0.35, radius * 0.75, radius * 0.1)
  leaf.rotation.set(0.5, 0.4, 0.3)
  leaf.castShadow = true
  g.add(leaf)

  return g
}

/** Classic “bomb”: dark shell + fuse + ember */
export function createBombMesh(radius: number): THREE.Group {
  const g = new THREE.Group()
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 28, 20),
    new THREE.MeshStandardMaterial({
      color: 0x1a1a1f,
      roughness: 0.35,
      metalness: 0.65,
      emissive: new THREE.Color(0x220011),
      emissiveIntensity: 0.25,
    }),
  )
  shell.castShadow = true
  shell.receiveShadow = true
  g.add(shell)

  const band = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.88, radius * 0.06, 10, 32),
    new THREE.MeshStandardMaterial({ color: 0x2a2a32, metalness: 0.8, roughness: 0.4 }),
  )
  band.rotation.x = Math.PI / 2
  band.castShadow = true
  g.add(band)

  const fuse = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.06, radius * 0.08, radius * 0.55, 8),
    new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.95 }),
  )
  fuse.position.y = radius * 1.05
  fuse.castShadow = true
  g.add(fuse)

  const ember = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.14, 12, 10),
    new THREE.MeshStandardMaterial({
      color: 0xffaa33,
      emissive: new THREE.Color(0xff6600),
      emissiveIntensity: 1.8,
      toneMapped: false,
    }),
  )
  ember.position.y = radius * 1.35
  g.add(ember)

  return g
}
