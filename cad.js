const app = window.app;
const { THREE, CSG } = app.libs;

app.toggleSnap = (type) => {
    if (type === 'grid') {
        app.snapToGrid = !app.snapToGrid;
        document.getElementById('snap-grid').classList.toggle('active', app.snapToGrid);
    }
    if (type === 'objects') {
        app.snapToObjects = !app.snapToObjects;
        document.getElementById('snap-objects').classList.toggle('active', app.snapToObjects);
    }
};

app.applySnapping = () => {
    if (!app.snapToGrid && !app.snapToObjects) return;
    app.selectedObjects.forEach((obj) => {
        if (app.snapToGrid) {
            obj.position.set(
                Math.round(obj.position.x / app.gridSnapSize) * app.gridSnapSize,
                Math.round(obj.position.y / app.gridSnapSize) * app.gridSnapSize,
                Math.round(obj.position.z / app.gridSnapSize) * app.gridSnapSize
            );
        }
        if (app.snapToObjects) {
            const objBox = new THREE.Box3().setFromObject(obj);
            app.objects.forEach((other) => {
                if (other === obj) return;
                const otherBox = new THREE.Box3().setFromObject(other);
                const deltas = [
                    { axis: 'x', delta: otherBox.min.x - objBox.max.x },
                    { axis: 'x', delta: otherBox.max.x - objBox.min.x },
                    { axis: 'y', delta: otherBox.min.y - objBox.max.y },
                    { axis: 'y', delta: otherBox.max.y - objBox.min.y },
                    { axis: 'z', delta: otherBox.min.z - objBox.max.z },
                    { axis: 'z', delta: otherBox.max.z - objBox.min.z }
                ];
                deltas.forEach((item) => {
                    if (Math.abs(item.delta) <= app.objectSnapThreshold) {
                        obj.position[item.axis] += item.delta;
                    }
                });
            });
        }
    });
};

app.captureTransformSnapshot = () => {
    if (app.selectedObjects.length === 0) return null;
    const active = app.selectedObjects[app.selectedObjects.length - 1];
    return {
        active,
        activePosition: active.position.clone(),
        activeQuaternion: active.quaternion.clone(),
        activeScale: active.scale.clone(),
        items: app.selectedObjects.map((obj) => ({
            obj,
            position: obj.position.clone(),
            quaternion: obj.quaternion.clone(),
            scale: obj.scale.clone()
        }))
    };
};

app.applyTransformDelta = () => {
    if (!app.transformSnapshot) return;
    const active = app.transformSnapshot.active;
    const deltaPos = active.position.clone().sub(app.transformSnapshot.activePosition);
    const deltaQuat = active.quaternion.clone().multiply(app.transformSnapshot.activeQuaternion.clone().invert());
    const deltaScale = new THREE.Vector3(
        active.scale.x / (app.transformSnapshot.activeScale.x || 1),
        active.scale.y / (app.transformSnapshot.activeScale.y || 1),
        active.scale.z / (app.transformSnapshot.activeScale.z || 1)
    );
    app.transformSnapshot.items.forEach((item) => {
        if (item.obj === active) return;
        item.obj.position.copy(item.position.clone().add(deltaPos));
        item.obj.quaternion.copy(deltaQuat.clone().multiply(item.quaternion));
        item.obj.scale.set(
            item.scale.x * deltaScale.x,
            item.scale.y * deltaScale.y,
            item.scale.z * deltaScale.z
        );
    });
};

app.updateGridStep = (value) => {
    app.gridSnapSize = parseFloat(value);
};

app.selectAllObjects = () => {
    if (app.objects.length === 0) return;
    app.clearSelection();
    app.objects.forEach((obj) => app.addSelection(obj));
};

app.toggleSelectionLock = () => {
    app.selectionLocked = !app.selectionLocked;
    document.getElementById('lock-selection').classList.toggle('active', app.selectionLocked);
};

app.centerSelected = () => {
    if (app.selectedObjects.length === 0) return;
    const bbox = new THREE.Box3();
    app.selectedObjects.forEach((obj) => bbox.expandByObject(obj));
    const center = bbox.getCenter(new THREE.Vector3());
    app.selectedObjects.forEach((obj) => {
        obj.position.sub(center);
    });
    app.updateSelectionOutline();
    app.pushHistory();
    app.needsRender = true;
};

app.dropToFloor = () => {
    if (app.selectedObjects.length === 0) return;
    const bbox = new THREE.Box3();
    app.selectedObjects.forEach((obj) => bbox.expandByObject(obj));
    const delta = bbox.min.y;
    app.selectedObjects.forEach((obj) => {
        obj.position.y -= delta;
    });
    app.updateSelectionOutline();
    app.pushHistory();
    app.needsRender = true;
};

app.booleanOperation = (type) => {
    if (app.selectedObjects.length < 2 || !CSG) return;
    const target = app.selectedObjects[0];
    const tool = app.selectedObjects[1];
    const targetCSG = CSG.fromMesh(target);
    const toolCSG = CSG.fromMesh(tool);
    let resultCSG = null;
    if (type === 'subtract') resultCSG = targetCSG.subtract(toolCSG);
    if (type === 'union') resultCSG = targetCSG.union(toolCSG);
    if (type === 'intersect') resultCSG = targetCSG.intersect(toolCSG);
    if (!resultCSG) return;
    const resultMesh = CSG.toMesh(resultCSG, target.matrix, target.material.clone());
    resultMesh.castShadow = true;
    resultMesh.receiveShadow = true;
    app.scene.add(resultMesh);
    app.objects = app.objects.filter((obj) => obj !== target && obj !== tool);
    app.scene.remove(target);
    app.scene.remove(tool);
    app.clearSelection();
    app.objects.push(resultMesh);
    app.addSelection(resultMesh);
    app.pushHistory();
    app.needsRender = true;
};

app.toggleEditMode = () => {
    app.editMode = !app.editMode;
    const button = document.getElementById('edit-mode');
    button.classList.toggle('active', app.editMode);
    button.innerText = app.editMode ? 'Disattiva' : 'Attiva';
    if (app.editMode) {
        app.transformControl.detach();
    } else {
        app.clearEditHelper();
    }
};

app.handleEditModePick = () => {
    if (app.selectedObjects.length === 0) return;
    const hits = app.raycaster.intersectObjects(app.selectedObjects, true);
    if (hits.length === 0) return;
    const hit = hits[0];
    const geometry = hit.object.geometry;
    if (!geometry || !geometry.attributes || !geometry.attributes.position) return;
    const position = geometry.attributes.position;
    let vertexIndex = hit.faceIndex ? hit.faceIndex * 3 : 0;
    if (geometry.index) {
        vertexIndex = geometry.index.array[hit.faceIndex * 3];
    }
    const vertex = new THREE.Vector3().fromBufferAttribute(position, vertexIndex);
    hit.object.localToWorld(vertex);

    if (!app.editVertexHelper) {
        const helperGeo = new THREE.SphereGeometry(0.12, 12, 12);
        const helperMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
        app.editVertexHelper = new THREE.Mesh(helperGeo, helperMat);
        app.scene.add(app.editVertexHelper);
    }
    app.editVertexIndex = vertexIndex;
    app.editTargetMesh = hit.object;
    app.editVertexHelper.position.copy(vertex);
    app.transformControl.attach(app.editVertexHelper);
    app.needsRender = true;
};

app.updateEditedVertex = () => {
    if (!app.editTargetMesh || app.editVertexIndex === null) return;
    const geometry = app.editTargetMesh.geometry;
    const position = geometry.attributes.position;
    const localPos = app.editVertexHelper.position.clone();
    app.editTargetMesh.worldToLocal(localPos);
    position.setXYZ(app.editVertexIndex, localPos.x, localPos.y, localPos.z);
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    app.updateSelectionOutline();
};

app.clearEditHelper = () => {
    if (app.editVertexHelper) {
        app.scene.remove(app.editVertexHelper);
        app.editVertexHelper.geometry.dispose();
        app.editVertexHelper.material.dispose();
        app.editVertexHelper = null;
    }
    app.editVertexIndex = null;
    app.editTargetMesh = null;
    app.transformControl.detach();
    app.needsRender = true;
};
