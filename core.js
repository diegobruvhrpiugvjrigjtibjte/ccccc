import * as THREE from 'https://unpkg.com/three@0.128.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.128.0/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'https://unpkg.com/three@0.128.0/examples/jsm/controls/TransformControls.js';
import { STLLoader } from 'https://unpkg.com/three@0.128.0/examples/jsm/loaders/STLLoader.js';
import { RGBELoader } from 'https://unpkg.com/three@0.128.0/examples/jsm/loaders/RGBELoader.js';
import { STLExporter } from 'https://unpkg.com/three@0.128.0/examples/jsm/exporters/STLExporter.js';
import { EffectComposer } from 'https://unpkg.com/three@0.128.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.128.0/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'https://unpkg.com/three@0.128.0/examples/jsm/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.128.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'https://unpkg.com/three@0.128.0/examples/jsm/postprocessing/ShaderPass.js';
import { BokehPass } from 'https://unpkg.com/three@0.128.0/examples/jsm/postprocessing/BokehPass.js';
import { OutlinePass } from 'https://unpkg.com/three@0.128.0/examples/jsm/postprocessing/OutlinePass.js';
import { ColorCorrectionShader } from 'https://unpkg.com/three@0.128.0/examples/jsm/shaders/ColorCorrectionShader.js';
import { CSG } from 'https://cdn.jsdelivr.net/npm/three-csg-ts@3.2.0/+esm';

const app = {
    libs: {
        THREE,
        OrbitControls,
        TransformControls,
        STLLoader,
        RGBELoader,
        STLExporter,
        EffectComposer,
        RenderPass,
        SSAOPass,
        UnrealBloomPass,
        ShaderPass,
        BokehPass,
        OutlinePass,
        ColorCorrectionShader,
        CSG
    },
    scene: null,
    camera: null,
    renderer: null,
    orbit: null,
    transformControl: null,
    floor: null,
    grid: null,
    composer: null,
    outlinePass: null,
    ambientLight: null,
    sunLight: null,
    rimLight: null,
    objects: [],
    selectedObjects: [],
    shadingMode: 'layout',
    isDarkTheme: true,
    needsRender: true,
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2(),
    snapToGrid: false,
    snapToObjects: false,
    gridSnapSize: 1,
    objectSnapThreshold: 0.5,
    selectionLocked: false,
    editMode: false,
    editVertexHelper: null,
    editVertexIndex: null,
    editTargetMesh: null,
    undoStack: [],
    redoStack: [],
    isRestoring: false,
    transformSnapshot: null,
    renderEnvironment: null,
    renderResolution: { width: 3840, height: 2160 },
    renderSamples: 1,
    renderDenoise: true,
    defaultHDR: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/equirectangular/royal_esplanade_1k.hdr',
    scratchNormalMap: null,
    roughnessNoiseMap: null,
    bumpNoiseMap: null
};

window.app = app;

app.init = () => {
    const {
        THREE,
        OrbitControls,
        TransformControls,
        EffectComposer,
        RenderPass,
        OutlinePass
    } = app.libs;

    app.scene = new THREE.Scene();
    app.scene.background = new THREE.Color(0x1a1a1a);

    app.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    app.camera.position.set(15, 12, 15);

    app.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    app.renderer.setSize(window.innerWidth, window.innerHeight);
    app.renderer.setPixelRatio(window.devicePixelRatio);
    app.renderer.physicallyCorrectLights = true;
    app.renderer.outputEncoding = THREE.sRGBEncoding;
    app.renderer.shadowMap.enabled = true;
    app.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    app.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    app.renderer.toneMappingExposure = 1.0;
    document.getElementById('canvas-container').appendChild(app.renderer.domElement);

    app.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    app.scene.add(app.ambientLight);

    app.sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    app.sunLight.position.set(5, 15, 5);
    app.sunLight.castShadow = true;
    app.sunLight.shadow.mapSize.width = 2048;
    app.sunLight.shadow.mapSize.height = 2048;
    app.sunLight.shadow.radius = 6;
    app.scene.add(app.sunLight);

    app.rimLight = new THREE.PointLight(0x4a90e2, 0.6);
    app.rimLight.position.set(-10, 5, -10);
    app.scene.add(app.rimLight);

    const floorGeo = new THREE.PlaneGeometry(2000, 2000);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.8 });
    app.floor = new THREE.Mesh(floorGeo, floorMat);
    app.floor.rotation.x = -Math.PI / 2;
    app.floor.receiveShadow = true;
    app.scene.add(app.floor);

    app.grid = new THREE.GridHelper(100, 100, 0x333333, 0x222222);
    app.grid.position.y = 0.01;
    app.scene.add(app.grid);

    app.orbit = new OrbitControls(app.camera, app.renderer.domElement);
    app.orbit.enableDamping = true;
    app.orbit.addEventListener('change', () => app.needsRender = true);

    app.scratchNormalMap = app.createNormalMapTexture(256);
    app.roughnessNoiseMap = app.createNoiseTexture(256);
    app.bumpNoiseMap = app.createNoiseTexture(256);

    app.composer = new EffectComposer(app.renderer);
    app.composer.addPass(new RenderPass(app.scene, app.camera));
    app.outlinePass = new OutlinePass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        app.scene,
        app.camera
    );
    app.outlinePass.edgeStrength = 4;
    app.outlinePass.edgeGlow = 0.3;
    app.outlinePass.edgeThickness = 1.5;
    app.outlinePass.visibleEdgeColor.set('#4a90e2');
    app.outlinePass.hiddenEdgeColor.set('#1d4ed8');
    app.composer.addPass(app.outlinePass);

    app.transformControl = new TransformControls(app.camera, app.renderer.domElement);
    app.transformControl.addEventListener('dragging-changed', (e) => {
        app.orbit.enabled = !e.value;
        if (e.value) {
            app.transformSnapshot = app.captureTransformSnapshot();
        } else {
            app.transformSnapshot = null;
            app.pushHistory();
        }
    });
    app.transformControl.addEventListener('objectChange', () => {
        if (app.editMode && app.editVertexHelper && app.editTargetMesh && app.editVertexIndex !== null) {
            app.updateEditedVertex();
            app.needsRender = true;
            return;
        }
        if (app.transformSnapshot) {
            app.applyTransformDelta();
        }
        app.applySnapping();
        app.updateSelectionOutline();
        app.needsRender = true;
    });
    app.transformControl.addEventListener('change', () => {
        app.updateSelectionOutline();
        app.needsRender = true;
    });
    app.scene.add(app.transformControl);

    window.addEventListener('mousedown', app.onMouseDown);
    window.addEventListener('resize', app.onResize);
    window.addEventListener('keydown', app.onKey);
    app.syncLightUI();
    app.loadDefaultHDR();
    app.updateRenderSettings();
    app.pushHistory();
};

app.animate = () => {
    requestAnimationFrame(app.animate);
    app.orbit.update();
    if (app.needsRender) {
        app.composer.render();
        app.needsRender = false;
    }
};

app.start = () => {
    app.init();
    app.animate();
};
