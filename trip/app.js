// グローバル変数
let currentTeam = null;
let selectedFiles = [];
let allReports = [];

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    renderTeamGrid();
    setupFileInput();
    
    // 記憶されているチームがあれば自動選択
    const savedTeamId = localStorage.getItem('selectedTeamId');
    if (savedTeamId) {
        const team = CONFIG.teams.find(t => t.id === parseInt(savedTeamId));
        if (team) {
            selectTeam(team);
        }
    }
}

// チーム選択画面のレンダリング
function renderTeamGrid() {
    const teamGrid = document.getElementById('teamGrid');
    teamGrid.innerHTML = '';
    
    CONFIG.teams.forEach(team => {
        const teamCard = document.createElement('div');
        teamCard.className = 'team-card';
        teamCard.onclick = () => selectTeam(team);
        
        const reports = getTeamReports(team.id);
        const isCompleted = reports.length >= CONFIG.requiredReports;
        
        teamCard.innerHTML = `
            <div class="team-logo">
                <img src="${team.logo}" alt="${team.name}">
            </div>
            <div class="team-name">${team.name}</div>
            <div class="team-status ${isCompleted ? 'completed' : 'pending'}">
                ${isCompleted ? '✓ 達成済み' : `${reports.length}/${CONFIG.requiredReports} 報告`}
            </div>
        `;
        
        teamGrid.appendChild(teamCard);
    });
}

// チーム選択
function selectTeam(team) {
    currentTeam = team;
    
    // チーム選択を記憶
    localStorage.setItem('selectedTeamId', team.id);
    
    document.getElementById('currentTeamName').innerHTML = `
        <img src="${team.logo}" alt="${team.name}" class="team-logo-small">
        ${team.name}
    `;
    
    // ミッションリストを表示
    const missionList = document.getElementById('missionDescription');
    missionList.innerHTML = team.missions.map((mission, index) => `
        <div class="mission-item" onclick="toggleMission(event, ${index})">
            <input type="checkbox" id="mission-${index}" class="mission-checkbox" onclick="event.stopPropagation()">
            <span class="mission-number">${index + 1}</span>
            <span class="mission-text">${mission}</span>
        </div>
    `).join('');
    
    const reports = getTeamReports(team.id);
    document.getElementById('progressCount').textContent = reports.length;
    document.getElementById('progressTotal').textContent = CONFIG.requiredReports;
    
    showPage('uploadPage');
    loadTeamHistory();
}

// ミッションの選択トグル
function toggleMission(event, index) {
    // チェックボックス自体のクリックの場合は何もしない
    if (event.target.type === 'checkbox') {
        updateSubmitButton();
        return;
    }
    
    const checkbox = document.getElementById(`mission-${index}`);
    checkbox.checked = !checkbox.checked;
    updateSubmitButton();
}

// ファイル入力のセットアップ
function setupFileInput() {
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', handleFileSelect);
}

// ファイル選択ハンドラ
function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    
    files.forEach(file => {
        if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
            selectedFiles.push(file);
            addPreview(file);
        }
    });
    
    updateSubmitButton();
}

// プレビュー追加
function addPreview(file) {
    const previewArea = document.getElementById('previewArea');
    const reader = new FileReader();
    
    reader.onload = (e) => {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        
        if (file.type.startsWith('video/')) {
            previewItem.innerHTML = `
                <video src="${e.target.result}" controls></video>
                <div class="video-badge">🎥 動画</div>
                <button class="remove-btn" onclick="removePreview(this, '${file.name}')">×</button>
            `;
        } else {
            previewItem.innerHTML = `
                <img src="${e.target.result}" alt="Preview">
                <button class="remove-btn" onclick="removePreview(this, '${file.name}')">×</button>
            `;
        }
        
        previewArea.appendChild(previewItem);
    };
    
    reader.readAsDataURL(file);
}

// プレビュー削除
function removePreview(button, fileName) {
    selectedFiles = selectedFiles.filter(f => f.name !== fileName);
    button.parentElement.remove();
    updateSubmitButton();
}

// 送信ボタンの状態更新
function updateSubmitButton() {
    const submitBtn = document.getElementById('submitBtn');
    const hasFiles = selectedFiles.length > 0;
    const hasSelectedMission = document.querySelectorAll('.mission-checkbox:checked').length > 0;
    submitBtn.disabled = !(hasFiles && hasSelectedMission);
}

// 達成報告送信
async function submitReport() {
    if (selectedFiles.length === 0) {
        alert('写真または動画を選択してください');
        return;
    }
    
    // 選択されたミッションを取得
    const selectedMissions = [];
    document.querySelectorAll('.mission-checkbox:checked').forEach(checkbox => {
        const index = parseInt(checkbox.id.replace('mission-', ''));
        selectedMissions.push({
            index: index,
            text: currentTeam.missions[index]
        });
    });
    
    if (selectedMissions.length === 0) {
        alert('達成したミッションを選択してください');
        return;
    }
    
    const comment = document.getElementById('commentInput').value;
    
    showLoading(true);
    
    try {
        // 画像をBase64に変換
        const imageDataArray = await Promise.all(
            selectedFiles.map(file => fileToBase64(file))
        );
        
        const report = {
            teamId: currentTeam.id,
            teamName: currentTeam.name,
            timestamp: new Date().toISOString(),
            images: imageDataArray,
            comment: comment,
            missions: selectedMissions
        };
        
        // LocalStorageに保存
        await saveReport(report);
        
        // GitHub Issuesにも保存(オプション)
        if (CONFIG.github.enabled) {
            await saveToGitHub(report);
        }
        
        // リセット
        selectedFiles = [];
        document.getElementById('previewArea').innerHTML = '';
        document.getElementById('commentInput').value = '';
        document.getElementById('fileInput').value = '';
        document.querySelectorAll('.mission-checkbox').forEach(cb => cb.checked = false);
        updateSubmitButton();
        
        // 履歴を再読み込み
        loadTeamHistory();
        renderTeamGrid();
        
        alert('報告を送信しました! 🎉');
        
    } catch (error) {
        console.error('送信エラー:', error);
        alert('送信に失敗しました。もう一度お試しください。');
    } finally {
        showLoading(false);
    }
}

// ファイルをBase64に変換
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        // 動画の場合はそのまま保存
        if (file.type.startsWith('video/')) {
            reader.onload = () => {
                resolve({
                    data: reader.result,
                    name: file.name,
                    isVideo: true
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
            return;
        }
        
        // 画像の場合は圧縮
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // 最大サイズを設定
                const maxSize = 800;
                let width = img.width;
                let height = img.height;
                
                if (width > height && width > maxSize) {
                    height = (height * maxSize) / width;
                    width = maxSize;
                } else if (height > maxSize) {
                    width = (width * maxSize) / height;
                    height = maxSize;
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                resolve({
                    data: canvas.toDataURL('image/jpeg', 0.7),
                    name: file.name,
                    isVideo: false
                });
            };
            img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// レポート保存(LocalStorage)
function saveReport(report) {
    const reports = getAllReports();
    reports.push(report);
    localStorage.setItem('missionReports', JSON.stringify(reports));
}

// 全レポート取得
function getAllReports() {
    const data = localStorage.getItem('missionReports');
    return data ? JSON.parse(data) : [];
}

// チーム別レポート取得
function getTeamReports(teamId) {
    return getAllReports().filter(r => r.teamId === teamId);
}

// チーム履歴読み込み
function loadTeamHistory() {
    const historyList = document.getElementById('historyList');
    const reports = getTeamReports(currentTeam.id);
    
    if (reports.length === 0) {
        historyList.innerHTML = '<p style="text-align: center; color: #999;">まだ報告がありません</p>';
        return;
    }
    
    historyList.innerHTML = reports.reverse().map((report, index) => `
        <div class="report-item">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div class="report-time">
                    ${new Date(report.timestamp).toLocaleString('ja-JP')}
                </div>
                <button class="btn-delete" onclick="deleteReport('${report.timestamp}')">🗑️ 削除</button>
            </div>
            ${report.missions ? `
                <div class="report-missions">
                    <strong>達成ミッション:</strong>
                    ${report.missions.map(m => `<span class="mission-badge">${m.index + 1}. ${m.text}</span>`).join('')}
                </div>
            ` : ''}
            <div class="report-images">
                ${report.images.map(img => {
                    if (img.isVideo) {
                        return `<video src="${img.data}" controls></video>`;
                    } else {
                        return `<img src="${img.data}" alt="${img.name}" onclick="openImage('${img.data}')">`;
                    }
                }).join('')}
            </div>
            ${report.comment ? `<div class="report-comment">"${report.comment}"</div>` : ''}
        </div>
    `).join('');
}

// 画像を新しいタブで開く
function openImage(dataUrl) {
    window.open(dataUrl, '_blank');
}

// GitHub Issuesに保存(オプション)
async function saveToGitHub(report) {
    if (!CONFIG.github.enabled || !CONFIG.github.token) {
        return;
    }
    
    const body = `
## ${report.teamName} - ミッション報告

**日時:** ${new Date(report.timestamp).toLocaleString('ja-JP')}

**コメント:** ${report.comment || 'なし'}

**画像数:** ${report.images.length}枚

---
*画像データはLocalStorageに保存されています*
    `.trim();
    
    try {
        const response = await fetch(
            `https://api.github.com/repos/${CONFIG.github.repo}/issues`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `token ${CONFIG.github.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: `[${report.teamName}] ${new Date(report.timestamp).toLocaleDateString('ja-JP')}`,
                    body: body,
                    labels: ['mission-report', `team-${report.teamId}`]
                })
            }
        );
        
        if (!response.ok) {
            throw new Error('GitHub API error');
        }
    } catch (error) {
        console.error('GitHub保存エラー:', error);
        // エラーでも続行(LocalStorageには保存済み)
    }
}

// 管理者ページ表示
function showAdminPage() {
    showPage('adminPage');
}

// 管理者データ読み込み
function loadAdminData() {
    const password = document.getElementById('adminPassword').value;
    
    if (password !== CONFIG.adminPassword) {
        alert('パスワードが違います');
        return;
    }
    
    document.getElementById('adminContent').style.display = 'block';
    renderAdminDashboard();
}

// 管理者ダッシュボードレンダリング
function renderAdminDashboard() {
    const allReports = getAllReports();
    
    // 統計情報
    const totalReports = allReports.length;
    const completedTeams = CONFIG.teams.filter(team => 
        getTeamReports(team.id).length >= CONFIG.requiredReports
    ).length;
    const totalProgress = Math.round((completedTeams / CONFIG.teams.length) * 100);
    
    document.getElementById('totalProgress').textContent = `${totalProgress}%`;
    document.getElementById('completedTeams').textContent = 
        `${completedTeams}/${CONFIG.teams.length}`;
    
    // チーム別進捗
    const teamProgressGrid = document.getElementById('teamProgressGrid');
    teamProgressGrid.innerHTML = CONFIG.teams.map(team => {
        const reports = getTeamReports(team.id);
        const progress = Math.min((reports.length / CONFIG.requiredReports) * 100, 100);
        const isCompleted = reports.length >= CONFIG.requiredReports;
        
        return `
            <div class="team-progress-card">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                    <img src="${team.logo}" alt="${team.name}" style="width: 40px; height: 40px; object-fit: contain; border-radius: 5px;">
                    <h4 style="margin: 0;">${team.name}</h4>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%">
                        ${reports.length}/${CONFIG.requiredReports}
                    </div>
                </div>
                <p style="margin-top: 10px; color: ${isCompleted ? 'var(--success)' : 'var(--text-secondary)'}">
                    ${isCompleted ? '✓ 達成済み' : '進行中'}
                </p>
            </div>
        `;
    }).join('');
    
    // 全報告一覧
    const allReportsList = document.getElementById('allReportsList');
    if (allReports.length === 0) {
        allReportsList.innerHTML = '<p style="text-align: center; color: #999;">まだ報告がありません</p>';
    } else {
        allReportsList.innerHTML = allReports.reverse().map(report => `
            <div class="report-item">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <strong>${report.teamName}</strong>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="report-time">${new Date(report.timestamp).toLocaleString('ja-JP')}</span>
                        <button class="btn-delete-small" onclick="deleteReportAdmin('${report.timestamp}')">🗑️</button>
                    </div>
                </div>
                ${report.missions ? `
                    <div class="report-missions">
                        <strong>達成ミッション:</strong>
                        ${report.missions.map(m => `<span class="mission-badge">${m.index + 1}. ${m.text}</span>`).join('')}
                    </div>
                ` : ''}
                <div class="report-images">
                    ${report.images.map(img => {
                        if (img.isVideo) {
                            return `<video src="${img.data}" controls></video>`;
                        } else {
                            return `<img src="${img.data}" alt="${img.name}" onclick="openImage('${img.data}')">`;
                        }
                    }).join('')}
                </div>
                ${report.comment ? `<div class="report-comment">"${report.comment}"</div>` : ''}
            </div>
        `).join('');
    }
}

// 管理者画面から報告を削除
function deleteReportAdmin(timestamp) {
    if (!confirm('この報告を削除しますか?\n(この操作は取り消せません)')) {
        return;
    }
    
    const reports = getAllReports();
    const filteredReports = reports.filter(r => r.timestamp !== timestamp);
    localStorage.setItem('missionReports', JSON.stringify(filteredReports));
    
    // ダッシュボードを再読み込み
    renderAdminDashboard();
    
    alert('報告を削除しました');
}

// ページ切り替え
function showPage(pageId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

// チーム選択画面に戻る
function backToTeamSelect() {
    showPage('teamSelect');
    currentTeam = null;
    renderTeamGrid();
}

// チーム設定を変更
function changeTeam() {
    if (confirm('チームを変更しますか?')) {
        localStorage.removeItem('selectedTeamId');
        currentTeam = null;
        showPage('teamSelect');
    }
}

// 報告を削除
function deleteReport(timestamp) {
    if (!confirm('この報告を削除しますか?\n(この操作は取り消せません)')) {
        return;
    }
    
    const reports = getAllReports();
    const filteredReports = reports.filter(r => r.timestamp !== timestamp);
    localStorage.setItem('missionReports', JSON.stringify(filteredReports));
    
    // 履歴を再読み込み
    loadTeamHistory();
    renderTeamGrid();
    
    alert('報告を削除しました');
}

// ローディング表示
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.add('active');
    } else {
        overlay.classList.remove('active');
    }
}
