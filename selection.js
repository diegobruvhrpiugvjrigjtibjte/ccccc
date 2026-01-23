const app = window.app;
const { THREE } = app.libs;

app.selectSingle = (obj) => {
    app.clearSelection();
    app.addSelection(obj);
};

app.toggleSelection = (obj) => {
    if (app.selectedObjects.includes(obj)) {
        app.removeSelection(obj);
    } else {
        app.addSelection(obj);
    }
};

app.addSelection = (obj) => {
    if (!app.selectedObjects.includes(obj)) {
        app.selectedObjects.push(obj);
    }
    app.transformControl.attach(obj);
    document.getElementById('right-panel').classList.add('active');
    app.syncUI();
    app.updateSelectionOutline();
};

app.removeSelection = (obj) => {
    app.selectedObjects = app.selectedObjects.filter(item => item !== obj);
    if (app.selectedObjects.length === 0) {
        app.deselect();
    } else {
        app.transformControl.attach(app.selectedObjects[app.selectedObjects.length - 1]);
        app.syncUI();
        app.updateSelectionOutline();
    }
};

app.clearSelection = () => {
    app.selectedObjects = [];
    app.updateSelectionOutline();
    app.transformControl.detach();
    if (app.editMode) {
        app.clearEditHelper();
    }
};

app.deselect = () => {
    app.clearSelection();
    document.getElementById('right-panel').classList.remove('active');
    app.needsRender = true;
};

app.updateSelectionOutline = () => {
    if (!app.outlinePass) return;
    app.outlinePass.selectedObjects = app.selectedObjects.slice();
    app.needsRender = true;
};

app.syncUI = () => {
    if (app.selectedObjects.length === 0) return;
    const obj = app.selectedObjects[app.selectedObjects.length - 1];
    const s = obj.scale;
    document.getElementById('sc-x').value = s.x;
    document.getElementById('sc-y').value = s.y;
    document.getElementById('sc-z').value = s.z;
    document.getElementById('v-x').innerText = s.x.toFixed(1);
    document.getElementById('v-y').innerText = s.y.toFixed(1);
    document.getElementById('v-z').innerText = s.z.toFixed(1);
    document.getElementById('color-picker').value = '#' + obj.material.color.getHexString();
};
