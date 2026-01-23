const app = window.app;

app.toggleSection = (type) => {
    if (type === 'cad') {
        const cadSection = document.getElementById('cad-section');
        const sections = document.querySelectorAll('[data-cad]');
        const shouldShow = cadSection.hasAttribute('hidden');
        cadSection.toggleAttribute('hidden', !shouldShow);
        sections.forEach((section) => section.toggleAttribute('hidden', !shouldShow));
        document.getElementById('toggle-cad').classList.toggle('active', shouldShow);
    }
    if (type === 'render') {
        const renderSection = document.getElementById('render-section');
        const shouldShow = renderSection.hasAttribute('hidden');
        renderSection.toggleAttribute('hidden', !shouldShow);
        document.getElementById('toggle-render').classList.toggle('active', shouldShow);
    }
};

Object.assign(window, {
    toggleTheme: app.toggleTheme,
    setMode: app.setMode,
    setShading: app.setShading,
    addShape: app.addShape,
    handleSTLImport: app.handleSTLImport,
    handleBackground: app.handleBackground,
    saveProject: app.saveProject,
    loadProject: app.loadProject,
    exportSTL: app.exportSTL,
    undo: app.undo,
    redo: app.redo,
    duplicateSelected: app.duplicateSelected,
    toggleSection: app.toggleSection,
    toggleSnap: app.toggleSnap,
    updateGridStep: app.updateGridStep,
    selectAllObjects: app.selectAllObjects,
    toggleSelectionLock: app.toggleSelectionLock,
    centerSelected: app.centerSelected,
    dropToFloor: app.dropToFloor,
    booleanOperation: app.booleanOperation,
    toggleEditMode: app.toggleEditMode,
    updateLight: app.updateLight,
    updateRenderSettings: app.updateRenderSettings,
    updateScale: app.updateScale,
    updateColor: app.updateColor,
    setMaterialPreset: app.setMaterialPreset,
    deleteObject: app.deleteObject,
    deselect: app.deselect,
    takeRender: app.takeRender
});
