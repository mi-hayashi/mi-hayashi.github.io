// グローバル変数
let currentTeam = null;
let selectedFiles = [];
let allReports = [];

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

// トークンをLocalStorageから取得または初回入力
function decodeToken() {
    // LocalStorageからトークンを取得
    const savedToken = localStorage.getItem('github_token');
    
    if (savedToken) {
        CONFIG.github.token = savedToken;
        console.log('✅ GitHubトークン読み込み成功');
    } else if (CONFIG.github.enabled) {
        // トークン設定モーダルを表示
        showTokenModal();
    }
}

// トークン設定モーダルを表示
function showTokenModal() {
    const modal = document.getElementById('tokenModal');
    modal.classList.add('active');
    
    let html5QrCode = null;
    
    // QRスキャン開始
    document.getElementById('startQRScan').onclick = async function() {
        const qrReader = document.getElementById('qrReader');
        qrReader.style.display = 'block';
        this.disabled = true;
        this.textContent = 'スキャン中...';
        
        html5QrCode = new Html5Qrcode("qrReader");
        
        try {
            await html5QrCode.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                onScanSuccess,
                () => {} // エラーは無視
            );
        } catch (err) {
            showTokenStatus('カメラの起動に失敗しました', 'error');
            qrReader.style.display = 'none';
            this.disabled = false;
            this.textContent = '📷 カメラでスキャン';
        }
    };
    
    // QRコード画像アップロード
    document.getElementById('uploadQRImage').onclick = function() {
        document.getElementById('qrImageInput').click();
    };
    
    document.getElementById('qrImageInput').onchange = async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        showTokenStatus('QRコードを解析中...', 'success');
        
        try {
            const html5QrCodeScanner = new Html5Qrcode("qrReader");
            const result = await html5QrCodeScanner.scanFile(file, true);
            
            if (result && result.startsWith('ghp_')) {
                CONFIG.github.token = result;
                localStorage.setItem('github_token', result);
                showTokenStatus('✅ トークンを保存しました!', 'success');
                setTimeout(() => {
                    modal.classList.remove('active');
                }, 1500);
            } else {
                showTokenStatus('⚠️ 無効なトークンです', 'error');
            }
        } catch (err) {
            showTokenStatus('❌ QRコードの読み取りに失敗しました', 'error');
            console.error(err);
        }
        
        // ファイル入力をリセット
        e.target.value = '';
    };
    
    // スキャン成功
    function onScanSuccess(decodedText) {
        if (decodedText.startsWith('ghp_')) {
            CONFIG.github.token = decodedText;
            localStorage.setItem('github_token', decodedText);
            
            if (html5QrCode) {
                html5QrCode.stop();
            }
            
            showTokenStatus('✅ トークンを保存しました!', 'success');
            setTimeout(() => {
                modal.classList.remove('active');
            }, 1500);
        } else {
            showTokenStatus('⚠️ 無効なトークンです', 'error');
        }
    }
    
    // スキップボタン
    document.getElementById('skipToken').onclick = function() {
        CONFIG.github.enabled = false;
        modal.classList.remove('active');
        if (html5QrCode) {
            html5QrCode.stop();
        }
    };
}

// トークンステータス表示
function showTokenStatus(message, type) {
    const status = document.getElementById('tokenStatus');
    status.textContent = message;
    status.className = type;
}

function initializeApp() {
    // トークンをデコード
    decodeToken();
    
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
async function renderTeamGrid() {
    const teamGrid = document.getElementById('teamGrid');
    teamGrid.innerHTML = '<p style="text-align: center; color: #999;">読み込み中...</p>';
    
    const allReports = await getAllReports();
    
    teamGrid.innerHTML = '';
    
    CONFIG.teams.forEach(team => {
        const teamCard = document.createElement('div');
        teamCard.className = 'team-card';
        teamCard.onclick = () => selectTeam(team);
        
        const reports = allReports.filter(r => r.teamId === team.id);
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
async function selectTeam(team) {
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
    
    const reports = await getTeamReports(team.id);
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
            // 動画のサイズチェック
            if (file.type.startsWith('video/')) {
                const maxSize = 10 * 1024 * 1024; // 10MB
                if (file.size > maxSize) {
                    alert(`${file.name} は大きすぎます。\n動画は10MB以下にしてください。`);
                    return;
                }
            }
            
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
        
        // 動画の場合
        if (file.type.startsWith('video/')) {
            // 動画サイズをチェック (10MB制限)
            const maxSize = 10 * 1024 * 1024; // 10MB
            if (file.size > maxSize) {
                reject(new Error('動画ファイルが大きすぎます。10MB以下の動画を選択してください。'));
                return;
            }
            
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

// 全レポート取得(LocalStorage + GitHub Issues)
async function getAllReports() {
    // LocalStorageのデータ
    const localData = localStorage.getItem('missionReports');
    const localReports = localData ? JSON.parse(localData) : [];
    
    // GitHub Issuesからも取得
    if (CONFIG.github.enabled && CONFIG.github.token) {
        try {
            const githubReports = await fetchGitHubReports();
            
            // 重複を除去してマージ
            const allReports = [...localReports];
            githubReports.forEach(ghReport => {
                // timestampで重複チェック
                if (!allReports.find(r => r.timestamp === ghReport.timestamp)) {
                    allReports.push(ghReport);
                }
            });
            
            return allReports.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        } catch (error) {
            console.error('GitHub Issuesの取得エラー:', error);
            return localReports;
        }
    }
    
    return localReports;
}

// GitHub Issuesから報告を取得
async function fetchGitHubReports() {
    const response = await fetch(
        `https://api.github.com/repos/${CONFIG.github.repo}/issues?labels=mission-report&state=all&per_page=100`,
        {
            headers: {
                'Accept': 'application/vnd.github+json',
                'Authorization': `token ${CONFIG.github.token}`
            }
        }
    );
    
    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const issues = await response.json();
    const reports = [];
    
    for (const issue of issues) {
        try {
            // Issueのタイトルからチーム名を抽出
            const teamMatch = issue.title.match(/【(.+?)】/);
            if (!teamMatch) continue;
            
            const teamName = teamMatch[1];
            const team = CONFIG.teams.find(t => t.name === teamName);
            if (!team) continue;
            
            // Issue本文からデータを抽出
            const report = parseIssueBody(issue, team);
            if (report) {
                reports.push(report);
            }
        } catch (error) {
            console.error('Issue解析エラー:', error);
        }
    }
    
    return reports;
}

// Issue本文をパースして報告データに変換
function parseIssueBody(issue, team) {
    try {
        const body = issue.body;
        
        // 日時を抽出
        const dateMatch = body.match(/\*\*日時:\*\* (.+)/);
        const timestamp = dateMatch ? new Date(dateMatch[1]).toISOString() : issue.created_at;
        
        // コメントを抽出
        const commentMatch = body.match(/\*\*コメント:\*\* (.+)/);
        const comment = commentMatch ? commentMatch[1] : '';
        
        // ミッションを抽出
        const missionsSection = body.match(/\*\*達成したミッション:\*\*\n([\s\S]+?)\n\n/);
        const missions = [];
        if (missionsSection) {
            const missionLines = missionsSection[1].split('\n');
            missionLines.forEach(line => {
                const match = line.match(/- (\d+)\. (.+)/);
                if (match) {
                    missions.push({
                        index: parseInt(match[1]) - 1,
                        text: match[2]
                    });
                }
            });
        }
        
        // 画像を抽出
        const images = [];
        const imageMatches = body.matchAll(/!\[.+?\]\((data:image[^)]+)\)/g);
        for (const match of imageMatches) {
            images.push({
                data: match[1],
                name: 'image.jpg',
                isVideo: false
            });
        }
        
        return {
            teamId: team.id,
            teamName: team.name,
            timestamp: timestamp,
            images: images.length > 0 ? images : [{ data: '', name: '', isVideo: false }],
            comment: comment,
            missions: missions,
            fromGitHub: true  // GitHub由来のフラグ
        };
    } catch (error) {
        console.error('Issue解析エラー:', error);
        return null;
    }
}

// チーム別レポート取得
async function getTeamReports(teamId) {
    const allReports = await getAllReports();
    return allReports.filter(r => r.teamId === teamId);
}

// チーム履歴読み込み
async function loadTeamHistory() {
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '<p style="text-align: center; color: #999;">読み込み中...</p>';
    
    const reports = await getTeamReports(currentTeam.id);
    
    if (reports.length === 0) {
        historyList.innerHTML = '<p style="text-align: center; color: #999;">まだ報告がありません</p>';
        return;
    }
    
    historyList.innerHTML = reports.reverse().map((report, index) => `
        <div class="report-item">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div class="report-time">
                    ${new Date(report.timestamp).toLocaleString('ja-JP')}
                    ${report.fromGitHub ? '<span style="color: #28a745; font-size: 0.8em;"> 📡 GitHub</span>' : ''}
                </div>
                ${!report.fromGitHub ? `<button class="btn-delete" onclick="deleteReport('${report.timestamp}')">🗑️ 削除</button>` : ''}
            </div>
            ${report.missions ? `
                <div class="report-missions">
                    <strong>達成ミッション:</strong>
                    ${report.missions.map(m => `<span class="mission-badge">${m.index + 1}. ${m.text}</span>`).join('')}
                </div>
            ` : ''}
            <div class="report-images">
                ${report.images.filter(img => img.data).map(img => {
                    if (img.isVideo) {
                        return `<video src="${img.data}" onclick="openVideo('${img.data}'); event.stopPropagation();"></video>`;
                    } else {
                        return `<img src="${img.data}" alt="${img.name}" onclick="openImage('${img.data}'); event.stopPropagation();">`;
                    }
                }).join('')}
            </div>
            ${report.comment && report.comment !== 'なし' ? `<div class="report-comment">"${report.comment}"</div>` : ''}
        </div>
    `).join('');
}

// 画像を拡大表示
function openImage(dataUrl) {
    const modal = document.getElementById('mediaModal');
    const modalImg = document.getElementById('modalImage');
    const modalVideo = document.getElementById('modalVideo');
    
    modalImg.src = dataUrl;
    modalImg.style.display = 'block';
    modalVideo.style.display = 'none';
    modal.style.display = 'flex';
}

// 動画を再生
function openVideo(dataUrl) {
    const modal = document.getElementById('mediaModal');
    const modalImg = document.getElementById('modalImage');
    const modalVideo = document.getElementById('modalVideo');
    
    modalVideo.src = dataUrl;
    modalVideo.style.display = 'block';
    modalImg.style.display = 'none';
    modal.style.display = 'flex';
}

// モーダルを閉じる
function closeModal() {
    const modal = document.getElementById('mediaModal');
    const modalVideo = document.getElementById('modalVideo');
    
    modal.style.display = 'none';
    modalVideo.pause();
    modalVideo.src = '';
}

// GitHub Actionsを使ってIssueを作成
async function saveToGitHub(report) {
    if (!CONFIG.github.enabled || !CONFIG.github.token) {
        console.log('GitHub連携が無効です');
        return;
    }
    
    // ミッション情報を整形
    const missionsText = report.missions 
        ? report.missions.map(m => `- ${m.index + 1}. ${m.text}`).join('\\n')
        : 'なし';
    
    // 画像を本文に埋め込む(Base64形式)
    const imagesText = report.images.map((img, index) => {
        if (img.isVideo) {
            return `### 動画 ${index + 1}: ${img.name}\\n\\n⚠️ 動画は容量が大きいためGitHub Issuesには含まれていません。LocalStorageで確認してください。\\n`;
        } else {
            return `### 画像 ${index + 1}: ${img.name}\\n\\n![${img.name}](${img.data})\\n`;
        }
    }).join('\\n');
    
    const title = `【${report.teamName}】${new Date(report.timestamp).toLocaleDateString('ja-JP')} ミッション報告`;
    const body = `## ${report.teamName} - ミッション達成報告

**日時:** ${new Date(report.timestamp).toLocaleString('ja-JP')}

**達成したミッション:**
${missionsText}

**コメント:** ${report.comment || 'なし'}

---

## 📸 アップロード画像・動画

${imagesText}

---
*このレポートは社員旅行ミッション管理システムから自動投稿されました*`;

    const labels = `mission-report,team-${report.teamId}`;
    
    try {
        // GitHub Actions workflow_dispatch を呼び出す
        const response = await fetch(
            `https://api.github.com/repos/${CONFIG.github.repo}/actions/workflows/create_issue.yml/dispatches`,
            {
                method: 'POST',
                headers: {
                    'Accept': 'application/vnd.github+json',
                    'Authorization': `token ${CONFIG.github.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ref: 'main',
                    inputs: {
                        title: title,
                        body: body,
                        labels: labels
                    }
                })
            }
        );
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('GitHub Actions エラー詳細:', errorData);
            throw new Error(`GitHub Actions error: ${response.status}`);
        }
        
        console.log('✅ GitHub Actionsトリガー成功 - 数秒後にIssueが作成されます');
        
    } catch (error) {
        console.error('❌ GitHub保存エラー:', error);
        alert('⚠️ GitHub Issuesへの保存に失敗しましたが、ローカルには保存されています。');
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
async function renderAdminDashboard() {
    // ローディング表示
    document.getElementById('teamProgressGrid').innerHTML = '<p style="text-align: center; color: #999;">読み込み中...</p>';
    document.getElementById('allReportsList').innerHTML = '<p style="text-align: center; color: #999;">読み込み中...</p>';
    
    const allReports = await getAllReports();
    
    // 統計情報
    const totalReports = allReports.length;
    
    // チーム別に集計
    const teamReportCounts = {};
    CONFIG.teams.forEach(team => {
        teamReportCounts[team.id] = allReports.filter(r => r.teamId === team.id).length;
    });
    
    const completedTeams = CONFIG.teams.filter(team => 
        teamReportCounts[team.id] >= CONFIG.requiredReports
    ).length;
    const totalProgress = Math.round((completedTeams / CONFIG.teams.length) * 100);
    
    document.getElementById('totalProgress').textContent = `${totalProgress}%`;
    document.getElementById('completedTeams').textContent = 
        `${completedTeams}/${CONFIG.teams.length}`;
    
    // チーム別進捗
    const teamProgressGrid = document.getElementById('teamProgressGrid');
    teamProgressGrid.innerHTML = CONFIG.teams.map(team => {
        const reports = teamReportCounts[team.id];
        const progress = Math.min((reports / CONFIG.requiredReports) * 100, 100);
        const isCompleted = reports >= CONFIG.requiredReports;
        
        return `
            <div class="team-progress-card">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                    <img src="${team.logo}" alt="${team.name}" style="width: 40px; height: 40px; object-fit: contain; border-radius: 5px;">
                    <h4 style="margin: 0;">${team.name}</h4>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%">
                        ${reports}/${CONFIG.requiredReports}
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
                    <strong>${report.teamName} ${report.fromGitHub ? '<span style="color: #28a745; font-size: 0.8em;">📡 GitHub</span>' : ''}</strong>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="report-time">${new Date(report.timestamp).toLocaleString('ja-JP')}</span>
                        ${!report.fromGitHub ? `<button class="btn-delete-small" onclick="deleteReportAdmin('${report.timestamp}')">🗑️</button>` : ''}
                    </div>
                </div>
                ${report.missions ? `
                    <div class="report-missions">
                        <strong>達成ミッション:</strong>
                        ${report.missions.map(m => `<span class="mission-badge">${m.index + 1}. ${m.text}</span>`).join('')}
                    </div>
                ` : ''}
                <div class="report-images">
                    ${report.images.filter(img => img.data).map(img => {
                        if (img.isVideo) {
                            return `<video src="${img.data}" onclick="openVideo('${img.data}'); event.stopPropagation();"></video>`;
                        } else {
                            return `<img src="${img.data}" alt="${img.name}" onclick="openImage('${img.data}'); event.stopPropagation();">`;
                        }
                    }).join('')}
                </div>
                ${report.comment && report.comment !== 'なし' ? `<div class="report-comment">"${report.comment}"</div>` : ''}
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
