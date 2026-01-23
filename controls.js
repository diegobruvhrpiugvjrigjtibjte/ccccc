const app = window.app;
const { THREE } = app.libs;

app.toggleTheme = () => {
    app.isDarkTheme = !app.isDarkTheme;
    document.body.classList.toggle('light-theme');
    const logoSub = document.getElementById('logo-sub');

    if (app.isDarkTheme) {
        if (app.scene.background && app.scene.background.isColor) {
            app.scene.background.set(0x1a1a1a);
        }
        app.floor.material.color.set(0x1c1c1c);
        app.grid.material.color.set(0x333333);
        logoSub.style.color = 'white';
    } else {
        if (app.scene.background && app.scene.background.isColor) {
            app.scene.background.set(0xe5e5e5);
        }
        app.floor.material.color.set(0xdddddd);
        app.grid.material.color.set(0xaaaaaa);
        logoSub.style.color = 'black';
    }
    app.needsRender = true;
};

app.setShading = (mode) => {
    app.shadingMode = mode;
    document.querySelectorAll('.shading-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(mode === 'layout' ? 'shade-wire' : 'shade-render').classList.add('active');

    if (mode === 'render') {
        if (app.scene.background && app.scene.background.isColor) {
            if (app.isDarkTheme) app.scene.background.set(0x0a0a0a);
        }
        app.floor.material.roughness = 0.15;
        app.floor.material.color.set(app.isDarkTheme ? 0x222222 : 0xdddddd);
        app.grid.visible = false;
    } else {
        if (app.scene.background && app.scene.background.isColor) {
            if (app.isDarkTheme) app.scene.background.set(0x1a1a1a);
            else app.scene.background.set(0xe5e5e5);
        }
        app.floor.material.roughness = 0.8;
        app.floor.material.color.set(app.isDarkTheme ? 0x1c1c1c : 0xdddddd);
        app.grid.visible = true;
    }
    app.needsRender = true;
};

app.onMouseDown = (e) => {
    if (e.target.closest('.side-panel') || e.target.closest('#top-toolbar') ||
        e.target.closest('#viewport-shading') || e.target.closest('.theme-toggle')) return;

    app.mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    app.raycaster.setFromCamera(app.mouse, app.camera);
    if (app.editMode) {
        app.handleEditModePick();
        app.pushHistory();
        return;
    }
    if (app.selectionLocked) return;

    const hits = app.raycaster
        .intersectObjects(app.scene.children, true)
        .filter((hit) => app.objects.includes(hit.object));

    if (hits.length > 0) {
        const hitObj = hits[0].object;
        if (e.shiftKey) {
            app.toggleSelection(hitObj);
        } else {
            app.selectSingle(hitObj);
        }
    } else if (!e.shiftKey) {
        app.deselect();
    }
    app.needsRender = true;
};

app.onKey = (e) => {
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') {
        e.preventDefault();
        app.undo();
        return;
    }
    if ((e.ctrlKey || e.metaKey) && k === 'y') {
        e.preventDefault();
        app.redo();
        return;
    }
    if (k === 'd' && e.shiftKey) {
        e.preventDefault();
        app.duplicateSelected();
        return;
    }
    if (k === 'g') app.setMode('translate');
    if (k === 'r') app.setMode('rotate');
    if (k === 's') app.setMode('scale');
    if (k === 'delete' || k === 'x') app.deleteObject();
    if (k === 'escape') app.deselect();
};

app.setMode = (m) => {
    app.transformControl.setMode(m);
    document.querySelectorAll('#top-toolbar .btn-tool').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-' + m).classList.add('active');
};

app.updateScale = (axis, val) => {
    if (app.selectedObjects[0]) {
        app.selectedObjects.forEach((obj) => {
            obj.scale[axis] = parseFloat(val);
        });
        document.getElementById('v-' + axis).innerText = val;
        app.updateSelectionOutline();
        app.pushHistory();
        app.needsRender = true;
    }
};

app.updateColor = (hex) => {
    if (app.selectedObjects[0]) {
        app.selectedObjects.forEach((obj) => {
            obj.material.color.set(hex);
        });
        app.pushHistory();
        app.needsRender = true;
    }
};

app.setMaterialPreset = (p) => {
    if (!app.selectedObjects[0]) return;
    app.selectedObjects.forEach((obj) => {
        const m = obj.material;
        switch(p) {
            case 'standard':
                m.metalness = 0.1;
                m.roughness = 0.8;
                m.transmission = 0;
                m.clearcoat = 0;
                m.transparent = false;
                m.opacity = 1;
                break;
            case 'metal':
                m.metalness = 1.0;
                m.roughness = 0.2;
                m.transmission = 0;
                m.clearcoat = 0.5;
                m.transparent = false;
                m.opacity = 1;
                break;
            case 'glass':
                m.metalness = 0.0;
                m.roughness = 0.0;
                m.transmission = 1.0;
                m.thickness = 1.0;
                m.ior = 1.5;
                m.clearcoat = 0;
                m.transparent = false;
                m.opacity = 1;
                break;
            case 'plastic':
                m.metalness = 0.0;
                m.roughness = 0.2;
                m.transmission = 0;
                m.clearcoat = 0.2;
                m.transparent = false;
                m.opacity = 1;
                break;
            case 'brushed':
                m.metalness = 1.0;
                m.roughness = 0.35;
                m.transmission = 0;
                m.clearcoat = 0.15;
                m.transparent = false;
                m.opacity = 1;
                break;
        }
        app.applyImperfections(m);
    });
    app.pushHistory();
    app.needsRender = true;
};

app.updateLight = (type, value) => {
    const intensity = parseFloat(value);
    if (type === 'ambient') {
        app.ambientLight.intensity = intensity;
        document.getElementById('amb-v').innerText = intensity.toFixed(1);
    }
    if (type === 'sun') {
        app.sunLight.intensity = intensity;
        document.getElementById('sun-v').innerText = intensity.toFixed(1);
    }
    if (type === 'rim') {
        app.rimLight.intensity = intensity;
        document.getElementById('rim-v').innerText = intensity.toFixed(1);
    }
    app.needsRender = true;
};

app.onResize = () => {
    app.camera.aspect = window.innerWidth / window.innerHeight;
    app.camera.updateProjectionMatrix();
    app.renderer.setSize(window.innerWidth, window.innerHeight);
    app.composer.setSize(window.innerWidth, window.innerHeight);
    app.outlinePass.setSize(window.innerWidth, window.innerHeight);
    app.updateRenderSettings();
    app.needsRender = true;
};

app.syncLightUI = () => {
    document.getElementById('amb-light').value = app.ambientLight.intensity;
    document.getElementById('sun-light').value = app.sunLight.intensity;
    document.getElementById('rim-light').value = app.rimLight.intensity;
    document.getElementById('amb-v').innerText = app.ambientLight.intensity.toFixed(1);
    document.getElementById('sun-v').innerText = app.sunLight.intensity.toFixed(1);
    document.getElementById('rim-v').innerText = app.rimLight.intensity.toFixed(1);
};

app.deleteObject = () => {
    if (app.selectedObjects.length > 0) {
        app.selectedObjects.forEach((obj) => {
            app.scene.remove(obj);
            app.objects = app.objects.filter(o => o !== obj);
        });
        app.deselect();
        app.pushHistory();
        app.needsRender = true;
    }
};

app.duplicateSelected = () => {
    if (app.selectedObjects.length === 0) return;
    const clones = app.selectedObjects.map((obj) => {
        const clone = obj.clone();
        clone.geometry = obj.geometry.clone();
        clone.material = obj.material.clone();
        clone.position.add(new app.libs.THREE.Vector3(1, 0, 1));
        app.scene.add(clone);
        app.objects.push(clone);
        return clone;
    });
    app.clearSelection();
    clones.forEach((obj) => app.addSelection(obj));
    app.pushHistory();
    app.needsRender = true;
};
