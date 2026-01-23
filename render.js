const app = window.app;
const {
    THREE,
    EffectComposer,
    RenderPass,
    SSAOPass,
    OutlinePass,
    UnrealBloomPass,
    ShaderPass,
    BokehPass,
    ColorCorrectionShader
} = app.libs;

app.updateRenderSettings = () => {
    const scaleValue = parseInt(document.getElementById('render-scale').value, 10);
    const aspect = window.innerHeight / window.innerWidth;
    app.renderResolution = {
        width: scaleValue,
        height: Math.round(scaleValue * aspect)
    };
    app.renderSamples = parseInt(document.getElementById('render-samples').value, 10);
    app.renderDenoise = document.getElementById('render-denoise').checked;
};

app.takeRender = () => {
    const overlay = document.getElementById('render-progress');
    overlay.style.display = 'flex';
    app.setShading('render');

    setTimeout(() => {
        const width = app.renderResolution.width;
        const height = app.renderResolution.height;
        const renderRenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        renderRenderer.setSize(width, height);
        renderRenderer.setPixelRatio(1);
        renderRenderer.physicallyCorrectLights = true;
        renderRenderer.outputEncoding = THREE.sRGBEncoding;
        renderRenderer.shadowMap.enabled = true;
        renderRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderRenderer.toneMappingExposure = 1.1;

        const prevEnv = app.scene.environment;
        let tempEnv = null;
        if (app.scene.background && app.scene.background.isTexture) {
            const pmrem = new THREE.PMREMGenerator(renderRenderer);
            tempEnv = pmrem.fromEquirectangular(app.scene.background).texture;
            app.scene.environment = tempEnv;
            pmrem.dispose();
        } else if (app.renderEnvironment) {
            app.scene.environment = app.renderEnvironment;
        }

        const renderComposer = new EffectComposer(renderRenderer);
        renderComposer.addPass(new RenderPass(app.scene, app.camera));
        const renderSSAO = new SSAOPass(app.scene, app.camera, width, height);
        renderSSAO.kernelRadius = 12;
        renderSSAO.minDistance = 0.001;
        renderSSAO.maxDistance = 0.2;
        renderComposer.addPass(renderSSAO);
        const renderOutline = new OutlinePass(new THREE.Vector2(width, height), app.scene, app.camera);
        renderOutline.edgeStrength = app.outlinePass.edgeStrength;
        renderOutline.edgeGlow = app.outlinePass.edgeGlow;
        renderOutline.edgeThickness = app.outlinePass.edgeThickness;
        renderOutline.visibleEdgeColor.copy(app.outlinePass.visibleEdgeColor);
        renderOutline.hiddenEdgeColor.copy(app.outlinePass.hiddenEdgeColor);
        renderOutline.selectedObjects = app.selectedObjects.slice();
        renderComposer.addPass(renderOutline);
        const renderBloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.35, 0.7, 0.85);
        renderComposer.addPass(renderBloom);
        const renderColor = new ShaderPass(ColorCorrectionShader);
        renderColor.uniforms.powRGB.value.set(1.08, 1.08, 1.08);
        renderColor.uniforms.mulRGB.value.set(1.03, 1.03, 1.03);
        renderComposer.addPass(renderColor);
        const renderDOF = new BokehPass(app.scene, app.camera, {
            focus: 15,
            aperture: 0.0005,
            maxblur: 0.01
        });
        renderComposer.addPass(renderDOF);

        const prevSize = app.renderer.getSize(new THREE.Vector2());
        const prevPixelRatio = app.renderer.getPixelRatio();
        const prevAspect = app.camera.aspect;
        const prevView = app.camera.view ? { ...app.camera.view } : null;

        app.camera.aspect = width / height;
        app.camera.updateProjectionMatrix();
        const accumCanvas = document.createElement('canvas');
        accumCanvas.width = width;
        accumCanvas.height = height;
        const accumCtx = accumCanvas.getContext('2d');
        accumCtx.clearRect(0, 0, width, height);
        const samples = Math.max(1, app.renderSamples);
        for (let i = 0; i < samples; i += 1) {
            const jitterX = (Math.random() - 0.5) * 2;
            const jitterY = (Math.random() - 0.5) * 2;
            app.camera.setViewOffset(width, height, jitterX, jitterY, width, height);
            app.camera.updateProjectionMatrix();
            renderComposer.render();
            accumCtx.globalAlpha = 1 / samples;
            accumCtx.drawImage(renderRenderer.domElement, 0, 0);
        }
        app.camera.clearViewOffset();
        if (app.renderDenoise) {
            app.applyDenoise(accumCanvas);
        }

        const url = accumCanvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = 'blender_render_4k.png';
        a.click();

        if (tempEnv) tempEnv.dispose();
        renderRenderer.dispose();
        app.camera.aspect = prevAspect;
        app.camera.updateProjectionMatrix();
        if (prevView) {
            app.camera.view = prevView;
        }
        app.renderer.setSize(prevSize.x, prevSize.y);
        app.renderer.setPixelRatio(prevPixelRatio);
        app.scene.environment = prevEnv;
        overlay.style.display = 'none';
        app.needsRender = true;
    }, 800);
};

app.applyDenoise = (canvas) => {
    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext('2d');
    const sourceData = ctx.getImageData(0, 0, width, height);
    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = width;
    blurCanvas.height = height;
    const blurCtx = blurCanvas.getContext('2d');
    blurCtx.filter = 'blur(1.2px)';
    blurCtx.drawImage(canvas, 0, 0);
    const blurData = blurCtx.getImageData(0, 0, width, height);
    const out = ctx.createImageData(width, height);
    for (let i = 0; i < sourceData.data.length; i += 4) {
        const r = sourceData.data[i];
        const g = sourceData.data[i + 1];
        const b = sourceData.data[i + 2];
        const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        const mix = luma < 0.4 ? 0.7 : 0.2;
        out.data[i] = r * (1 - mix) + blurData.data[i] * mix;
        out.data[i + 1] = g * (1 - mix) + blurData.data[i + 1] * mix;
        out.data[i + 2] = b * (1 - mix) + blurData.data[i + 2] * mix;
        out.data[i + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
};
