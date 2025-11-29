// グローバル変数
let currentTeam = null;
let selectedFiles = [];
let allReports = [];
let autoRefreshTimer = null;
let lastReportCount = 0;
let lastUpdateTime = null;

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
                // トークンの有効性を検証
                showTokenStatus('トークンを検証中...', 'success');
                const isValid = await validateGitHubToken(result);
                
                if (isValid) {
                    CONFIG.github.token = result;
                    localStorage.setItem('github_token', result);
                    showTokenStatus('✅ トークンを保存しました!', 'success');
                    setTimeout(() => {
                        modal.classList.remove('active');
                    }, 1500);
                } else {
                    showTokenStatus('⚠️ トークンが無効です。正しいQRコードをスキャンしてください', 'error');
                }
            } else {
                showTokenStatus('⚠️ GitHubトークンではありません', 'error');
            }
        } catch (err) {
            showTokenStatus('❌ QRコードの読み取りに失敗しました', 'error');
            console.error(err);
        }
        
        // ファイル入力をリセット
        e.target.value = '';
    };
    
    // スキャン成功
    async function onScanSuccess(decodedText) {
        if (decodedText.startsWith('ghp_')) {
            // トークンの有効性を検証
            showTokenStatus('トークンを検証中...', 'success');
            const isValid = await validateGitHubToken(decodedText);
            
            if (isValid) {
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
                showTokenStatus('⚠️ トークンが無効です。正しいQRコードをスキャンしてください', 'error');
            }
        } else {
            showTokenStatus('⚠️ GitHubトークンではありません', 'error');
        }
    }
}

// GitHubトークンの有効性を検証
async function validateGitHubToken(token) {
    try {
        // GitHub APIで認証テスト
        const response = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github+json'
            }
        });
        
        if (!response.ok) {
            console.error('❌ トークン検証失敗:', response.status);
            return false;
        }
        
        // レポジトリへのアクセス権も確認
        const repoResponse = await fetch(`https://api.github.com/repos/${CONFIG.github.repo}`, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github+json'
            }
        });
        
        if (!repoResponse.ok) {
            console.error('❌ レポジトリアクセス権限なし:', repoResponse.status);
            return false;
        }
        
        console.log('✅ トークン検証成功');
        return true;
    } catch (error) {
        console.error('❌ トークン検証エラー:', error);
        return false;
    }
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
    
    // 自動リフレッシュ開始(30秒ごと)
    startAutoRefresh();
}

// 自動リフレッシュを開始
function startAutoRefresh() {
    // 既存のタイマーをクリア
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
    }
    
    // 30秒ごとに自動更新
    autoRefreshTimer = setInterval(async () => {
        console.log('🔄 自動リフレッシュ実行中...');
        await refreshData(false); // 通知なしで更新
        
        // バックグラウンドで未同期レポートを同期
        await autoSyncInBackground();
    }, 30000); // 30秒
    
    console.log('✅ 自動リフレッシュ開始 (30秒ごと)');
}

// データを手動でリフレッシュ
async function manualRefresh() {
    console.log('🔄 手動リフレッシュ実行中...');
    showRefreshStatus('更新中...', 'loading');
    await refreshData(true); // 通知ありで更新
    
    // 未同期レポートも同時に同期
    await autoSyncInBackground();
}

// バックグラウンドで自動同期(表面上わからないように)
async function autoSyncInBackground() {
    try {
        const result = await syncUnsyncedReports();
        if (result.success > 0 || result.failed > 0) {
            console.log(`📤 バックグラウンド同期完了 - 成功: ${result.success}, 失敗: ${result.failed}`);
        }
    } catch (error) {
        console.error('❌ バックグラウンド同期エラー:', error);
    }
}

// データをリフレッシュ(共通処理)
async function refreshData(showNotification = false) {
    try {
        const beforeCount = lastReportCount;
        
        // 現在のページに応じて更新
        const currentPage = document.querySelector('.section.active');
        if (currentPage && currentPage.id === 'uploadPage' && currentTeam) {
            // チーム履歴を再読み込み
            await loadTeamHistory();
            
            // 進捗を更新
            const reports = await getTeamReports(currentTeam.id);
            document.getElementById('progressCount').textContent = reports.length;
            
            lastReportCount = reports.length;
        } else if (currentPage && currentPage.id === 'teamSelect') {
            // チーム選択画面を再読み込み
            await renderTeamGrid();
        }
        
        lastUpdateTime = new Date();
        
        // 新しい報告があれば通知
        if (showNotification && lastReportCount > beforeCount) {
            const newCount = lastReportCount - beforeCount;
            showRefreshStatus(`✨ 新しい報告が${newCount}件あります!`, 'success');
        } else if (showNotification) {
            showRefreshStatus('✅ 最新データを取得しました', 'success');
        }
        
        updateLastUpdateTime();
        
    } catch (error) {
        console.error('❌ リフレッシュエラー:', error);
        if (showNotification) {
            showRefreshStatus('⚠️ 更新に失敗しました', 'error');
        }
    }
}

// リフレッシュステータス表示
function showRefreshStatus(message, type) {
    // トースト通知を表示
    const toast = document.createElement('div');
    toast.className = `refresh-toast ${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#52c41a' : type === 'error' ? '#f5222d' : '#1890ff'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(toast);
    
    // 3秒後に削除
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// 最終更新時刻を表示
function updateLastUpdateTime() {
    const timeElement = document.getElementById('lastUpdateTime');
    if (timeElement && lastUpdateTime) {
        const timeStr = lastUpdateTime.toLocaleTimeString('ja-JP');
        timeElement.textContent = `最終更新: ${timeStr}`;
    }
}

// チーム選択画面のレンダリング
async function renderTeamGrid() {
    // ロックイン済みの場合はチーム選択をスキップ
    const lockedTeamId = localStorage.getItem('lockedTeamId');
    if (lockedTeamId) {
        const team = CONFIG.teams.find(t => t.id === parseInt(lockedTeamId));
        if (team) {
            await selectTeam(team);
            return;
        }
    }
    
    const teamGrid = document.getElementById('teamGrid');
    teamGrid.innerHTML = '<p style="text-align: center; color: #999;">読み込み中...</p>';
    
    const allReports = await getAllReports();
    
    teamGrid.innerHTML = '';
    
    CONFIG.teams.forEach(team => {
        const teamCard = document.createElement('div');
        teamCard.className = 'team-card';
        teamCard.onclick = () => showTeamPasswordModal(team);
        
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

// チームパスワードモーダルを表示
function showTeamPasswordModal(team) {
    const modal = document.getElementById('teamPasswordModal');
    document.getElementById('teamPasswordLogo').src = team.logo;
    document.getElementById('teamPasswordName').textContent = team.name;
    document.getElementById('teamPasswordInput').value = '';
    document.getElementById('passwordError').style.display = 'none';
    
    modal.classList.add('active');
    
    // Enterキーで送信
    const passwordInput = document.getElementById('teamPasswordInput');
    passwordInput.onkeypress = function(e) {
        if (e.key === 'Enter') {
            verifyTeamPassword(team);
        }
    };
    
    // 認証ボタン
    document.getElementById('submitTeamPassword').onclick = () => verifyTeamPassword(team);
    
    // キャンセルボタン
    document.getElementById('cancelTeamPassword').onclick = () => {
        modal.classList.remove('active');
    };
    
    // フォーカス
    setTimeout(() => passwordInput.focus(), 100);
}

// チームパスワードを検証
function verifyTeamPassword(team) {
    const input = document.getElementById('teamPasswordInput').value;
    const errorDiv = document.getElementById('passwordError');
    
    if (input === team.password) {
        // 認証成功
        localStorage.setItem('lockedTeamId', team.id);
        document.getElementById('teamPasswordModal').classList.remove('active');
        selectTeam(team);
    } else {
        // 認証失敗
        errorDiv.textContent = '⚠️ パスワードが違います';
        errorDiv.style.display = 'block';
        document.getElementById('teamPasswordInput').value = '';
        document.getElementById('teamPasswordInput').focus();
    }
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
    
    const reports = await getTeamReports(team.id);
    
    // 達成済みミッションを取得
    const completedMissions = new Set();
    reports.forEach(report => {
        if (report.missions && Array.isArray(report.missions)) {
            report.missions.forEach(m => {
                completedMissions.add(m.index);
            });
        }
    });
    
    // ミッションリストを表示（達成済みは緑色表示）
    const missionList = document.getElementById('missionDescription');
    missionList.innerHTML = team.missions.map((mission, index) => {
        const isCompleted = completedMissions.has(index);
        return `
            <div class="mission-item ${isCompleted ? 'completed' : ''}" onclick="toggleMission(event, ${index})">
                <input type="checkbox" id="mission-${index}" class="mission-checkbox" onclick="event.stopPropagation()">
                <span class="mission-number ${isCompleted ? 'completed' : ''}">${index + 1}</span>
                <span class="mission-text">${mission}</span>
            </div>
        `;
    }).join('');
    
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
        if (file.type.startsWith('image/')) {
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
        
        previewItem.innerHTML = `
            <img src="${e.target.result}" alt="Preview">
            <button class="remove-btn" onclick="removePreview(this, '${file.name}')">×</button>
        `;
        
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
        alert('写真を選択してください');
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
    
    // トークンチェック:トークンがない場合は入力を促す
    if (CONFIG.github.enabled && !CONFIG.github.token) {
        const needToken = await requestTokenIfNeeded();
        if (!needToken) {
            // ユーザーがキャンセルした場合でもローカル保存は継続
            console.warn('⚠️ トークンなしでローカル保存のみ実行します');
        }
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
            missions: selectedMissions,
            syncStatus: 'pending' // 同期待ち
        };
        
        // LocalStorageに保存
        await saveReport(report);
        
        // GitHub Issuesにも保存(オプション)
        if (CONFIG.github.enabled && CONFIG.github.token) {
            const syncSuccess = await saveToGitHub(report);
            if (syncSuccess) {
                report.syncStatus = 'synced';
                await updateReportSyncStatus(report.timestamp, 'synced');
            } else {
                report.syncStatus = 'failed';
                await updateReportSyncStatus(report.timestamp, 'failed');
                // エラーログを送信
                await sendErrorLog('GitHub送信失敗', report);
            }
        } else {
            report.syncStatus = 'local-only';
            await updateReportSyncStatus(report.timestamp, 'local-only');
            // トークンなしの場合はエラーログ送信不可(トークンが必要なため)
            console.warn('⚠️ トークンなしでローカル保存のみ実行されました');
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
async function saveReport(report) {
    try {
        const localData = localStorage.getItem('missionReports');
        let reports = [];
        
        if (localData) {
            try {
                reports = JSON.parse(localData);
                // 配列でない場合は空配列に初期化
                if (!Array.isArray(reports)) {
                    console.warn('⚠️ LocalStorageのデータが配列ではありません。初期化します。');
                    reports = [];
                }
            } catch (parseError) {
                console.error('❌ LocalStorageのJSON解析エラー:', parseError);
                console.warn('⚠️ LocalStorageを初期化します。');
                reports = [];
            }
        }
        
        reports.push(report);
        localStorage.setItem('missionReports', JSON.stringify(reports));
        console.log('✅ レポート保存完了:', reports.length, '件');
    } catch (error) {
        console.error('❌ レポート保存エラー:', error);
        throw error;
    }
}

// 全レポート取得(LocalStorage + GitHub Issues)
async function getAllReports() {
    // ロックイン済みチームを取得
    const lockedTeamId = localStorage.getItem('lockedTeamId');
    
    // LocalStorageのデータ
    const localData = localStorage.getItem('missionReports');
    let localReports = localData ? JSON.parse(localData) : [];
    
    // ロックイン済みの場合は自チームのみ
    if (lockedTeamId) {
        localReports = localReports.filter(r => r.teamId === parseInt(lockedTeamId));
    }
    
    console.log('📦 LocalStorageレポート数:', localReports.length, lockedTeamId ? `(チーム${lockedTeamId}のみ)` : '');
    
    // GitHub Issuesからも取得
    if (CONFIG.github.enabled && CONFIG.github.token) {
        console.log('🔄 GitHub Issuesから取得開始...');
        try {
            const githubReports = await fetchGitHubReports(lockedTeamId);
            console.log('📡 GitHub Issuesレポート数:', githubReports.length);
            
            // GitHub優先で重複を除去してマージ
            // 1. まずGitHubのレポートを全て追加
            const allReports = [...githubReports];
            
            // 2. LocalStorageのレポートのうち、GitHubに存在しないもののみ追加
            let addedCount = 0;
            localReports.forEach(localReport => {
                // timestampを秒単位で比較(ミリ秒の違いを吸収)
                const localTime = Math.floor(new Date(localReport.timestamp).getTime() / 1000);
                const isDuplicate = githubReports.some(ghReport => {
                    const ghTime = Math.floor(new Date(ghReport.timestamp).getTime() / 1000);
                    // 同じチーム、同じ秒(±5秒の誤差許容)なら重複と判定
                    return ghReport.teamId === localReport.teamId && Math.abs(ghTime - localTime) <= 5;
                });
                
                if (!isDuplicate) {
                    allReports.push(localReport);
                    addedCount++;
                }
            });
            
            console.log('✅ 統合完了 - GitHub優先:', githubReports.length, ', ローカルのみ:', addedCount, ', 合計:', allReports.length);

            
            return allReports.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        } catch (error) {
            console.error('❌ GitHub Issuesの取得エラー:', error);
            return localReports;
        }
    } else {
        console.log('⚠️ GitHub連携が無効です');
    }
    
    return localReports;
}

// GitHub Issuesから報告を取得
async function fetchGitHubReports(filterTeamId = null) {
    // チームフィルタ用のラベル
    let labelsParam = 'mission-report';
    if (filterTeamId) {
        labelsParam += `,team-${filterTeamId}`;
    }
    
    const url = `https://api.github.com/repos/${CONFIG.github.repo}/issues?labels=${labelsParam}&state=all&per_page=100`;
    console.log('🌐 GitHub API呼び出し:', url);
    
    const response = await fetch(url, {
        headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `token ${CONFIG.github.token}`
        }
    });
    
    if (!response.ok) {
        console.error('❌ GitHub APIエラー - ステータス:', response.status);
        const errorText = await response.text();
        console.error('エラー詳細:', errorText);
        throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const issues = await response.json();
    console.log('📝 取得したIssue数:', issues.length);
    
    const reports = [];
    
    for (const issue of issues) {
        try {
            console.log('🔍 Issue解析中:', issue.title);
            
            // Issueのタイトルからチーム名を抽出
            const teamMatch = issue.title.match(/【(.+?)】/);
            if (!teamMatch) {
                console.warn('⚠️ チーム名が見つかりません:', issue.title);
                continue;
            }
            
            const teamName = teamMatch[1];
            const team = CONFIG.teams.find(t => t.name === teamName);
            if (!team) {
                console.warn('⚠️ 該当チームが存在しません:', teamName);
                continue;
            }
            
            // Issue本文からデータを抽出
            const report = parseIssueBody(issue, team);
            if (report) {
                console.log('✅ レポート解析成功:', teamName, new Date(report.timestamp).toLocaleString());
                reports.push(report);
            } else {
                console.warn('⚠️ レポート解析失敗:', issue.title);
            }
        } catch (error) {
            console.error('❌ Issue解析エラー:', issue.title, error);
        }
    }
    
    console.log('📊 解析完了 - 有効なレポート数:', reports.length);
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
    
    console.log('📂 チーム履歴読み込み開始:', currentTeam.name);
    const reports = await getTeamReports(currentTeam.id);
    console.log('📊 このチームのレポート数:', reports.length);
    
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
            </div>
            ${report.missions ? `
                <div class="report-missions">                    
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

// レポート削除機能は削除されました（重複ミッションも正しく扱えるため不要）

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
        return false; // 失敗として扱う
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
        return true; // 成功
        
    } catch (error) {
        console.error('❌ GitHub保存エラー:', error);
        console.warn('⚠️ GitHub Issuesへの保存に失敗しましたが、ローカルには保存されています。');
        return false; // 失敗
    }
}

// ページ切り替え
function showPage(pageId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

// チーム設定を変更
function changeTeam() {
    // 管理者パスワードモーダルを表示
    showAdminPasswordModal();
}

// 管理者パスワードモーダルを表示
function showAdminPasswordModal() {
    const modal = document.getElementById('adminPasswordModal');
    document.getElementById('adminPasswordInput').value = '';
    document.getElementById('adminPasswordError').style.display = 'none';
    
    modal.classList.add('active');
    
    // Enterキーで送信
    const passwordInput = document.getElementById('adminPasswordInput');
    passwordInput.onkeypress = function(e) {
        if (e.key === 'Enter') {
            verifyAdminPassword();
        }
    };
    
    // 認証ボタン
    document.getElementById('submitAdminPassword').onclick = verifyAdminPassword;
    
    // キャンセルボタン
    document.getElementById('cancelAdminPassword').onclick = () => {
        modal.classList.remove('active');
    };
    
    // フォーカス
    setTimeout(() => passwordInput.focus(), 100);
}

// 管理者パスワードを検証してチーム変更を許可
function verifyAdminPassword() {
    const input = document.getElementById('adminPasswordInput').value;
    const errorDiv = document.getElementById('adminPasswordError');
    const modal = document.getElementById('adminPasswordModal');
    
    if (input === CONFIG.adminPassword) {
        // 認証成功
        modal.classList.remove('active');
        
        // ロックイン解除
        localStorage.removeItem('lockedTeamId');
        localStorage.removeItem('selectedTeamId');
        
        // チーム選択画面に戻る
        currentTeam = null;
        showPage('teamSelect');
        renderTeamGrid();
        
        alert('✅ チーム変更が許可されました。\n新しいチームを選択してください。');
    } else {
        // 認証失敗
        errorDiv.textContent = '⚠️ 管理者パスワードが違います';
        errorDiv.style.display = 'block';
        document.getElementById('adminPasswordInput').value = '';
        document.getElementById('adminPasswordInput').focus();
    }
}

// 報告を削除
async function deleteReport(timestamp) {
    if (!confirm('この報告を削除しますか?\n(この操作は取り消せません)')) {
        return;
    }
    
    const localData = localStorage.getItem('missionReports');
    const reports = localData ? JSON.parse(localData) : [];
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

// トークンが必要な場合にリクエスト
function requestTokenIfNeeded() {
    return new Promise((resolve) => {
        if (CONFIG.github.token) {
            resolve(true);
            return;
        }
        
        const modal = document.getElementById('tokenModal');
        if (!modal) {
            resolve(false);
            return;
        }
        
        // モーダルを表示
        showTokenModal();
        
        // モーダルが閉じられるのを監視
        const checkInterval = setInterval(() => {
            if (!modal.classList.contains('active')) {
                clearInterval(checkInterval);
                resolve(!!CONFIG.github.token);
            }
        }, 500);
        
        // 30秒後にタイムアウト
        setTimeout(() => {
            clearInterval(checkInterval);
            resolve(!!CONFIG.github.token);
        }, 30000);
    });
}

// レポートの同期ステータスを更新
async function updateReportSyncStatus(timestamp, status) {
    try {
        const localData = localStorage.getItem('missionReports');
        if (!localData) return;
        
        const reports = JSON.parse(localData);
        const report = reports.find(r => r.timestamp === timestamp);
        if (report) {
            report.syncStatus = status;
            localStorage.setItem('missionReports', JSON.stringify(reports));
            console.log(`✅ 同期ステータス更新: ${status}`);
        }
    } catch (error) {
        console.error('❌ 同期ステータス更新エラー:', error);
    }
}

// 未同期レポートを取得
function getUnsyncedReports() {
    try {
        const localData = localStorage.getItem('missionReports');
        if (!localData) return [];
        
        const reports = JSON.parse(localData);
        // syncStatusがない(古い報告)か、syncedでない報告を全て取得
        return reports.filter(r => !r.syncStatus || r.syncStatus !== 'synced');
    } catch (error) {
        console.error('❌ 未同期レポート取得エラー:', error);
        return [];
    }
}

// 未同期レポートを自動同期
async function syncUnsyncedReports() {
    if (!CONFIG.github.enabled || !CONFIG.github.token) {
        console.log('⚠️ GitHub連携が無効、または トークンがありません');
        return {success: 0, failed: 0};
    }
    
    const unsyncedReports = getUnsyncedReports();
    if (unsyncedReports.length === 0) {
        console.log('✅ 未同期レポートはありません');
        return {success: 0, failed: 0};
    }
    
    console.log(`🔄 ${unsyncedReports.length}件の未同期レポートを送信中...`);
    
    let successCount = 0;
    let failedCount = 0;
    
    for (const report of unsyncedReports) {
        try {
            const success = await saveToGitHub(report);
            if (success) {
                await updateReportSyncStatus(report.timestamp, 'synced');
                successCount++;
            } else {
                await updateReportSyncStatus(report.timestamp, 'failed');
                failedCount++;
            }
            // API制限対策で少し待機
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error('❌ 同期エラー:', error);
            failedCount++;
        }
    }
    
    console.log(`✅ 同期完了 - 成功: ${successCount}, 失敗: ${failedCount}`);
    return {success: successCount, failed: failedCount};
}

// エラーログをGitHubに送信(匿名化)
async function sendErrorLog(errorType, report) {
    if (!CONFIG.github.enabled || !CONFIG.github.token) {
        return;
    }
    
    try {
        // 匿名化されたエラー情報
        const errorInfo = {
            type: errorType,
            timestamp: new Date().toISOString(),
            teamId: report.teamId,
            browser: navigator.userAgent,
            hasToken: !!CONFIG.github.token,
            reportTimestamp: report.timestamp,
            imageCount: report.images?.length || 0,
            missionCount: report.missions?.length || 0
        };
        
        const title = `[エラーログ] ${errorType} - ${new Date().toLocaleDateString('ja-JP')}`;
        const body = `## 同期エラーログ (自動送信)

**エラー種別:** ${errorType}
**発生日時:** ${errorInfo.timestamp}
**チームID:** ${errorInfo.teamId}
**ブラウザ情報:** ${errorInfo.browser}
**トークン有無:** ${errorInfo.hasToken ? '有' : '無'}
**レポート日時:** ${errorInfo.reportTimestamp}
**画像数:** ${errorInfo.imageCount}
**ミッション数:** ${errorInfo.missionCount}

---
*このログは自動送信されています*`;
        
        const labels = 'error-log,auto-generated';
        
        // GitHub Actions経由で送信
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
        
        if (response.ok) {
            console.log('📝 エラーログをGitHubに送信しました');
        }
    } catch (error) {
        console.error('❌ エラーログ送信失敗:', error);
        // エラーログの送信失敗は無視(無限ループ防止)
    }
}
