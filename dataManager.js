/**
 * データ管理・ストレージ関連の機能を提供するモジュール
 * RDBMS移植時はこのファイルのみ変更すればよい
 */

// LocalStorageキー定義
const STORAGE_KEYS = {
    NODES: 'graphEditor_nodes',
    RELATIONS: 'graphEditor_relations', 
    NODE_HIERARCHY: 'graphEditor_nodeHierarchy',
    NODE_TASKS: 'graphEditor_nodeTasks',
    NODE_STATUSES: 'graphEditor_nodeStatuses',
    NODE_CARD_COLLAPSED: 'graphEditor_nodeCardCollapsed',
    DATA_VERSION: 'graphEditor_dataVersion',
    // プロジェクト管理
    PROJECTS: 'graphEditor_projects',
    CURRENT_PROJECT_ID: 'graphEditor_currentProjectId'
};

// データバージョン
const CURRENT_DATA_VERSION = '1.0.0';

// LocalStorageが利用可能かチェック
function isLocalStorageAvailable() {
    try {
        const testKey = '__localStorage_test__';
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);
        return true;
    } catch (e) {
        return false;
    }
}

// ===== プロジェクト管理機能 =====

/**
 * デフォルトプロジェクトを作成
 */
function createDefaultProject(name = '新しいプロジェクト', description = '', useInitialData = false) {
    return {
        id: generateProjectId(),
        name: name,
        description: description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        data: {
            nodes: useInitialData ? [...initialNodes] : [],
            relations: [],
            nodeHierarchy: [],
            nodeTasks: {},
            nodeStatuses: {},
            nodeCardCollapsed: {}
        }
    };
}

/**
 * プロジェクトID生成
 */
function generateProjectId() {
    return `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * プロジェクト作成
 */
function createProject(name, description = '') {
    const newProject = createDefaultProject(name, description);
    projects.push(newProject);
    saveProjectsToStorage();
    return newProject;
}

/**
 * プロジェクト更新
 */
function updateProject(projectId, updates) {
    const project = projects.find(p => p.id === projectId);
    if (project) {
        Object.assign(project, updates);
        project.updatedAt = new Date().toISOString();
        saveProjectsToStorage();
        return project;
    }
    return null;
}

/**
 * プロジェクト削除
 */
function deleteProject(projectId) {
    const index = projects.findIndex(p => p.id === projectId);
    if (index !== -1) {
        projects.splice(index, 1);
        
        // 削除したプロジェクトが現在選択中の場合
        if (currentProjectId === projectId) {
            if (projects.length > 0) {
                switchToProject(projects[0].id);
            } else {
                // プロジェクトが全部削除された場合、新規プロジェクトを作成
                const defaultProject = createProject('デフォルトプロジェクト');
                switchToProject(defaultProject.id);
            }
        }
        
        saveProjectsToStorage();
        return true;
    }
    return false;
}

/**
 * 現在のプロジェクトデータを保存
 */
function saveCurrentProjectData() {
    if (!currentProjectId) return false;
    
    const project = getCurrentProject();
    if (project) {
        project.data = {
            nodes: [...nodes],
            relations: [...relations],
            nodeHierarchy: [...nodeHierarchy],
            nodeTasks: {...nodeTasks},
            nodeStatuses: {...nodeStatuses},
            nodeCardCollapsed: {...nodeCardCollapsed}
        };
        project.updatedAt = new Date().toISOString();
        return true;
    }
    return false;
}

/**
 * プロジェクトデータを読み込み
 */
function loadProjectData(project) {
    nodes = [...project.data.nodes];
    relations = [...project.data.relations];
    nodeHierarchy = [...project.data.nodeHierarchy];
    nodeTasks = {...project.data.nodeTasks};
    nodeStatuses = {...project.data.nodeStatuses};
    nodeCardCollapsed = {...project.data.nodeCardCollapsed};
}

/**
 * 孤立データのクリーンアップ
 */
function cleanupOrphanedData() {
    // 存在しないノードのタスクを削除
    Object.keys(nodeTasks).forEach(nodeIndexStr => {
        const nodeIndex = parseInt(nodeIndexStr);
        if (nodeIndex >= nodes.length) {
            delete nodeTasks[nodeIndex];
        }
    });
    
    // 存在しないノードのステータスを削除
    Object.keys(nodeStatuses).forEach(nodeIndexStr => {
        const nodeIndex = parseInt(nodeIndexStr);
        if (nodeIndex >= nodes.length) {
            delete nodeStatuses[nodeIndex];
        }
    });
    
    // 存在しないノードの折りたたみ状態を削除
    Object.keys(nodeCardCollapsed).forEach(nodeIndexStr => {
        const nodeIndex = parseInt(nodeIndexStr);
        if (nodeIndex >= nodes.length) {
            delete nodeCardCollapsed[nodeIndex];
        }
    });
    
    // 存在しないノードの階層関係を削除
    nodeHierarchy = nodeHierarchy.filter(hier => 
        hier.parent < nodes.length && 
        hier.children.every(child => child < nodes.length)
    );
    
    // 存在しないノードのリレーションを削除
    relations = relations.filter(rel => 
        rel.from < nodes.length && rel.to < nodes.length
    );
}

/**
 * プロジェクト一覧をStorageに保存
 */
function saveProjectsToStorage() {
    try {
        localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
        return true;
    } catch (e) {
        console.error('Failed to save projects to localStorage:', e);
        return false;
    }
}

/**
 * 現在のプロジェクトIDをStorageに保存
 */
function saveCurrentProjectIdToStorage() {
    try {
        localStorage.setItem(STORAGE_KEYS.CURRENT_PROJECT_ID, currentProjectId);
        return true;
    } catch (e) {
        console.error('Failed to save current project ID to localStorage:', e);
        return false;
    }
}

/**
 * プロジェクト一覧をStorageから読み込み
 */
function loadProjectsFromStorage() {
    try {
        const savedProjects = localStorage.getItem(STORAGE_KEYS.PROJECTS);
        const savedCurrentProjectId = localStorage.getItem(STORAGE_KEYS.CURRENT_PROJECT_ID);
        
        if (savedProjects) {
            projects = JSON.parse(savedProjects);
        } else {
            // 初回訪問時、デフォルトプロジェクトを作成（初期データ付き）
            const defaultProject = createDefaultProject('デフォルトプロジェクト', '初期プロジェクト', true);
            projects = [defaultProject];
        }
        
        // 現在のプロジェクトIDを復元
        if (savedCurrentProjectId && projects.find(p => p.id === savedCurrentProjectId)) {
            currentProjectId = savedCurrentProjectId;
        } else {
            // プロジェクトが見つからない場合、最初のプロジェクトを選択
            currentProjectId = projects.length > 0 ? projects[0].id : null;
        }
        
        return true;
    } catch (e) {
        console.error('Failed to load projects from localStorage:', e);
        return false;
    }
}

// ===== 旧形式データ操作機能（後方互換性） =====

/**
 * データをLocalStorageに保存
 */
function saveToLocalStorage() {
    if (!isLocalStorageAvailable()) {
        console.warn('LocalStorage not available, data will not be persisted');
        return false;
    }
    
    try {
        // プロジェクト管理対応: 現在のプロジェクトデータを保存
        if (currentProjectId) {
            saveCurrentProjectData();
            saveProjectsToStorage();
            saveCurrentProjectIdToStorage();
        } else {
            // 旧形式のデータ保存（後方互換性のため）
            localStorage.setItem(STORAGE_KEYS.DATA_VERSION, CURRENT_DATA_VERSION);
            localStorage.setItem(STORAGE_KEYS.NODES, JSON.stringify(nodes));
            localStorage.setItem(STORAGE_KEYS.RELATIONS, JSON.stringify(relations));
            localStorage.setItem(STORAGE_KEYS.NODE_HIERARCHY, JSON.stringify(nodeHierarchy));
            localStorage.setItem(STORAGE_KEYS.NODE_TASKS, JSON.stringify(nodeTasks));
            localStorage.setItem(STORAGE_KEYS.NODE_STATUSES, JSON.stringify(nodeStatuses));
            localStorage.setItem(STORAGE_KEYS.NODE_CARD_COLLAPSED, JSON.stringify(nodeCardCollapsed));
        }
        
        console.log('Data saved to localStorage successfully');
        return true;
    } catch (e) {
        console.error('Failed to save to localStorage:', e);
        return false;
    }
}

/**
 * データをLocalStorageから読み込み
 */
function loadFromLocalStorage() {
    if (!isLocalStorageAvailable()) {
        console.warn('LocalStorage not available, using initial data');
        initializeWithDefaultData();
        return false;
    }
    
    try {
        // データバージョンチェック
        const savedVersion = localStorage.getItem(STORAGE_KEYS.DATA_VERSION);
        if (savedVersion !== CURRENT_DATA_VERSION) {
            console.log('Data version mismatch or no saved data, using initial data');
            initializeWithDefaultData();
            return false;
        }
        
        // 各データを個別に読み込み
        const savedNodes = localStorage.getItem(STORAGE_KEYS.NODES);
        const savedRelations = localStorage.getItem(STORAGE_KEYS.RELATIONS);
        const savedNodeHierarchy = localStorage.getItem(STORAGE_KEYS.NODE_HIERARCHY);
        const savedNodeTasks = localStorage.getItem(STORAGE_KEYS.NODE_TASKS);
        const savedNodeStatuses = localStorage.getItem(STORAGE_KEYS.NODE_STATUSES);
        const savedNodeCardCollapsed = localStorage.getItem(STORAGE_KEYS.NODE_CARD_COLLAPSED);
        
        // データがある場合のみ復元
        if (savedNodes) {
            nodes = JSON.parse(savedNodes);
        } else {
            nodes = [...initialNodes];
        }
        
        if (savedRelations) {
            relations = JSON.parse(savedRelations);
        } else {
            relations = [];
        }
        
        if (savedNodeHierarchy) {
            nodeHierarchy = JSON.parse(savedNodeHierarchy);
        } else {
            nodeHierarchy = [];
        }
        
        if (savedNodeTasks) {
            nodeTasks = JSON.parse(savedNodeTasks);
        } else {
            nodeTasks = {};
        }
        
        if (savedNodeStatuses) {
            nodeStatuses = JSON.parse(savedNodeStatuses);
        } else {
            nodeStatuses = {};
        }
        
        if (savedNodeCardCollapsed) {
            nodeCardCollapsed = JSON.parse(savedNodeCardCollapsed);
        } else {
            nodeCardCollapsed = {};
        }
        
        console.log('Data loaded from localStorage successfully');
        return true;
    } catch (e) {
        console.error('Failed to load from localStorage:', e);
        initializeWithDefaultData();
        return false;
    }
}

/**
 * 初期データで初期化
 */
function initializeWithDefaultData() {
    nodes = [...initialNodes];
    relations = [];
    nodeHierarchy = [];
    nodeTasks = {};
    nodeStatuses = {};
    nodeCardCollapsed = {};
    console.log('Initialized with default data');
}

/**
 * 全データを初期状態にリセット
 */
function resetToInitialData() {
    if (confirm('全てのデータを初期状態にリセットしますか？この操作は取り消せません。')) {
        initializeWithDefaultData();
        saveToLocalStorage();
        
        // UI全体を更新（外部で実装される関数を呼び出し）
        if (typeof updateAllUI === 'function') {
            updateAllUI();
        }
        
        alert('データが初期状態にリセットされました');
        return true;
    }
    return false;
}

// ===== データエクスポート・インポート機能 =====

/**
 * データをエクスポート
 */
function exportData() {
    // 現在のプロジェクトデータを保存
    if (currentProjectId) {
        saveCurrentProjectData();
    }
    
    const exportObject = {
        exportedAt: new Date().toISOString(),
        version: CURRENT_DATA_VERSION,
        
        // プロジェクト管理データ
        projects: projects,
        currentProjectId: currentProjectId,
        
        // 後方互換性のため、現在のアクティブプロジェクトのデータを旧形式でもエクスポート
        legacyData: {
            nodes: nodes,
            relations: relations,
            nodeHierarchy: nodeHierarchy,
            nodeTasks: nodeTasks,
            nodeStatuses: nodeStatuses,
            nodeCardCollapsed: nodeCardCollapsed
        }
    };
    
    return JSON.stringify(exportObject, null, 2);
}

/**
 * データをインポート
 */
function importData(importDataString) {
    try {
        const importedData = JSON.parse(importDataString);
        
        if (importedData.projects && Array.isArray(importedData.projects)) {
            // 新形式: プロジェクト管理対応データ
            const confirmMessage = `${importedData.projects.length}個のプロジェクトをインポートしますか？\n現在のデータは保持されます。`;
            
            if (confirm(confirmMessage)) {
                // プロジェクトを追加
                importedData.projects.forEach(importedProject => {
                    const newProject = {
                        ...importedProject,
                        id: generateProjectId(), // 新しいIDを生成
                        name: `${importedProject.name} (インポート)`,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    projects.push(newProject);
                });
                
                saveProjectsToStorage();
                saveCurrentProjectIdToStorage();
                
            } else {
                return false;
            }
            
        } else {
            // 旧形式または単一プロジェクトデータのインポート
            let dataToImport;
            
            if (importedData.data && Array.isArray(importedData.data.nodes)) {
                // 新形式の単一プロジェクトデータ
                dataToImport = importedData.data;
            } else if (importedData.legacyData && Array.isArray(importedData.legacyData.nodes)) {
                // レガシーデータ
                dataToImport = importedData.legacyData;
            } else {
                throw new Error('Invalid data format');
            }
            
            // 新しいプロジェクトとして追加
            const importProjectName = `インポート ${new Date().toLocaleDateString()}`;
            const newProject = createProject(importProjectName, 'インポートされたプロジェクト');
            
            // データを設定
            newProject.data = {
                nodes: dataToImport.nodes || [],
                relations: dataToImport.relations || [],
                nodeHierarchy: dataToImport.nodeHierarchy || [],
                nodeTasks: dataToImport.nodeTasks || {},
                nodeStatuses: dataToImport.nodeStatuses || {},
                nodeCardCollapsed: dataToImport.nodeCardCollapsed || {}
            };
            
            // 新しいプロジェクトに切り替え
            switchToProject(newProject.id);
        }
        
        saveToLocalStorage();
        
        // UI全体を更新（外部で実装される関数を呼び出し）
        if (typeof updateProjectUI === 'function') {
            updateProjectUI();
        }
        
        return true;
    } catch (e) {
        console.error('Failed to import data:', e);
        return false;
    }
}

/**
 * エクスポートデータをダウンロード
 */
function downloadExportData() {
    try {
        const data = exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = url;
        a.download = `graph-editor-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('Export data downloaded successfully');
    } catch (e) {
        console.error('Failed to download export data:', e);
        alert('エクスポートに失敗しました');
    }
}

/**
 * ファイルからインポート
 */
function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const success = importData(e.target.result);
            if (success) {
                alert('データのインポートが完了しました');
            } else {
                alert('インポートがキャンセルされました');
            }
        } catch (error) {
            console.error('Import error:', error);
            alert('インポートに失敗しました: ファイル形式が正しくありません');
        }
        
        // ファイル入力をリセット
        event.target.value = '';
    };
    
    reader.readAsText(file);
}