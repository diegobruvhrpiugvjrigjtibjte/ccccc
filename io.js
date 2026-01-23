const app = window.app;
const { THREE, STLExporter } = app.libs;

app.saveProject = () => {
    const data = JSON.stringify(app.serializeScene(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'blender_canvas_project.json';
    a.click();
    URL.revokeObjectURL(url);
};

app.loadProject = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = JSON.parse(e.target.result);
        app.restoreScene(data);
        app.undoStack = [JSON.stringify(data)];
        app.redoStack = [];
    };
    reader.readAsText(file);
};

app.exportSTL = () => {
    const exporter = new STLExporter();
    const exportTargets = app.selectedObjects.length > 0 ? app.selectedObjects : app.objects;
    if (exportTargets.length === 0) return;
    const group = new THREE.Group();
    exportTargets.forEach((obj) => {
        const clone = obj.clone();
        clone.geometry = obj.geometry.clone();
        clone.updateMatrixWorld(true);
        clone.geometry.applyMatrix4(clone.matrixWorld);
        clone.position.set(0, 0, 0);
        clone.rotation.set(0, 0, 0);
        clone.scale.set(1, 1, 1);
        group.add(clone);
    });
    const stlString = exporter.parse(group);
    const blob = new Blob([stlString], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'blender_canvas_export.stl';
    a.click();
    URL.revokeObjectURL(url);
};
