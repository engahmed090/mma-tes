import * as THREE from 'three';
import { isJuice, type Sample } from './demo';

/** Runtime sample props and exploded poses only; no changes to source GLBs. */
export function createSampleRig(model: THREE.Group, scene: THREE.Scene, portable: boolean) {
  model.updateMatrixWorld(true);
  const holder = model.getObjectByName(portable ? 'Mini sample | detachable loading cradle [web snapshot]' : 'Sample_Cartridge');
  const sensor = model.getObjectByName(portable ? 'Mini | metamaterial PCB [web snapshot]' : 'Metamaterial_Sensor');
  const group = new THREE.Group(); group.name = 'Illustrative liquid cartridge'; scene.add(group);
  const glass = new THREE.MeshPhysicalMaterial({ color: '#d8f5ff', transparent: true, opacity: .3, roughness: .15, side: THREE.DoubleSide, depthWrite: false });
  const liquidMaterial = new THREE.MeshStandardMaterial({ color: '#7f1020', roughness: .27 });
  const vessel = new THREE.Mesh(new THREE.CylinderGeometry(.008, .007, .012, 24, 1, true), glass);
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(.0068, .006, .008, 24), liquidMaterial);
  liquid.position.y = -.001; group.add(vessel, liquid);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(.0083, .0083, .0015, 24), new THREE.MeshStandardMaterial({ color: '#c3e3ed', transparent: true, opacity: .7 }));
  lid.position.y = .0065; group.add(lid);
  const parts: { node: THREE.Object3D; start: THREE.Vector3 }[] = [];
  if (portable) {
    model.traverse(node => {
      // Exact existing removable display/cover nodes, not invented electronics.
      if (/^Mini \| (bonded display module|optical screen|open display well border)/.test(node.name) || node.name.startsWith('R03 MINI UI |')) parts.push({ node, start: node.position.clone() });
    });
  }
  function top(node: THREE.Object3D | undefined) {
    if (!node) return new THREE.Vector3(0, .1, 0);
    const box = new THREE.Box3().setFromObject(node);
    const point = box.getCenter(new THREE.Vector3()); point.y = box.max.y + .008;
    return point;
  }
  let lift = 0;
  return {
    update(time: number, sample: Sample, opened: boolean, dt: number) {
      model.updateMatrixWorld(true);
      group.visible = sample !== 'Reference' && time >= 2;
      liquidMaterial.color.set(isJuice(sample) ? '#ff980a' : '#880e24');
      const origin = top(holder);
      if (portable) {
        const progress = THREE.MathUtils.smoothstep(time, 2, 5);
        group.position.copy(origin).lerp(top(sensor), progress);
      } else group.position.copy(origin);
      group.scale.setScalar(time < 2 ? 0 : THREE.MathUtils.smoothstep(time, 2, 2.7));
      const target = opened ? .055 : 0;
      lift = THREE.MathUtils.lerp(lift, target, 1 - Math.exp(-dt * 9));
      if (Math.abs(lift - target) < .00001) lift = target;
      parts.forEach(({ node, start }) => { node.position.copy(start); node.position.y += lift / model.scale.x; });
      return lift !== target;
    },
    reset() { lift = 0; group.visible = false; parts.forEach(({node,start}) => node.position.copy(start)); },
    dispose() {
      group.traverse(node => { if (node instanceof THREE.Mesh) { node.geometry.dispose(); (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => m.dispose()); } });
      group.removeFromParent();
    },
  };
}
