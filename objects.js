const app = window.app;
const { THREE, STLLoader, RGBELoader } = app.libs;

app.createNoiseTexture = (size) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(size, size);
    for (let i = 0; i < image.data.length; i += 4) {
        const value = Math.floor(Math.random() * 255);
        image.data[i] = value;
        image.data[i + 1] = value;
        image.data[i + 2] = value;
        image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 8);
    return texture;
};

app.createNormalMapTexture = (size) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(size, size);
    for (let i = 0; i < image.data.length; i += 4) {
        const angle = Math.random() * Math.PI * 2;
        const strength = Math.random() * 0.5 + 0.5;
        const nx = Math.cos(angle) * strength;
        const ny = Math.sin(angle) * strength;
        image.data[i] = Math.floor((nx * 0.5 + 0.5) * 255);
        image.data[i + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
        image.data[i + 2] = 255;
        image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6, 6);
    return texture;
};

app.applyImperfections = (material) => {
    material.normalMap = app.scratchNormalMap;
    material.normalScale = new THREE.Vector2(0.06, 0.06);
    material.roughnessMap = app.roughnessNoiseMap;
    material.bumpMap = app.bumpNoiseMap;
    material.bumpScale = 0.02;
};

app.createMesh = (geometry) => {
    const mat = new THREE.MeshPhysicalMaterial({
        color: 0x4a90e2,
        roughness: 0.5,
        metalness: 0.2,
        transmission: 0,
        thickness: 0.5,
        ior: 1.45
    });
    app.applyImperfections(mat);
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.y = 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    app.scene.add(mesh);
    app.objects.push(mesh);
    app.selectSingle(mesh);
    app.pushHistory();
    app.needsRender = true;
};

app.addShape = (type) => {
    let geo;
    switch(type) {
        case 'box': geo = new THREE.BoxGeometry(4,4,4); break;
        case 'sphere': geo = new THREE.SphereGeometry(2.5, 32, 32); break;
        case 'cylinder': geo = new THREE.CylinderGeometry(2,2,6,32); break;
        case 'torus': geo = new THREE.TorusGeometry(3, 1, 16, 64); break;
    }
    if (geo) {
        geo.userData.primitive = type;
    }
    app.createMesh(geo);
};

app.handleSTLImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const loader = new STLLoader();
    const reader = new FileReader();
    reader.onload = (e) => {
        const geometry = loader.parse(e.target.result);
        geometry.computeVertexNormals();
        geometry.userData.source = 'stl';
        app.createMesh(geometry);
    };
    reader.readAsArrayBuffer(file);
};

app.handleBackground = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const isHDR = file.name.toLowerCase().endsWith('.hdr');
    if (isHDR) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const loader = new RGBELoader();
            const texture = loader.parse(e.target.result);
            app.applyEnvironmentTexture(texture);
        };
        reader.readAsArrayBuffer(file);
    } else {
        const reader = new FileReader();
        reader.onload = (e) => {
            const texLoader = new THREE.TextureLoader();
            texLoader.load(e.target.result, (tex) => {
                tex.mapping = THREE.EquirectangularReflectionMapping;
                app.applyEnvironmentTexture(tex);
            });
        };
        reader.readAsDataURL(file);
    }
};

app.applyEnvironmentTexture = (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    if (app.scene.background && app.scene.background.isTexture) {
        app.scene.background.dispose();
    }
    app.scene.background = texture;
    const pmrem = new THREE.PMREMGenerator(app.renderer);
    if (app.renderEnvironment) app.renderEnvironment.dispose();
    app.renderEnvironment = pmrem.fromEquirectangular(texture).texture;
    app.scene.environment = app.renderEnvironment;
    pmrem.dispose();
    app.needsRender = true;
};

app.loadDefaultHDR = () => {
    const loader = new RGBELoader();
    loader.load(app.defaultHDR, (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        const pmrem = new THREE.PMREMGenerator(app.renderer);
        if (app.renderEnvironment) app.renderEnvironment.dispose();
        app.renderEnvironment = pmrem.fromEquirectangular(texture).texture;
        app.scene.environment = app.renderEnvironment;
        pmrem.dispose();
        app.needsRender = true;
    });
};
