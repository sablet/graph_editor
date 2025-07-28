// 初期ノードリスト
const initialNodes = [
    "行き：持っていくべきものが決まってない",
    "行き：予定通りの間に合う時間に出られない", 
    "帰り：チェックアウト後片付けの手続きが決まってない",
    "帰り：飛行機乗る場合、時間をどこで潰すか決まらん",
    "長い移動がつまらない、手持ち無沙汰",
    "新幹線で食べるものを用意しておく",
    "mtgなど約束の時間に移動中になっている、目的地に時間通りにつかない",
    "移動手段の予約が取れない、またはあまりに高額である",
    "荷物が届かない",
    "交通機関の遅延・運休",
    "乗り換えの失敗"
];

// アプリケーションの状態
let nodes = [...initialNodes];
let relations = [];
let currentZoom = 1;
let isDragging = false;
let lastMousePos = { x: 0, y: 0 };
let fullscreenZoom = 1;
let isFullscreenDragging = false;
let fullscreenLastMousePos = { x: 0, y: 0 };

// Mermaidの設定
mermaid.initialize({ 
    startOnLoad: false,
    theme: 'default',
    flowchart: {
        useMaxWidth: true,
        htmlLabels: true
    }
});

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    renderNodes();
    renderSelects();
    renderRelations();
    generateMermaidCode();
    setupDiagramControls();
    setupFullscreenControls();
    
    // Ctrl+Enterキーでシングルノード追加
    document.getElementById('node-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            addSingleNode();
        }
    });
});

// 単一ノード追加（最初の行のみ使用）
function addSingleNode() {
    const nodeInput = document.getElementById('node-input');
    const inputText = nodeInput.value.trim();
    
    if (inputText === '') {
        alert('ノード名を入力してください');
        return;
    }
    
    // 最初の行のみを取得
    const firstLine = inputText.split('\n')[0].trim();
    
    if (firstLine === '') {
        alert('有効なノード名を入力してください');
        return;
    }
    
    if (nodes.includes(firstLine)) {
        alert('同じ名前のノードが既に存在します');
        return;
    }
    
    nodes.push(firstLine);
    nodeInput.value = '';
    
    renderNodes();
    renderSelects();
}

// バルクノード追加（複数行対応・確認ダイアログ付き）
function addBulkNodes() {
    const nodeInput = document.getElementById('node-input');
    const inputText = nodeInput.value.trim();
    
    if (inputText === '') {
        alert('ノード名を入力してください');
        return;
    }
    
    // 行ごとに分割し、空行を除去
    const newNodes = inputText.split('\n')
        .map(line => line.trim())
        .filter(line => line !== '');
    
    if (newNodes.length === 0) {
        alert('有効なノード名が見つかりません');
        return;
    }
    
    // 重複チェック
    const duplicates = [];
    const validNodes = [];
    
    newNodes.forEach(nodeText => {
        if (nodes.includes(nodeText)) {
            duplicates.push(nodeText);
        } else if (validNodes.includes(nodeText)) {
            // 入力内での重複もチェック
            duplicates.push(nodeText + ' (入力内重複)');
        } else {
            validNodes.push(nodeText);
        }
    });
    
    // 追加予定のノードを確認
    let confirmMessage = `以下の${validNodes.length}個のノードを追加しますか？\n\n`;
    confirmMessage += validNodes.map((node, index) => `${index + 1}. ${node}`).join('\n');
    
    if (duplicates.length > 0) {
        confirmMessage += `\n\n※ 以下は重複のため追加されません：\n${duplicates.join('\n')}`;
    }
    
    if (validNodes.length === 0) {
        alert('追加できる新しいノードがありません。\n\n重複したノード：\n' + duplicates.join('\n'));
        return;
    }
    
    // 確認ダイアログを表示
    if (confirm(confirmMessage)) {
        nodes.push(...validNodes);
        nodeInput.value = '';
        
        renderNodes();
        renderSelects();
        
        let resultMessage = `${validNodes.length}個のノードを追加しました。`;
        if (duplicates.length > 0) {
            resultMessage += `\n\n${duplicates.length}個のノードは重複のため追加されませんでした。`;
        }
        alert(resultMessage);
    }
}

// ノード削除
function deleteNode(index) {
    if (confirm(`ノード「${nodes[index]}」を削除しますか？関連するリレーションも削除されます。`)) {
        // 関連するリレーションを削除
        relations = relations.filter(rel => rel.from !== index && rel.to !== index);
        
        // インデックスを調整
        relations = relations.map(rel => ({
            from: rel.from > index ? rel.from - 1 : rel.from,
            to: rel.to > index ? rel.to - 1 : rel.to
        }));
        
        // ノードを削除
        nodes.splice(index, 1);
        
        renderNodes();
        renderSelects();
        renderRelations();
        generateMermaidCode();
    }
}

// ノード一覧を表示
function renderNodes() {
    const nodeList = document.getElementById('node-list');
    nodeList.innerHTML = '';
    
    if (nodes.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.style.color = '#6b7280';
        emptyMessage.style.textAlign = 'center';
        emptyMessage.style.padding = '20px';
        emptyMessage.textContent = 'ノードがありません';
        nodeList.appendChild(emptyMessage);
        return;
    }
    
    nodes.forEach((node, index) => {
        const nodeElement = document.createElement('div');
        nodeElement.className = 'node-item';
        nodeElement.style.display = 'flex';
        nodeElement.style.justifyContent = 'space-between';
        nodeElement.style.alignItems = 'center';
        
        const nodeText = document.createElement('span');
        nodeText.textContent = `${index + 1}. ${node}`;
        nodeText.style.flex = '1';
        nodeText.style.marginRight = '10px';
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'btn-danger';
        deleteButton.style.fontSize = '11px';
        deleteButton.style.padding = '4px 8px';
        deleteButton.textContent = '削除';
        deleteButton.onclick = () => deleteNode(index);
        
        nodeElement.appendChild(nodeText);
        nodeElement.appendChild(deleteButton);
        nodeList.appendChild(nodeElement);
    });
}

// セレクトボックスとチェックボックスを更新
function renderSelects() {
    renderFromCheckboxes();
    renderToSelect();
}

// Fromチェックボックスを描画
function renderFromCheckboxes() {
    const checkboxContainer = document.getElementById('from-checkboxes');
    checkboxContainer.innerHTML = '';
    
    nodes.forEach((node, index) => {
        const checkboxItem = document.createElement('div');
        checkboxItem.className = 'checkbox-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `from-checkbox-${index}`;
        checkbox.value = index;
        
        const label = document.createElement('label');
        label.htmlFor = `from-checkbox-${index}`;
        label.textContent = `${index + 1}. ${node}`;
        
        checkboxItem.appendChild(checkbox);
        checkboxItem.appendChild(label);
        checkboxContainer.appendChild(checkboxItem);
    });
}

// Toセレクトボックスを描画
function renderToSelect() {
    const toSelect = document.getElementById('to-select');
    const toValue = toSelect.value;
    
    toSelect.innerHTML = '<option value="">To を選択</option>';
    
    nodes.forEach((node, index) => {
        const toOption = document.createElement('option');
        toOption.value = index;
        toOption.textContent = `${index + 1}. ${node}`;
        toSelect.appendChild(toOption);
    });
    
    toSelect.value = toValue;
}

// リレーション追加
function addRelation() {
    const toSelect = document.getElementById('to-select');
    const toIndex = toSelect.value;
    
    // 選択されたFromチェックボックスを取得
    const selectedFroms = [];
    const checkboxes = document.querySelectorAll('#from-checkboxes input[type="checkbox"]:checked');
    checkboxes.forEach(checkbox => {
        selectedFroms.push(parseInt(checkbox.value));
    });
    
    if (selectedFroms.length === 0 || toIndex === '') {
        alert('FromとToの両方を選択してください');
        return;
    }
    
    // 同じノードの選択をチェック
    if (selectedFroms.includes(parseInt(toIndex))) {
        alert('FromとToに同じノードを選択することはできません');
        return;
    }
    
    // 新しいリレーションを追加
    let addedCount = 0;
    selectedFroms.forEach(fromIndex => {
        // 既存のリレーションをチェック
        const exists = relations.some(rel => 
            rel.from === fromIndex && rel.to === parseInt(toIndex)
        );
        
        if (!exists) {
            relations.push({
                from: fromIndex,
                to: parseInt(toIndex)
            });
            addedCount++;
        }
    });
    
    if (addedCount === 0) {
        alert('選択されたリレーションは既に存在します');
        return;
    }
    
    // UIを更新
    renderRelations();
    generateMermaidCode();
    
    // フォームをリセット
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    toSelect.value = '';
}

// リレーション一覧を表示（複数から一つへの形式でグループ化）
function renderRelations() {
    const relationsList = document.getElementById('relations-list');
    relationsList.innerHTML = '';
    
    if (relations.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.style.color = '#6b7280';
        emptyMessage.style.textAlign = 'center';
        emptyMessage.style.padding = '20px';
        emptyMessage.textContent = 'リレーションがありません';
        relationsList.appendChild(emptyMessage);
        return;
    }
    
    // Toノードでグループ化
    const groupedRelations = {};
    relations.forEach((relation, index) => {
        const toNode = relation.to;
        if (!groupedRelations[toNode]) {
            groupedRelations[toNode] = [];
        }
        groupedRelations[toNode].push({ ...relation, originalIndex: index });
    });
    
    // グループ化されたリレーションを表示
    Object.keys(groupedRelations).forEach(toNodeIndex => {
        const toNode = parseInt(toNodeIndex);
        const fromNodes = groupedRelations[toNode];
        
        const relationElement = document.createElement('div');
        relationElement.className = 'relation-item';
        relationElement.style.flexDirection = 'column';
        relationElement.style.alignItems = 'flex-start';
        
        const relationText = document.createElement('div');
        relationText.style.width = '100%';
        relationText.style.marginBottom = '10px';
        
        // From部分（複数の場合はリスト表示）
        const fromList = fromNodes.map(rel => 
            `<strong>${rel.from + 1}.</strong> ${nodes[rel.from]}`
        ).join('<br>');
        
        relationText.innerHTML = `
            <div style="margin-bottom: 8px;">
                ${fromList}
            </div>
            <div style="text-align: center; margin: 8px 0; color: #3b82f6; font-weight: bold;">
                ↓
            </div>
            <div style="background: #f0f9ff; padding: 8px; border-radius: 4px; border-left: 3px solid #3b82f6;">
                <strong>${toNode + 1}.</strong> ${nodes[toNode]}
            </div>
        `;
        
        // 削除ボタンコンテナ
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '5px';
        buttonContainer.style.flexWrap = 'wrap';
        buttonContainer.style.marginTop = '10px';
        
        // 個別削除ボタン
        fromNodes.forEach(rel => {
            const deleteButton = document.createElement('button');
            deleteButton.className = 'btn-danger';
            deleteButton.style.fontSize = '11px';
            deleteButton.style.padding = '4px 8px';
            deleteButton.textContent = `${rel.from + 1}→${toNode + 1} 削除`;
            deleteButton.onclick = () => deleteRelation(rel.originalIndex);
            buttonContainer.appendChild(deleteButton);
        });
        
        // 全て削除ボタン（複数ある場合のみ）
        if (fromNodes.length > 1) {
            const deleteAllButton = document.createElement('button');
            deleteAllButton.className = 'btn-danger';
            deleteAllButton.style.fontSize = '11px';
            deleteAllButton.style.padding = '4px 8px';
            deleteAllButton.style.backgroundColor = '#dc2626';
            deleteAllButton.textContent = `全て削除 (→${toNode + 1})`;
            deleteAllButton.onclick = () => {
                // 逆順で削除（インデックスのずれを防ぐため）
                const sortedIndices = fromNodes.map(rel => rel.originalIndex).sort((a, b) => b - a);
                sortedIndices.forEach(index => deleteRelation(index));
            };
            buttonContainer.appendChild(deleteAllButton);
        }
        
        relationElement.appendChild(relationText);
        relationElement.appendChild(buttonContainer);
        relationsList.appendChild(relationElement);
    });
}

// リレーション削除
function deleteRelation(index) {
    relations.splice(index, 1);
    renderRelations();
    generateMermaidCode();
}

// ノードIDを生成（Mermaid用）
function getNodeId(index) {
    return `node${index}`;
}

// ノードラベルをエスケープ
function escapeLabel(label) {
    return label.replace(/"/g, '&quot;').replace(/\n/g, '<br>');
}

// Mermaidコードを生成
function generateMermaidCode() {
    let mermaidCode = 'flowchart TD\n';
    
    // ノードを定義
    nodes.forEach((node, index) => {
        const nodeId = getNodeId(index);
        const label = escapeLabel(node);
        mermaidCode += `    ${nodeId}["${label}"]\n`;
    });
    
    // リレーションを定義
    relations.forEach(relation => {
        const fromId = getNodeId(relation.from);
        const toId = getNodeId(relation.to);
        mermaidCode += `    ${fromId} --> ${toId}\n`;
    });
    
    // コードを表示
    document.getElementById('mermaid-code').textContent = mermaidCode;
    
    // Mermaidダイアグラムを描画
    renderMermaidDiagram(mermaidCode);
}

// Mermaidダイアグラムを描画
async function renderMermaidDiagram(code) {
    const diagramElement = document.getElementById('mermaid-diagram');
    
    if (relations.length === 0) {
        diagramElement.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 40px;">リレーションを追加するとグラフが表示されます</p>';
        return;
    }
    
    try {
        // 既存の図を削除
        diagramElement.innerHTML = '';
        
        // 一意のIDを生成
        const diagramId = 'mermaid-diagram-' + Date.now();
        
        // 新しいdiv要素を作成
        const tempDiv = document.createElement('div');
        tempDiv.id = diagramId;
        diagramElement.appendChild(tempDiv);
        
        // Mermaidレンダリング（新しいAPI使用）
        const { svg } = await mermaid.render(diagramId + '-svg', code);
        tempDiv.innerHTML = svg;
        
    } catch (error) {
        console.error('Mermaid rendering error:', error);
        diagramElement.innerHTML = '<p style="color: #dc2626; text-align: center; padding: 40px;">グラフの描画でエラーが発生しました</p>';
    }
}

// ダイアグラムコントロールのセットアップ
function setupDiagramControls() {
    const container = document.getElementById('diagram-container');
    
    // マウスホイールでズーム
    container.addEventListener('wheel', function(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(currentZoom + delta);
    });
    
    // ドラッグでパン
    container.addEventListener('mousedown', function(e) {
        isDragging = true;
        lastMousePos = { x: e.clientX, y: e.clientY };
        container.style.cursor = 'grabbing';
    });
    
    container.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        
        const deltaX = e.clientX - lastMousePos.x;
        const deltaY = e.clientY - lastMousePos.y;
        
        container.scrollLeft -= deltaX;
        container.scrollTop -= deltaY;
        
        lastMousePos = { x: e.clientX, y: e.clientY };
    });
    
    container.addEventListener('mouseup', function() {
        isDragging = false;
        container.style.cursor = 'grab';
    });
    
    container.addEventListener('mouseleave', function() {
        isDragging = false;
        container.style.cursor = 'grab';
    });
}

// ズーム機能
function setZoom(zoom) {
    currentZoom = Math.max(0.1, Math.min(3, zoom));
    const diagramElement = document.getElementById('mermaid-diagram');
    diagramElement.style.transform = `scale(${currentZoom})`;
    diagramElement.style.transformOrigin = 'top left';
    document.getElementById('zoom-level').textContent = `${Math.round(currentZoom * 100)}%`;
}

function zoomIn() {
    setZoom(currentZoom + 0.2);
}

function zoomOut() {
    setZoom(currentZoom - 0.2);
}

function resetZoom() {
    setZoom(1);
    const container = document.getElementById('diagram-container');
    container.scrollLeft = 0;
    container.scrollTop = 0;
}

function fitToContainer() {
    const container = document.getElementById('diagram-container');
    const diagram = document.getElementById('mermaid-diagram');
    
    if (diagram.firstElementChild) {
        const diagramRect = diagram.firstElementChild.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        const scaleX = (containerRect.width - 30) / diagramRect.width;
        const scaleY = (containerRect.height - 30) / diagramRect.height;
        const scale = Math.min(scaleX, scaleY, 1);
        
        setZoom(scale);
        container.scrollLeft = 0;
        container.scrollTop = 0;
    }
}

// 全画面表示機能
function openFullscreen() {
    if (relations.length === 0) {
        alert('リレーションを追加してからグラフを全画面表示してください');
        return;
    }
    
    const modal = document.getElementById('fullscreen-modal');
    modal.style.display = 'flex';
    
    // 現在のMermaidコードを取得して全画面用ダイアグラムを描画
    const currentCode = document.getElementById('mermaid-code').textContent;
    renderFullscreenMermaidDiagram(currentCode);
    
    // ESCキーで閉じる
    document.addEventListener('keydown', handleFullscreenEscape);
}

function closeFullscreen() {
    const modal = document.getElementById('fullscreen-modal');
    modal.style.display = 'none';
    document.removeEventListener('keydown', handleFullscreenEscape);
    
    // 全画面用の状態をリセット
    fullscreenZoom = 1;
    const container = document.getElementById('fullscreen-diagram-container');
    container.scrollLeft = 0;
    container.scrollTop = 0;
}

function handleFullscreenEscape(e) {
    if (e.key === 'Escape') {
        closeFullscreen();
    }
}

// 全画面用Mermaidダイアグラムを描画
async function renderFullscreenMermaidDiagram(code) {
    const diagramElement = document.getElementById('fullscreen-mermaid-diagram');
    
    try {
        diagramElement.innerHTML = '';
        
        const diagramId = 'fullscreen-mermaid-diagram-' + Date.now();
        const tempDiv = document.createElement('div');
        tempDiv.id = diagramId;
        diagramElement.appendChild(tempDiv);
        
        const { svg } = await mermaid.render(diagramId + '-svg', code);
        tempDiv.innerHTML = svg;
        
        // 初期ズームを画面に合わせる
        fitToFullscreenContainer();
        
    } catch (error) {
        console.error('Fullscreen Mermaid rendering error:', error);
        diagramElement.innerHTML = '<p style="color: #dc2626; text-align: center; padding: 40px;">グラフの描画でエラーが発生しました</p>';
    }
}

// 全画面用コントロールのセットアップ
function setupFullscreenControls() {
    const container = document.getElementById('fullscreen-diagram-container');
    
    // マウスホイールでズーム
    container.addEventListener('wheel', function(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setFullscreenZoom(fullscreenZoom + delta);
    });
    
    // ドラッグでパン
    container.addEventListener('mousedown', function(e) {
        isFullscreenDragging = true;
        fullscreenLastMousePos = { x: e.clientX, y: e.clientY };
        container.style.cursor = 'grabbing';
    });
    
    container.addEventListener('mousemove', function(e) {
        if (!isFullscreenDragging) return;
        
        const deltaX = e.clientX - fullscreenLastMousePos.x;
        const deltaY = e.clientY - fullscreenLastMousePos.y;
        
        container.scrollLeft -= deltaX;
        container.scrollTop -= deltaY;
        
        fullscreenLastMousePos = { x: e.clientX, y: e.clientY };
    });
    
    container.addEventListener('mouseup', function() {
        isFullscreenDragging = false;
        container.style.cursor = 'grab';
    });
    
    container.addEventListener('mouseleave', function() {
        isFullscreenDragging = false;
        container.style.cursor = 'grab';
    });
}

// 全画面用ズーム機能
function setFullscreenZoom(zoom) {
    fullscreenZoom = Math.max(0.1, Math.min(3, zoom));
    const diagramElement = document.getElementById('fullscreen-mermaid-diagram');
    diagramElement.style.transform = `scale(${fullscreenZoom})`;
    diagramElement.style.transformOrigin = 'top left';
    document.getElementById('fullscreen-zoom-level').textContent = `${Math.round(fullscreenZoom * 100)}%`;
}

function zoomInFullscreen() {
    setFullscreenZoom(fullscreenZoom + 0.2);
}

function zoomOutFullscreen() {
    setFullscreenZoom(fullscreenZoom - 0.2);
}

function resetZoomFullscreen() {
    setFullscreenZoom(1);
    const container = document.getElementById('fullscreen-diagram-container');
    container.scrollLeft = 0;
    container.scrollTop = 0;
}

function fitToFullscreenContainer() {
    const container = document.getElementById('fullscreen-diagram-container');
    const diagram = document.getElementById('fullscreen-mermaid-diagram');
    
    if (diagram.firstElementChild) {
        const diagramRect = diagram.firstElementChild.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        const scaleX = (containerRect.width - 30) / diagramRect.width;
        const scaleY = (containerRect.height - 30) / diagramRect.height;
        const scale = Math.min(scaleX, scaleY, 1);
        
        setFullscreenZoom(scale);
        container.scrollLeft = 0;
        container.scrollTop = 0;
    }
}