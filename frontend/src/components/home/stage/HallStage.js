
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

// BookMySeat — a persistent WebGL auditorium.
// No procedural stick figures. Humanoids load from /models/Xbot.glb.
// The cinema and door still render if the asset is missing.
export const SCREEN_ASPECT = 2.2;
const SCREEN = { w: 18, h: 18 / SCREEN_ASPECT, y: 4.35, z: -15 };
const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
const ease = (v) => { const t = clamp(v); return t * t * (3 - 2 * t); };
const rowZ = (row) => -4.5 + 2.15 * row;
const rowY = (row) => 0.46 * row;

export default class HallStage {
  constructor(container, { mobile = false, reduceMotion = false, onFrame, onLost } = {}) {
    this.container = container;
    this.mobile = mobile;
    this.reduceMotion = reduceMotion;
    this.onFrame = onFrame;
    this.onLost = onLost;
    this.active = true;
    this.disposed = false;
    this.progress = 0;
    this.elapsed = 0;
    this.pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    this.lastFrame = 0;
    this.lastDraw = 0;
    this.lastInteraction = 0;
    this.raf = 0;
    this.guests = [];
    this.geometry = [];
    this.material = [];
    this.width = 1;
    this.height = 1;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.38;
    this.renderer.setPixelRatio(1);
    this.canvas = this.renderer.domElement;
    this.canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.addEventListener("webglcontextlost", this.handleContextLoss, false);
    container.appendChild(this.canvas);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x08080c, 0.013);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 140);
    this.cameraPosition = new THREE.Vector3();
    this.cameraLook = new THREE.Vector3();
    this.startPos = new THREE.Vector3(0, 1.77, 27);
    this.startLook = new THREE.Vector3(0, 1.77, 16);
    this.homePos = new THREE.Vector3(-5.5, 6.6, 15.4);
    this.homeLook = new THREE.Vector3(0, 3, -11.5);
    this.screenPos = new THREE.Vector3();
    this.screenLook = new THREE.Vector3(0, SCREEN.y, SCREEN.z);
    this.tmp = new THREE.Vector3();
    this.projected = new THREE.Vector3();
    this.quad = Array.from({ length: 4 }, () => ({ x: 0, y: 0 }));
    this.corners = [
      new THREE.Vector3(-SCREEN.w / 2, SCREEN.y + SCREEN.h / 2, SCREEN.z),
      new THREE.Vector3(SCREEN.w / 2, SCREEN.y + SCREEN.h / 2, SCREEN.z),
      new THREE.Vector3(SCREEN.w / 2, SCREEN.y - SCREEN.h / 2, SCREEN.z),
      new THREE.Vector3(-SCREEN.w / 2, SCREEN.y - SCREEN.h / 2, SCREEN.z),
    ];

    this.buildRoom();
    this.buildDoors();
    this.setSize();
    if (!reduceMotion) this.loadGuests();
    this.invalidate();
  }

  handleContextLoss = (event) => {
    event.preventDefault();
    this.onLost?.();
  };

  geo(value) { this.geometry.push(value); return value; }
  mat(value) { this.material.push(value); return value; }

  addBox(parent, size, position, material, rotationY = 0) {
    const mesh = new THREE.Mesh(this.geo(new THREE.BoxGeometry(...size)), material);
    mesh.position.set(...position);
    mesh.rotation.y = rotationY;
    parent.add(mesh);
    return mesh;
  }

  buildRoom() {
    const wall = this.mat(new THREE.MeshStandardMaterial({ color: 0x1c1b21, roughness: 0.92 }));
    const velvet = this.mat(new THREE.MeshStandardMaterial({ color: 0x242129, roughness: 0.9 }));
    const leather = this.mat(new THREE.MeshStandardMaterial({ color: 0x42404a, roughness: 0.82 }));
    const cushion = this.mat(new THREE.MeshStandardMaterial({ color: 0x36343d, roughness: 0.9 }));
    const trim = this.mat(new THREE.MeshStandardMaterial({ color: 0x755a61, metalness: 0.35, roughness: 0.5 }));
    const illuminated = this.mat(new THREE.MeshBasicMaterial({ color: 0xffbeaa }));

    // Room enclosure and real cinema screen frame, not a floating rectangle.
    // Leave the projection itself transparent: HallScene projects DOM video
    // behind the canvas. Any WebGL mesh here would hide the real video.
    this.addBox(this.scene, [4.75, 13, 0.5], [-11.48, 5, SCREEN.z - 0.5], wall);
    this.addBox(this.scene, [4.75, 13, 0.5], [11.48, 5, SCREEN.z - 0.5], wall);
    this.addBox(this.scene, [22.8, 2.0, 0.5], [0, 9.65, SCREEN.z - 0.5], wall);
    this.addBox(this.scene, [SCREEN.w + 0.32, 0.16, 0.26], [0, SCREEN.y + SCREEN.h / 2 + 0.09, SCREEN.z + 0.05], trim);
    this.addBox(this.scene, [SCREEN.w + 0.32, 0.16, 0.26], [0, SCREEN.y - SCREEN.h / 2 - 0.09, SCREEN.z + 0.05], trim);
    this.addBox(this.scene, [0.16, SCREEN.h + 0.48, 0.26], [-SCREEN.w / 2 - 0.09, SCREEN.y, SCREEN.z + 0.05], trim);
    this.addBox(this.scene, [0.16, SCREEN.h + 0.48, 0.26], [SCREEN.w / 2 + 0.09, SCREEN.y, SCREEN.z + 0.05], trim);
    this.addBox(this.scene, [0.4, 12, 44], [-12.0, 5, 7], wall);
    this.addBox(this.scene, [0.4, 12, 44], [12.0, 5, 7], wall);

    // Step height corresponds exactly with each seating row's floor.
    const rows = this.mobile ? 5 : 6;
    const positions = [];
    for (let r = 0; r < rows; r += 1) {
      const y = rowY(r), z = rowZ(r);
      for (const side of [-1, 1]) {
        this.addBox(this.scene, [10.25, 0.35 + y, 2.17], [side * 5.95, (y - 0.35) / 2, z], wall);
        this.addBox(this.scene, [10.25, 0.07, 2.14], [side * 5.95, y - 0.06, z], velvet);
      }
      for (let col = -6; col <= 6; col += 1) {
        if (col === -1 || col === 0 || col === 1) continue;
        positions.push({ x: col * 1.16, y, z, row: r, side: Math.sign(col) });
      }
    }

    // Sloped central aisle: foot positions use this exact grade.
    const ramp = this.addBox(this.scene, [1.65, 0.17, 17], [0, 1.0, 3.0], velvet);
    ramp.rotation.x = -Math.atan2(rowY(5), rowZ(5) - rowZ(0));

    // Seats as instanced geometry: a handful of draw calls for the whole hall.
    const seatParts = [
      { geo: this.geo(new THREE.BoxGeometry(0.86, 0.91, 0.18)), mat: leather, x: 0, y: 1.04, z: 0.30 },
      { geo: this.geo(new THREE.BoxGeometry(0.84, 0.19, 0.73)), mat: cushion, x: 0, y: 0.56, z: -0.02 },
      { geo: this.geo(new THREE.BoxGeometry(0.11, 0.27, 0.78)), mat: leather, x: -0.48, y: 0.73, z: 0 },
      { geo: this.geo(new THREE.BoxGeometry(0.11, 0.27, 0.78)), mat: leather, x: 0.48, y: 0.73, z: 0 },
      { geo: this.geo(new THREE.BoxGeometry(0.72, 0.42, 0.65)), mat: velvet, x: 0, y: 0.22, z: 0.14 },
    ];
    const dummy = new THREE.Object3D();
    for (const part of seatParts) {
      const mesh = new THREE.InstancedMesh(part.geo, part.mat, positions.length);
      positions.forEach((seat, i) => {
        dummy.position.set(seat.x + part.x, seat.y + part.y, seat.z + part.z);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      this.scene.add(mesh);
    }
    this.seatPositions = positions;

    // Aisle and wall sconces — gentle warm light, no flashing.
    const markerGeo = this.geo(new THREE.BoxGeometry(0.16, 0.045, 0.32));
    const markers = new THREE.InstancedMesh(markerGeo, illuminated, rows * 2);
    for (let r = 0; r < rows; r += 1) {
      for (let side = 0; side < 2; side += 1) {
        dummy.position.set(side ? 0.88 : -0.88, rowY(r) + 0.05, rowZ(r));
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        markers.setMatrixAt(2 * r + side, dummy.matrix);
      }
    }
    markers.instanceMatrix.needsUpdate = true;
    this.scene.add(markers);

    this.ambient = new THREE.HemisphereLight(0xd8d1d6, 0x0b090e, 1.45);
    this.scene.add(this.ambient);
    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
    this.keyLight.position.set(-3, 10, 14);
    this.scene.add(this.keyLight);
    this.screenGlow = new THREE.PointLight(0xc2bccf, 80, 32, 2);
    this.screenGlow.position.set(0, 5.2, -11.5);
    this.scene.add(this.screenGlow);
    const rearLight = new THREE.PointLight(0xffc0af, 45, 25, 2);
    rearLight.position.set(0, 6, 13);
    this.scene.add(rearLight);
  }

  buildDoors() {
    const frame = this.mat(new THREE.MeshStandardMaterial({ color: 0x373036, roughness: 0.55, metalness: 0.24 }));
    const doorMat = this.mat(new THREE.MeshStandardMaterial({ color: 0x241e25, roughness: 0.62, metalness: 0.1 }));
    const accent = this.mat(new THREE.MeshStandardMaterial({ color: 0x98767a, metalness: 0.65, roughness: 0.3 }));
    const p = new THREE.Group();
    p.position.z = 20;
    this.scene.add(p);
    this.doors = p;
    this.addBox(p, [0.24, 4.3, 0.36], [-1.84, 2.15, 0], frame);
    this.addBox(p, [0.24, 4.3, 0.36], [1.84, 2.15, 0], frame);
    this.addBox(p, [3.85, 0.35, 0.4], [0, 4.16, 0], frame);
    this.addBox(p, [3.8, 0.08, 0.4], [0, 0.10, 0], accent);
    this.leftHinge = new THREE.Group();
    this.rightHinge = new THREE.Group();
    this.leftHinge.position.set(-1.70, 0, 0);
    this.rightHinge.position.set(1.70, 0, 0);
    p.add(this.leftHinge, this.rightHinge);
    for (const [hinge, sign] of [[this.leftHinge, 1], [this.rightHinge, -1]]) {
      const x = sign * 0.83;
      this.addBox(hinge, [1.64, 3.76, 0.16], [x, 2.10, 0], doorMat);
      this.addBox(hinge, [1.40, 3.48, 0.025], [x, 2.10, 0.10], frame);
      this.addBox(hinge, [1.23, 3.29, 0.025], [x, 2.10, 0.135], doorMat);
      this.addBox(hinge, [0.045, 0.51, 0.15], [sign * 1.48, 2.02, 0.22], accent);
      this.addBox(hinge, [0.18, 0.055, 0.11], [sign * 1.48, 2.23, 0.32], accent);
      this.addBox(hinge, [1.21, 0.04, 0.04], [x, 0.91, 0.162], accent);
    }
  }

  // Proper skinned mesh and walk clip, rather than procedurally animated limbs.
  async loadGuests() {
    try {
      const gltf = await new GLTFLoader().loadAsync(`${process.env.PUBLIC_URL || ""}/models/Xbot.glb`);
      if (this.disposed) return;
      const walk = gltf.animations.find((a) => /walk/i.test(a.name));
      const idle = gltf.animations.find((a) => /^idle$/i.test(a.name));
      const sharedBlack = this.mat(new THREE.MeshStandardMaterial({
        color: 0x111116, roughness: 0.96, metalness: 0.04, side: THREE.FrontSide,
      }));
      const destinations = this.seatPositions.filter((s) => s.row === 2 || s.row === 3 || s.row === 4);
      const picks = this.mobile ? [4] : [3, 15, 24];
      picks.forEach((candidate, i) => {
        const seat = destinations[candidate];
        if (!seat) return;
        const model = cloneSkeleton(gltf.scene);
        model.traverse((node) => {
          if (node.isMesh || node.isSkinnedMesh) {
            node.material = sharedBlack;
            node.frustumCulled = false;
          }
        });
        const bounds = new THREE.Box3().setFromObject(model);
        const height = Math.max(0.01, bounds.max.y - bounds.min.y);
        const scale = 1.73 / height;
        model.scale.setScalar(scale);
        const originY = -bounds.min.y * scale;
        model.position.y = originY;
        const root = new THREE.Group();
        root.add(model);
        root.visible = false;
        this.scene.add(root);
        const mixer = new THREE.AnimationMixer(model);
        const walkAction = walk ? mixer.clipAction(walk) : null;
        const idleAction = idle ? mixer.clipAction(idle) : null;
        walkAction?.play();
        this.guests.push({
          seat, root, model, mixer, walkAction, idleAction,
          originY, start: 3.2 + i * 2.4, finished: false,
          sitBones: null, seated: false,
        });
      });
    } catch (error) {
      // Missing asset must never crash the auditorium or trigger CSS mode.
      console.warn("BookMySeat: /models/Xbot.glb not available; guest animation disabled.", error);
    }
  }

  // Bone names vary slightly between GLB exports. Only transform known joints.
  prepareSit(guest) {
    guest.walkAction?.stop();
    guest.idleAction?.play();
    guest.mixer.update(0);
    const names = ["LeftUpLeg", "RightUpLeg", "LeftLeg", "RightLeg", "LeftArm", "RightArm", "LeftForeArm", "RightForeArm"];
    const pose = [];
    guest.model.traverse((node) => {
      if (!node.isBone) return;
      const name = node.name.toLowerCase();
      const match = names.find((n) => name.endsWith(n.toLowerCase()));
      if (!match) return;
      pose.push({ bone: node, name: match, base: node.quaternion.clone(), target: node.quaternion.clone() });
    });
    for (const joint of pose) {
      const angle = {
        LeftUpLeg: 1.22, RightUpLeg: 1.22,
        LeftLeg: -1.32, RightLeg: -1.32,
        LeftArm: -0.23, RightArm: -0.23,
        LeftForeArm: -0.35, RightForeArm: -0.35,
      }[joint.name] || 0;
      joint.target.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle));
    }
    guest.sitBones = pose;
  }

  updateGuests(delta) {
    for (const g of this.guests) {
      const t = this.elapsed - g.start;
      if (t < 0) continue;
      g.root.visible = true;
      const approaching = ease(t / 3.25);
      const towardSeat = ease((t - 3.25) / 1.85);
      const sitting = ease((t - 5.15) / 1.0);
      if (!g.seated && t >= 5.15) {
        g.seated = true;
        this.prepareSit(g);
      }
      if (!g.seated) g.mixer.update(Math.min(delta, 0.05));

      // Enter along the central sloped aisle, turn into the chosen row.
      const z = (g.seat.z + 7) + (g.seat.z - (g.seat.z + 7)) * approaching;
      const pathY = clamp((z + 4.5) / 2.15, 0, 5) * 0.46;
      g.root.position.set(g.seat.x * towardSeat, pathY + (g.seat.y - pathY) * towardSeat, z);
      g.root.rotation.y = Math.PI + towardSeat * (g.seat.x > 0 ? -0.06 : 0.06);
      if (g.seated) {
        // Pelvis lowers onto the cushion; thighs/knees bend with the rig.
        g.model.position.y = g.originY - 0.39 * sitting;
        for (const joint of g.sitBones || []) {
          joint.bone.quaternion.copy(joint.base).slerp(joint.target, sitting);
        }
      }
      // Rest forever: no respawn timer or repeated walking cycles.
      if (t > 6.2) {
        g.root.position.set(g.seat.x, g.seat.y, g.seat.z);
      }
    }
  }

  setProgress(value) { this.progress = clamp(Number(value) || 0); this.lastInteraction = performance.now(); this.invalidate(); }
  setPointer(x, y) { this.pointer.tx = clamp(x, -1, 1); this.pointer.ty = clamp(y, -1, 1); this.lastInteraction = performance.now(); this.invalidate(); }
  setActive(value) {
    this.active = Boolean(value);
    this.lastFrame = 0;
    if (this.active) this.invalidate();
    else { cancelAnimationFrame(this.raf); this.raf = 0; }
  }

  setSize() {
    if (this.disposed) return;
    const box = this.container.getBoundingClientRect();
    this.width = Math.max(1, Math.round(box.width));
    this.height = Math.max(1, Math.round(box.height));
    const pixelBudget = this.mobile ? 1900000 : 3600000;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(pixelBudget / (this.width * this.height)));
    this.renderer.setPixelRatio(Math.max(1, dpr));
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const dist = Math.min(SCREEN.h / (2 * Math.tan(fov / 2)), SCREEN.w / (2 * Math.tan(fov / 2) * this.camera.aspect)) * 0.93;
    this.screenPos.set(0, SCREEN.y, SCREEN.z + dist);
    this.invalidate();
  }

  invalidate() {
    if (this.disposed || !this.active || this.raf) return;
    this.raf = requestAnimationFrame(this.tick);
  }

  tick = (now) => {
    this.raf = 0;
    if (this.disposed || !this.active) return;
    const intro = !this.reduceMotion && this.elapsed < 3.5;
    const moving = intro || now - this.lastInteraction < 850 ||
      Math.abs(this.pointer.tx - this.pointer.x) > 0.002 ||
      Math.abs(this.pointer.ty - this.pointer.y) > 0.002 ||
      this.guests.some((g) => this.elapsed < g.start + 6.2);
    const frameStep = this.reduceMotion ? 140 : moving ? 16 : 46;
    if (this.lastDraw && now - this.lastDraw < frameStep - 2) {
      this.invalidate();
      return;
    }
    const delta = this.lastFrame ? Math.min((now - this.lastFrame) / 1000, 0.06) : 0.016;
    this.lastFrame = now;
    this.lastDraw = now;
    if (!this.reduceMotion) this.elapsed += delta;

    const smoothing = 1 - Math.exp(-delta * 8);
    this.pointer.x += (this.pointer.tx - this.pointer.x) * smoothing;
    this.pointer.y += (this.pointer.ty - this.pointer.y) * smoothing;
    this.updateCamera();
    this.updateGuests(delta);
    this.ambient.intensity = 1.40 + (this.reduceMotion ? 0 : Math.sin(this.elapsed * 0.25) * 0.05);
    this.screenGlow.intensity = 78 + (this.reduceMotion ? 0 : Math.sin(this.elapsed * 0.35) * 5);
    this.renderer.render(this.scene, this.camera);
    this.reportScreen();
    this.invalidate();
  };

  updateCamera() {
    const entrance = this.reduceMotion ? 1 : ease(this.elapsed / 3.15);
    const doorOpen = this.reduceMotion ? 1 : ease((this.elapsed - 0.7) / 1.35);
    this.leftHinge.rotation.y = -doorOpen * 1.43;
    this.rightHinge.rotation.y = doorOpen * 1.43;
    this.doors.visible = !this.reduceMotion && this.elapsed < 3.5;

    this.cameraPosition.copy(this.startPos).lerp(this.homePos, entrance);
    this.cameraLook.copy(this.startLook).lerp(this.homeLook, entrance);
    const dolly = ease(this.progress);
    this.cameraPosition.lerp(this.screenPos, dolly);
    this.cameraLook.lerp(this.screenLook, dolly);
    const remain = 1 - dolly;
    this.cameraPosition.x += this.pointer.x * 0.32 * remain;
    this.cameraPosition.y -= this.pointer.y * 0.16 * remain;
    if (!this.reduceMotion) {
      this.cameraPosition.x += Math.sin(this.elapsed * 0.26) * 0.09 * remain * entrance;
      this.cameraPosition.y += Math.cos(this.elapsed * 0.21) * 0.035 * remain * entrance;
    }
    this.camera.position.copy(this.cameraPosition);
    this.camera.lookAt(this.cameraLook);
    this.camera.updateMatrixWorld();
  }

  reportScreen() {
    if (!this.onFrame) return;
    for (let i = 0; i < 4; i += 1) {
      this.projected.copy(this.corners[i]).project(this.camera);
      this.quad[i].x = (this.projected.x * 0.5 + 0.5) * this.width;
      this.quad[i].y = (1 - (this.projected.y * 0.5 + 0.5)) * this.height;
    }
    this.onFrame(this.quad);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener("webglcontextlost", this.handleContextLoss, false);
    for (const g of this.guests) {
      g.walkAction?.stop();
      g.idleAction?.stop();
      g.mixer.stopAllAction();
      this.scene.remove(g.root);
    }
    this.geometry.forEach((g) => g.dispose());
    this.material.forEach((m) => m.dispose());
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
