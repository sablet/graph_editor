/**
 * 同期管理モジュール - GitHub Gist APIを使用した透明なデータ同期
 */

class SyncManager {
    constructor() {
        this.gistToken = null;
        this.isOnlineMode = false;
        this.lastSyncTime = null;
        this.autoSyncInterval = null;
        this.upSyncTimeout = null;
        this.gistDataManager = null;
        this.syncInProgress = false;
    }

    /**
     * 初期化：既存トークンチェックと自動同期開始
     */
    async initialize() {
        console.log('SyncManager initializing...');
        
        const savedToken = localStorage.getItem('graphEditor_gistToken');
        if (savedToken) {
            this.gistToken = savedToken;
            this.gistDataManager = new GistDataManager(savedToken);
            this.isOnlineMode = true;
            
            try {
                await this.validateTokenAndSync();
                this.startAutoSync();
                console.log('オンライン同期モード有効');
            } catch (error) {
                console.log('トークン検証失敗、ローカルモード継続:', error);
                this.handleInvalidToken();
            }
        } else {
            console.log('トークン未設定、ローカルモードで起動');
        }
        
        // UI状態更新
        if (window.updateSyncStatus) {
            window.updateSyncStatus();
        }
    }

    /**
     * トークン検証と初回同期
     */
    async validateTokenAndSync() {
        const response = await fetch('https://api.github.com/user', {
            headers: { 
                'Authorization': `token ${this.gistToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Token validation failed: ${response.status}`);
        }
        
        // 初回同期実行
        await this.syncFromRemote();
    }

    /**
     * 無効トークン処理
     */
    handleInvalidToken() {
        localStorage.removeItem('graphEditor_gistToken');
        this.isOnlineMode = false;
        this.gistToken = null;
        this.gistDataManager = null;
        
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
        }
        
        this.showNotification('GitHub認証が無効です。再設定してください。', 'warning');
    }

    /**
     * 新しいトークンでオンラインモード有効化
     */
    async enableSync(token) {
        try {
            // トークン検証
            const response = await fetch('https://api.github.com/user', {
                headers: { 
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Invalid token');
            }
            
            // 設定保存
            this.gistToken = token;
            this.gistDataManager = new GistDataManager(token);
            this.isOnlineMode = true;
            
            localStorage.setItem('graphEditor_gistToken', token);
            
            // 既存データをGistにアップロード
            await this.uploadExistingData();
            
            // 自動同期開始
            this.startAutoSync();
            
            this.showNotification('クラウド同期が有効になりました', 'success');
            
            if (window.updateSyncStatus) {
                window.updateSyncStatus();
            }
            
            return true;
        } catch (error) {
            console.error('同期有効化エラー:', error);
            this.showNotification('トークンが無効です', 'error');
            return false;
        }
    }

    /**
     * 既存ローカルデータをGistにアップロード
     */
    async uploadExistingData() {
        try {
            // 現在のすべてのプロジェクトを取得
            const projects = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECTS) || '[]');
            
            for (const project of projects) {
                // プロジェクトデータを構築
                const projectData = this.buildProjectDataFromLocal(project);
                
                // Gistにアップロード
                await this.gistDataManager.saveProject(projectData);
                
                // gistIdをローカルに保存
                project.gistId = projectData.gistId;
            }
            
            // 更新されたプロジェクト一覧を保存
            localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
            
            console.log('既存データのアップロード完了');
        } catch (error) {
            console.error('既存データアップロードエラー:', error);
        }
    }

    /**
     * ローカルストレージからプロジェクトデータを構築
     */
    buildProjectDataFromLocal(project) {
        // 現在のプロジェクトの場合は現在のデータを使用
        const currentProjectId = localStorage.getItem(STORAGE_KEYS.CURRENT_PROJECT_ID);
        
        if (project.id === currentProjectId) {
            return {
                ...project,
                data: {
                    nodes: JSON.parse(localStorage.getItem(STORAGE_KEYS.NODES) || '[]'),
                    relations: JSON.parse(localStorage.getItem(STORAGE_KEYS.RELATIONS) || '[]'),
                    nodeHierarchy: JSON.parse(localStorage.getItem(STORAGE_KEYS.NODE_HIERARCHY) || '[]'),
                    nodeTasks: JSON.parse(localStorage.getItem(STORAGE_KEYS.NODE_TASKS) || '{}'),
                    nodeStatuses: JSON.parse(localStorage.getItem(STORAGE_KEYS.NODE_STATUSES) || '{}'),
                    projectChatHistory: JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECT_CHAT_HISTORY) || '[]'),
                    nodeMemos: JSON.parse(localStorage.getItem(STORAGE_KEYS.NODE_MEMOS) || '{}'),
                    nodeCardCollapsed: JSON.parse(localStorage.getItem(STORAGE_KEYS.NODE_CARD_COLLAPSED) || '{}'),
                    nodeStatusGroupCollapsed: JSON.parse(localStorage.getItem(STORAGE_KEYS.NODE_STATUS_GROUP_COLLAPSED) || '{}'),
                    flatTaskGroupCollapsed: JSON.parse(localStorage.getItem(STORAGE_KEYS.FLAT_TASK_GROUP_COLLAPSED) || '{}'),
                    lastActiveTab: localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE_TAB)
                }
            };
        } else {
            // 他のプロジェクトの場合は既存のdataを使用
            return project;
        }
    }

    /**
     * 自動同期開始
     */
    startAutoSync() {
        if (!this.isOnlineMode) return;
        
        // ページフォーカス時の同期
        window.addEventListener('focus', () => {
            if (this.isOnlineMode) {
                this.syncFromRemote();
            }
        });
        
        // Visibilitychange時の同期
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isOnlineMode) {
                this.syncFromRemote();
            }
        });
        
        // 定期同期（5分間隔）
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
        }
        
        this.autoSyncInterval = setInterval(() => {
            if (this.isOnlineMode) {
                this.syncFromRemote();
            }
        }, 5 * 60 * 1000);
        
        console.log('自動同期開始');
    }

    /**
     * リモートから最新データ取得
     */
    async syncFromRemote() {
        if (!this.isOnlineMode || this.syncInProgress) return;
        
        this.syncInProgress = true;
        
        try {
            const remoteProjects = await this.gistDataManager.getProjects();
            const localProjects = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECTS) || '[]');
            
            const needsUpdate = this.compareTimestamps(localProjects, remoteProjects);
            
            if (needsUpdate.length > 0) {
                await this.mergeRemoteChanges(needsUpdate);
                
                // UI更新
                if (window.updateProjectUI) {
                    window.updateProjectUI();
                }
                
                this.showNotification(`${needsUpdate.length}件のプロジェクトを同期しました`, 'info');
            }
            
            this.lastSyncTime = Date.now();
            
            if (window.updateSyncStatus) {
                window.updateSyncStatus();
            }
            
        } catch (error) {
            console.log('同期エラー（オフライン継続）:', error);
            this.handleSyncError(error);
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * タイムスタンプ比較で更新が必要なプロジェクトを特定
     */
    compareTimestamps(localProjects, remoteProjects) {
        const needsUpdate = [];
        
        for (const remoteProject of remoteProjects) {
            const localProject = localProjects.find(p => p.id === remoteProject.id);
            
            if (!localProject) {
                // 新しいプロジェクト
                needsUpdate.push(remoteProject);
            } else {
                // 既存プロジェクトの更新チェック
                const localTime = new Date(localProject.updatedAt || 0).getTime();
                const remoteTime = new Date(remoteProject.updatedAt || 0).getTime();
                
                if (remoteTime > localTime) {
                    needsUpdate.push(remoteProject);
                }
            }
        }
        
        return needsUpdate;
    }

    /**
     * リモート変更をローカルにマージ
     */
    async mergeRemoteChanges(remoteProjects) {
        const localProjects = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECTS) || '[]');
        const currentProjectId = localStorage.getItem(STORAGE_KEYS.CURRENT_PROJECT_ID);
        
        for (const remoteProject of remoteProjects) {
            const localIndex = localProjects.findIndex(p => p.id === remoteProject.id);
            
            if (localIndex === -1) {
                // 新プロジェクト：追加
                localProjects.push(remoteProject);
            } else {
                // 既存プロジェクト：マージ
                const localProject = localProjects[localIndex];
                const merged = this.smartMerge(localProject, remoteProject);
                localProjects[localIndex] = merged;
                
                // 現在のプロジェクトの場合はローカルストレージも更新
                if (remoteProject.id === currentProjectId) {
                    this.updateCurrentProjectData(merged.data);
                }
            }
        }
        
        // プロジェクト一覧を保存
        localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(localProjects));
    }

    /**
     * 現在のプロジェクトデータをローカルストレージに更新
     */
    updateCurrentProjectData(data) {
        localStorage.setItem(STORAGE_KEYS.NODES, JSON.stringify(data.nodes || []));
        localStorage.setItem(STORAGE_KEYS.RELATIONS, JSON.stringify(data.relations || []));
        localStorage.setItem(STORAGE_KEYS.NODE_HIERARCHY, JSON.stringify(data.nodeHierarchy || []));
        localStorage.setItem(STORAGE_KEYS.NODE_TASKS, JSON.stringify(data.nodeTasks || {}));
        localStorage.setItem(STORAGE_KEYS.NODE_STATUSES, JSON.stringify(data.nodeStatuses || {}));
        localStorage.setItem(STORAGE_KEYS.PROJECT_CHAT_HISTORY, JSON.stringify(data.projectChatHistory || []));
        localStorage.setItem(STORAGE_KEYS.NODE_MEMOS, JSON.stringify(data.nodeMemos || {}));
        
        // UI状態はローカル優先なので更新しない
        // localStorage.setItem(STORAGE_KEYS.NODE_CARD_COLLAPSED, JSON.stringify(data.nodeCardCollapsed || {}));
        // localStorage.setItem(STORAGE_KEYS.NODE_STATUS_GROUP_COLLAPSED, JSON.stringify(data.nodeStatusGroupCollapsed || {}));
        // localStorage.setItem(STORAGE_KEYS.FLAT_TASK_GROUP_COLLAPSED, JSON.stringify(data.flatTaskGroupCollapsed || {}));
    }

    /**
     * スマート結合ロジック
     */
    smartMerge(local, remote) {
        return {
            ...remote, // ベースは最新のメタデータ
            data: {
                // コアデータは最新タイムスタンプ優先
                nodes: this.mergeByTimestamp(local.data?.nodes || [], remote.data?.nodes || [], 'id'),
                relations: this.mergeByTimestamp(local.data?.relations || [], remote.data?.relations || [], 'id'),
                nodeHierarchy: this.mergeArrays(local.data?.nodeHierarchy || [], remote.data?.nodeHierarchy || []),
                nodeTasks: this.mergeNestedObjects(local.data?.nodeTasks || {}, remote.data?.nodeTasks || {}),
                nodeStatuses: this.mergeNestedObjects(local.data?.nodeStatuses || {}, remote.data?.nodeStatuses || {}),
                
                // UI状態：ローカル優先（デバイス固有）
                nodeCardCollapsed: local.data?.nodeCardCollapsed || {},
                nodeStatusGroupCollapsed: local.data?.nodeStatusGroupCollapsed || {},
                flatTaskGroupCollapsed: local.data?.flatTaskGroupCollapsed || {},
                lastActiveTab: local.data?.lastActiveTab,
                
                // チャット・メモ：時系列マージ
                projectChatHistory: this.mergeChatHistory(
                    local.data?.projectChatHistory || [], 
                    remote.data?.projectChatHistory || []
                ),
                nodeMemos: this.mergeNodeMemos(
                    local.data?.nodeMemos || {},
                    remote.data?.nodeMemos || {}
                )
            }
        };
    }

    /**
     * タイムスタンプベースマージ
     */
    mergeByTimestamp(localArray, remoteArray, idField) {
        const merged = new Map();
        
        // ローカルデータを追加
        localArray.forEach(item => {
            if (item[idField] !== undefined) {
                merged.set(item[idField], {
                    ...item,
                    _localTimestamp: item.updatedAt || item.createdAt || '1970-01-01'
                });
            }
        });
        
        // リモートデータで上書き（より新しい場合）
        remoteArray.forEach(item => {
            if (item[idField] !== undefined) {
                const existing = merged.get(item[idField]);
                const remoteTimestamp = item.updatedAt || item.createdAt || '1970-01-01';
                
                if (!existing || remoteTimestamp > existing._localTimestamp) {
                    merged.set(item[idField], item);
                }
            }
        });
        
        return Array.from(merged.values()).map(item => {
            const { _localTimestamp, ...cleanItem } = item;
            return cleanItem;
        });
    }

    /**
     * 配列マージ（重複除去）
     */
    mergeArrays(local, remote) {
        const combined = [...local, ...remote];
        return [...new Set(combined.map(JSON.stringify))].map(JSON.parse);
    }

    /**
     * ネストオブジェクトのマージ
     */
    mergeNestedObjects(local, remote) {
        const result = { ...local };
        
        Object.keys(remote).forEach(key => {
            if (typeof remote[key] === 'object' && remote[key] !== null) {
                result[key] = {
                    ...(result[key] || {}),
                    ...remote[key]
                };
            } else {
                result[key] = remote[key];
            }
        });
        
        return result;
    }

    /**
     * チャット履歴マージ
     */
    mergeChatHistory(localChat, remoteChat) {
        const allMessages = [...localChat, ...remoteChat];
        const uniqueMessages = new Map();
        
        allMessages.forEach(msg => {
            if (msg.id) {
                uniqueMessages.set(msg.id, msg);
            }
        });
        
        return Array.from(uniqueMessages.values())
            .sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
    }

    /**
     * ノードメモマージ
     */
    mergeNodeMemos(localMemos, remoteMemos) {
        const result = { ...localMemos };
        
        Object.keys(remoteMemos).forEach(nodeIndex => {
            if (remoteMemos[nodeIndex] && Array.isArray(remoteMemos[nodeIndex])) {
                const localNodeMemos = result[nodeIndex] || [];
                const mergedNodeMemos = this.mergeChatHistory(localNodeMemos, remoteMemos[nodeIndex]);
                result[nodeIndex] = mergedNodeMemos;
            }
        });
        
        return result;
    }

    /**
     * ローカル変更をリモートへ（デバウンス付き）
     */
    scheduleUpSync() {
        if (!this.isOnlineMode) return;
        
        if (this.upSyncTimeout) {
            clearTimeout(this.upSyncTimeout);
        }
        
        this.upSyncTimeout = setTimeout(() => {
            this.syncToRemote();
        }, 2000); // 2秒のデバウンス
    }

    /**
     * ローカル変更をリモートに同期
     */
    async syncToRemote() {
        if (!this.isOnlineMode || this.syncInProgress) return;
        
        this.syncInProgress = true;
        
        try {
            const currentProjectId = localStorage.getItem(STORAGE_KEYS.CURRENT_PROJECT_ID);
            const projects = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECTS) || '[]');
            const currentProject = projects.find(p => p.id === currentProjectId);
            
            if (currentProject) {
                // 現在のプロジェクトデータを構築
                const projectData = this.buildProjectDataFromLocal(currentProject);
                projectData.updatedAt = new Date().toISOString();
                
                // Gistに保存
                await this.gistDataManager.saveProject(projectData);
                
                // ローカルのプロジェクト情報も更新
                const projectIndex = projects.findIndex(p => p.id === currentProjectId);
                if (projectIndex !== -1) {
                    projects[projectIndex].updatedAt = projectData.updatedAt;
                    projects[projectIndex].gistId = projectData.gistId;
                    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
                }
                
                this.lastSyncTime = Date.now();
                
                if (window.updateSyncStatus) {
                    window.updateSyncStatus();
                }
            }
            
        } catch (error) {
            console.log('アップロード失敗（ローカル保存済み）:', error);
            this.handleSyncError(error);
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * 同期無効化
     */
    disableSync() {
        localStorage.removeItem('graphEditor_gistToken');
        this.isOnlineMode = false;
        this.gistToken = null;
        this.gistDataManager = null;
        
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
        }
        
        if (this.upSyncTimeout) {
            clearTimeout(this.upSyncTimeout);
            this.upSyncTimeout = null;
        }
        
        this.showNotification('クラウド同期を無効にしました', 'info');
        
        if (window.updateSyncStatus) {
            window.updateSyncStatus();
        }
    }

    /**
     * 手動同期実行
     */
    async forceSync() {
        if (!this.isOnlineMode) return;
        
        this.showNotification('同期中...', 'info');
        
        try {
            await this.syncToRemote(); // アップロード
            await this.syncFromRemote(); // ダウンロード
            this.showNotification('同期完了', 'success');
        } catch (error) {
            console.error('手動同期エラー:', error);
            this.showNotification('同期に失敗しました', 'error');
        }
    }

    /**
     * 同期エラーハンドリング
     */
    handleSyncError(error) {
        if (error.message && error.message.includes('401')) {
            // 認証エラー：再認証要求
            this.handleInvalidToken();
        } else if (error.message && error.message.includes('403')) {
            // レート制限：一時的に同期停止
            this.showNotification('API制限のため一時停止中', 'warning');
        } else {
            // その他エラー：ログのみ
            console.log('同期エラー（オフライン継続）:', error);
        }
    }

    /**
     * 通知表示
     */
    showNotification(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // 簡易通知表示（将来的にはより洗練されたUI通知に置き換え）
        if (window.showToast) {
            window.showToast(message, type);
        }
    }
}

// グローバルインスタンス作成
window.syncManager = new SyncManager();