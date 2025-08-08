/**
 * GitHub Gist APIデータ管理モジュール
 * プロジェクトデータのGist保存・読み込み機能を提供
 */

class GistDataManager {
    constructor(accessToken) {
        this.accessToken = accessToken;
        this.baseURL = 'https://api.github.com/gists';
        this.projectTag = 'graph-editor-project';
    }

    /**
     * Graph Editorのプロジェクト一覧を取得
     */
    async getProjects() {
        try {
            console.log('Gistからプロジェクト一覧を取得中...');
            
            const response = await fetch(this.baseURL, {
                headers: {
                    'Authorization': `token ${this.accessToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Graph-Editor-App'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const gists = await response.json();
            
            // Graph Editorプロジェクトのみフィルタ
            const projectGists = gists.filter(gist => 
                gist.description && gist.description.startsWith('Graph Editor Project:')
            );

            console.log(`${projectGists.length}件のGraph Editorプロジェクトを発見`);

            // プロジェクトデータに変換
            const projects = [];
            for (const gist of projectGists) {
                try {
                    const project = await this.loadProjectFromGist(gist.id);
                    if (project) {
                        projects.push(project);
                    }
                } catch (error) {
                    console.warn(`プロジェクト読み込み失敗 (${gist.id}):`, error);
                }
            }

            console.log(`${projects.length}件のプロジェクトを正常に読み込み`);
            return projects;
            
        } catch (error) {
            console.error('プロジェクト一覧取得エラー:', error);
            throw error;
        }
    }

    /**
     * プロジェクトをGistに保存（作成/更新）
     */
    async saveProject(projectData) {
        try {
            console.log(`プロジェクト保存中: ${projectData.name}`);
            
            const gistFiles = this.convertProjectToGistFiles(projectData);
            const gistData = {
                description: `Graph Editor Project: ${projectData.name}`,
                public: false,
                files: gistFiles
            };

            let response;
            let method;
            let url;

            if (projectData.gistId) {
                // 既存gist更新
                method = 'PATCH';
                url = `${this.baseURL}/${projectData.gistId}`;
            } else {
                // 新規gist作成
                method = 'POST';
                url = this.baseURL;
            }

            response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `token ${this.accessToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Graph-Editor-App'
                },
                body: JSON.stringify(gistData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }

            const savedGist = await response.json();
            
            // gistIDを保存（次回更新用）
            projectData.gistId = savedGist.id;
            projectData.gistUrl = savedGist.html_url;
            
            console.log(`プロジェクト保存完了: ${savedGist.id}`);
            return savedGist;
            
        } catch (error) {
            console.error('プロジェクト保存エラー:', error);
            throw error;
        }
    }

    /**
     * 特定のGistからプロジェクトデータをロード
     */
    async loadProjectFromGist(gistId) {
        try {
            const response = await fetch(`${this.baseURL}/${gistId}`, {
                headers: {
                    'Authorization': `token ${this.accessToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Graph-Editor-App'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const gist = await response.json();
            return this.convertGistToProject(gist);
            
        } catch (error) {
            console.error('プロジェクトロードエラー:', error);
            return null;
        }
    }

    /**
     * プロジェクトデータをGistファイル形式に変換
     */
    convertProjectToGistFiles(projectData) {
        const files = {};

        // プロジェクトメタデータ
        files['project-metadata.json'] = {
            content: JSON.stringify({
                id: projectData.id,
                name: projectData.name,
                description: projectData.description || '',
                createdAt: projectData.createdAt,
                updatedAt: projectData.updatedAt,
                version: projectData.version || '1.0.0',
                gistId: projectData.gistId,
                appVersion: '1.0.0' // Graph Editorのバージョン
            }, null, 2)
        };

        // コアデータファイル
        files['nodes.json'] = {
            content: JSON.stringify(projectData.data?.nodes || [], null, 2)
        };

        files['relations.json'] = {
            content: JSON.stringify(projectData.data?.relations || [], null, 2)
        };

        files['node-hierarchy.json'] = {
            content: JSON.stringify(projectData.data?.nodeHierarchy || [], null, 2)
        };

        files['node-tasks.json'] = {
            content: JSON.stringify(projectData.data?.nodeTasks || {}, null, 2)
        };

        files['node-statuses.json'] = {
            content: JSON.stringify(projectData.data?.nodeStatuses || {}, null, 2)
        };

        // コミュニケーションデータ
        files['project-chat.json'] = {
            content: JSON.stringify(projectData.data?.projectChatHistory || [], null, 2)
        };

        files['node-memos.json'] = {
            content: JSON.stringify(projectData.data?.nodeMemos || {}, null, 2)
        };

        // UI状態（デバイス固有だが共有用として保存）
        files['ui-state.json'] = {
            content: JSON.stringify({
                nodeCardCollapsed: projectData.data?.nodeCardCollapsed || {},
                nodeStatusGroupCollapsed: projectData.data?.nodeStatusGroupCollapsed || {},
                flatTaskGroupCollapsed: projectData.data?.flatTaskGroupCollapsed || {},
                lastActiveTab: projectData.data?.lastActiveTab,
                // デバイス識別用（オプション）
                lastUpdatedDevice: this.getDeviceId()
            }, null, 2)
        };

        // README.md（プロジェクト説明用、オプション）
        if (projectData.description) {
            files['README.md'] = {
                content: `# ${projectData.name}

${projectData.description}

## プロジェクト情報
- 作成日: ${new Date(projectData.createdAt).toLocaleDateString('ja-JP')}
- 更新日: ${new Date(projectData.updatedAt).toLocaleDateString('ja-JP')}
- ノード数: ${(projectData.data?.nodes || []).length}件
- リレーション数: ${(projectData.data?.relations || []).length}件

---
Generated by Graph Editor`
            };
        }

        return files;
    }

    /**
     * GistデータをプロジェクトData形式に変換
     */
    convertGistToProject(gist) {
        try {
            const files = gist.files;
            
            // メタデータ取得
            const metadata = files['project-metadata.json'] 
                ? this.safeJsonParse(files['project-metadata.json'].content, {})
                : {};

            // UI状態取得
            const uiState = files['ui-state.json']
                ? this.safeJsonParse(files['ui-state.json'].content, {})
                : {};

            const projectData = {
                id: metadata.id || this.generateProjectId(),
                name: metadata.name || this.extractNameFromDescription(gist.description) || 'Unnamed Project',
                description: metadata.description || '',
                createdAt: metadata.createdAt || gist.created_at,
                updatedAt: metadata.updatedAt || gist.updated_at,
                gistId: gist.id,
                gistUrl: gist.html_url,
                version: metadata.version || '1.0.0',
                data: {
                    // コアデータ
                    nodes: files['nodes.json'] ? this.safeJsonParse(files['nodes.json'].content, []) : [],
                    relations: files['relations.json'] ? this.safeJsonParse(files['relations.json'].content, []) : [],
                    nodeHierarchy: files['node-hierarchy.json'] ? this.safeJsonParse(files['node-hierarchy.json'].content, []) : [],
                    nodeTasks: files['node-tasks.json'] ? this.safeJsonParse(files['node-tasks.json'].content, {}) : {},
                    nodeStatuses: files['node-statuses.json'] ? this.safeJsonParse(files['node-statuses.json'].content, {}) : {},
                    
                    // コミュニケーションデータ
                    projectChatHistory: files['project-chat.json'] ? this.safeJsonParse(files['project-chat.json'].content, []) : [],
                    nodeMemos: files['node-memos.json'] ? this.safeJsonParse(files['node-memos.json'].content, {}) : {},
                    
                    // UI状態
                    nodeCardCollapsed: uiState.nodeCardCollapsed || {},
                    nodeStatusGroupCollapsed: uiState.nodeStatusGroupCollapsed || {},
                    flatTaskGroupCollapsed: uiState.flatTaskGroupCollapsed || {},
                    lastActiveTab: uiState.lastActiveTab
                }
            };

            // データ整合性チェック
            this.validateProjectData(projectData);

            return projectData;
            
        } catch (error) {
            console.error('Gist→プロジェクト変換エラー:', error);
            return null;
        }
    }

    /**
     * 安全なJSON.parse（エラー時はデフォルト値を返す）
     */
    safeJsonParse(jsonString, defaultValue = null) {
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            console.warn('JSON parse failed:', error);
            return defaultValue;
        }
    }

    /**
     * Gist descriptionからプロジェクト名を抽出
     */
    extractNameFromDescription(description) {
        if (!description) return null;
        
        const match = description.match(/Graph Editor Project:\s*(.+)/);
        return match ? match[1].trim() : null;
    }

    /**
     * プロジェクトID生成
     */
    generateProjectId() {
        return `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * デバイスID取得（簡易版）
     */
    getDeviceId() {
        // ブラウザの簡易識別子
        let deviceId = localStorage.getItem('graphEditor_deviceId');
        if (!deviceId) {
            deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('graphEditor_deviceId', deviceId);
        }
        return deviceId;
    }

    /**
     * プロジェクトデータ整合性チェック
     */
    validateProjectData(projectData) {
        const errors = [];

        // 必須フィールドチェック
        if (!projectData.id) errors.push('プロジェクトIDが未設定');
        if (!projectData.name) errors.push('プロジェクト名が未設定');

        // データ構造チェック
        if (!Array.isArray(projectData.data.nodes)) {
            projectData.data.nodes = [];
            errors.push('nodesデータを初期化');
        }

        if (!Array.isArray(projectData.data.relations)) {
            projectData.data.relations = [];
            errors.push('relationsデータを初期化');
        }

        if (typeof projectData.data.nodeTasks !== 'object') {
            projectData.data.nodeTasks = {};
            errors.push('nodeTasksデータを初期化');
        }

        if (typeof projectData.data.nodeStatuses !== 'object') {
            projectData.data.nodeStatuses = {};
            errors.push('nodeStatusesデータを初期化');
        }

        // 警告表示
        if (errors.length > 0) {
            console.warn(`プロジェクト整合性チェック (${projectData.name}):`, errors);
        }

        return errors.length === 0;
    }

    /**
     * プロジェクト削除
     */
    async deleteProject(gistId) {
        try {
            console.log(`プロジェクト削除中: ${gistId}`);
            
            const response = await fetch(`${this.baseURL}/${gistId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `token ${this.accessToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Graph-Editor-App'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            console.log(`プロジェクト削除完了: ${gistId}`);
            return true;
            
        } catch (error) {
            console.error('プロジェクト削除エラー:', error);
            throw error;
        }
    }

    /**
     * APIレート制限チェック
     */
    async checkRateLimit() {
        try {
            const response = await fetch('https://api.github.com/rate_limit', {
                headers: {
                    'Authorization': `token ${this.accessToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Graph-Editor-App'
                }
            });

            if (response.ok) {
                const data = await response.json();
                return {
                    limit: data.rate.limit,
                    remaining: data.rate.remaining,
                    resetTime: new Date(data.rate.reset * 1000)
                };
            }
            
            return null;
        } catch (error) {
            console.warn('レート制限チェック失敗:', error);
            return null;
        }
    }

    /**
     * 接続テスト
     */
    async testConnection() {
        try {
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `token ${this.accessToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Graph-Editor-App'
                }
            });

            if (response.ok) {
                const user = await response.json();
                return {
                    success: true,
                    user: {
                        login: user.login,
                        name: user.name,
                        avatar_url: user.avatar_url
                    }
                };
            } else {
                return {
                    success: false,
                    error: `HTTP ${response.status}: ${response.statusText}`
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * バックアップ用データエクスポート
     */
    async exportAllProjects() {
        try {
            const projects = await this.getProjects();
            
            const exportData = {
                exportDate: new Date().toISOString(),
                appVersion: '1.0.0',
                projectCount: projects.length,
                projects: projects
            };

            return exportData;
        } catch (error) {
            console.error('プロジェクトエクスポートエラー:', error);
            throw error;
        }
    }
}