const app = window.app;
const { THREE } = app.libs;

app.serializeScene = () => ({
    objects: app.objects.map((obj) => {
        const material = {
            color: obj.material.color.getHex(),
            roughness: obj.material.roughness ?? 0.5,
            metalness: obj.material.metalness ?? 0.0,
            transmission: obj.material.transmission ?? 0,
            thickness: obj.material.thickness ?? 0,
            ior: obj.material.ior ?? 1.45,
            clearcoat: obj.material.clearcoat ?? 0,
            transparent: obj.material.transparent ?? false,
            opacity: obj.material.opacity ?? 1
        };
        const transform = {
            position: obj.position.toArray(),
            rotation: obj.rotation.toArray(),
            scale: obj.scale.toArray()
        };
        const geometry = obj.geometry;
        if (geometry.userData.primitive) {
            return {
                material,
                transform,
                geometry: {
                    kind: 'primitive',
                    primitive: geometry.userData.primitive,
                    parameters: geometry.parameters
                }
            };
        }
        return {
            material,
            transform,
            geometry: {
                kind: 'buffer',
                data: geometry.toJSON()
            }
        };
    })
});

app.restoreScene = (data) => {
    app.isRestoring = true;
    app.objects.forEach((obj) => app.scene.remove(obj));
    app.objects = [];
    app.clearSelection();
    data.objects.forEach((entry) => {
        let geometry;
        if (entry.geometry.kind === 'primitive') {
            const params = entry.geometry.parameters || {};
            switch (entry.geometry.primitive) {
                case 'box':
                    geometry = new THREE.BoxGeometry(
                        params.width || 4,
                        params.height || 4,
                        params.depth || 4,
                        params.widthSegments || 1,
                        params.heightSegments || 1,
                        params.depthSegments || 1
                    );
                    break;
                case 'sphere':
                    geometry = new THREE.SphereGeometry(
                        params.radius || 2.5,
                        params.widthSegments || 32,
                        params.heightSegments || 32,
                        params.phiStart || 0,
                        params.phiLength || Math.PI * 2,
                        params.thetaStart || 0,
                        params.thetaLength || Math.PI
                    );
                    break;
                case 'cylinder':
                    geometry = new THREE.CylinderGeometry(
                        params.radiusTop || 2,
                        params.radiusBottom || 2,
                        params.height || 6,
                        params.radialSegments || 32,
                        params.heightSegments || 1,
                        params.openEnded || false,
                        params.thetaStart || 0,
                        params.thetaLength || Math.PI * 2
                    );
                    break;
                case 'torus':
                    geometry = new THREE.TorusGeometry(
                        params.radius || 3,
                        params.tube || 1,
                        params.radialSegments || 16,
                        params.tubularSegments || 64,
                        params.arc || Math.PI * 2
                    );
                    break;
                default:
                    geometry = new THREE.BoxGeometry(4, 4, 4);
                    break;
            }
            geometry.userData.primitive = entry.geometry.primitive;
        } else {
            const loader = new THREE.BufferGeometryLoader();
            geometry = loader.parse(entry.geometry.data);
            geometry.computeVertexNormals();
        }
        const material = new THREE.MeshPhysicalMaterial({
            color: entry.material.color,
            roughness: entry.material.roughness,
            metalness: entry.material.metalness,
            transmission: entry.material.transmission ?? 0,
            thickness: entry.material.thickness ?? 0,
            ior: entry.material.ior ?? 1.45,
            clearcoat: entry.material.clearcoat ?? 0,
            transparent: entry.material.transparent,
            opacity: entry.material.opacity
        });
        app.applyImperfections(material);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.fromArray(entry.transform.position);
        mesh.rotation.fromArray(entry.transform.rotation);
        mesh.scale.fromArray(entry.transform.scale);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        app.scene.add(mesh);
        app.objects.push(mesh);
    });
    app.isRestoring = false;
    app.updateSelectionOutline();
    app.needsRender = true;
};

app.pushHistory = () => {
    if (app.isRestoring) return;
    const state = JSON.stringify(app.serializeScene());
    if (app.undoStack[app.undoStack.length - 1] === state) return;
    app.undoStack.push(state);
    if (app.undoStack.length > 50) app.undoStack.shift();
    app.redoStack = [];
};

app.undo = () => {
    if (app.undoStack.length <= 1) return;
    const current = app.undoStack.pop();
    app.redoStack.push(current);
    const prevState = app.undoStack[app.undoStack.length - 1];
    app.restoreScene(JSON.parse(prevState));
};

app.redo = () => {
    if (app.redoStack.length === 0) return;
    const nextState = app.redoStack.pop();
    app.undoStack.push(nextState);
    app.restoreScene(JSON.parse(nextState));
};
