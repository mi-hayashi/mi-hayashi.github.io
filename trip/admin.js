// グローバル変数
let isAdminLoggedIn = false;
let autoRefreshTimer = null;
let lastReportCount = 0;
let lastUpdateTime = null;

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    decodeToken();
    
    // Enterキーでログイン
    document.getElementById('adminPassword').onkeypress = function(e) {
        if (e.key === 'Enter') {
            adminLogin();
        }
    };
});

// トークンをLocalStorageから取得または初回入力
function decodeToken() {
    const savedToken = localStorage.getItem('github_token');
    
    if (savedToken) {
        CONFIG.github.token = savedToken;
        console.log('✅ GitHubトークン読み込み成功');
    } else if (CONFIG.github.enabled) {
        showTokenModal();
    }
}

// トークン設定モーダルを表示
function showTokenModal() {
    const modal = document.getElementById('tokenModal');
    modal.classList.add('active');
    
    let html5QrCode = null;
    
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
                () => {}
            );
        } catch (err) {
            showTokenStatus('カメラの起動に失敗しました', 'error');
            qrReader.style.display = 'none';
            this.disabled = false;
            this.textContent = '📷 カメラでスキャン';
        }
    };
    
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
        
        e.target.value = '';
    };
    
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

// 管理者ログイン
function adminLogin() {
    const password = document.getElementById('adminPassword').value;
    const errorDiv = document.getElementById('loginError');
    
    if (password === CONFIG.adminPassword) {
        isAdminLoggedIn = true;
        document.getElementById('loginSection').classList.remove('active');
        document.getElementById('dashboardSection').classList.add('active');
        loadDashboard();
    } else {
        errorDiv.textContent = '⚠️ パスワードが違います';
        errorDiv.style.display = 'block';
        document.getElementById('adminPassword').value = '';
    }
}

// ダッシュボード読み込み
async function loadDashboard() {
    showLoading(true);
    await renderAdminDashboard();
    showLoading(false);
    
    // 自動リフレッシュ開始
    startAutoRefresh();
}

// 自動リフレッシュを開始
function startAutoRefresh() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
    }
    
    autoRefreshTimer = setInterval(async () => {
        console.log('🔄 管理者ダッシュボード自動更新中...');
        await refreshData(false);
    }, 30000);
    
    console.log('✅ 自動リフレッシュ開始 (30秒ごと)');
}

// データを手動でリフレッシュ
async function manualRefresh() {
    console.log('🔄 手動リフレッシュ実行中...');
    showRefreshStatus('更新中...', 'loading');
    await refreshData(true);
}

// データをリフレッシュ
async function refreshData(showNotification = false) {
    try {
        const beforeCount = lastReportCount;
        
        await renderAdminDashboard();
        
        const allReports = await getAllReports();
        lastReportCount = allReports.length;
        lastUpdateTime = new Date();
        
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

// 全レポート取得(管理者用 - 全チームのデータ)
async function getAllReports() {
    const localData = localStorage.getItem('missionReports');
    const localReports = localData ? JSON.parse(localData) : [];
    
    console.log('📦 LocalStorageレポート数:', localReports.length);
    
    if (CONFIG.github.enabled && CONFIG.github.token) {
        console.log('🔄 GitHub Issuesから取得開始...');
        try {
            const githubReports = await fetchGitHubReports();
            console.log('📡 GitHub Issuesレポート数:', githubReports.length);
            
            const allReports = [...localReports];
            let addedCount = 0;
            githubReports.forEach(ghReport => {
                if (!allReports.find(r => r.timestamp === ghReport.timestamp)) {
                    allReports.push(ghReport);
                    addedCount++;
                }
            });
            
            console.log('✅ 統合完了 - ローカル:', localReports.length, ', GitHub:', githubReports.length, ', 追加:', addedCount, ', 合計:', allReports.length);
            
            return allReports.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        } catch (error) {
            console.error('❌ GitHub Issuesの取得エラー:', error);
            return localReports;
        }
    }
    
    return localReports;
}

// GitHub Issuesから報告を取得(管理者用 - 全チーム)
async function fetchGitHubReports() {
    const url = `https://api.github.com/repos/${CONFIG.github.repo}/issues?labels=mission-report&state=all&per_page=100`;
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
            const teamMatch = issue.title.match(/【(.+?)】/);
            if (!teamMatch) continue;
            
            const teamName = teamMatch[1];
            const team = CONFIG.teams.find(t => t.name === teamName);
            if (!team) continue;
            
            const report = parseIssueBody(issue, team);
            if (report) {
                reports.push(report);
            }
        } catch (error) {
            console.error('❌ Issue解析エラー:', error);
        }
    }
    
    return reports;
}

// Issue本文をパースして報告データに変換
function parseIssueBody(issue, team) {
    try {
        const body = issue.body;
        
        const dateMatch = body.match(/\*\*日時:\*\* (.+)/);
        const timestamp = dateMatch ? new Date(dateMatch[1]).toISOString() : issue.created_at;
        
        const commentMatch = body.match(/\*\*コメント:\*\* (.+)/);
        const comment = commentMatch ? commentMatch[1] : '';
        
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
            fromGitHub: true
        };
    } catch (error) {
        console.error('Issue解析エラー:', error);
        return null;
    }
}

// 管理者ダッシュボードレンダリング
async function renderAdminDashboard() {
    document.getElementById('teamProgressGrid').innerHTML = '<p style="text-align: center; color: #999;">読み込み中...</p>';
    document.getElementById('allReportsList').innerHTML = '<p style="text-align: center; color: #999;">読み込み中...</p>';
    
    const allReports = await getAllReports();
    
    const totalReports = allReports.length;
    
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
async function deleteReportAdmin(timestamp) {
    if (!confirm('この報告を削除しますか?\n(この操作は取り消せません)')) {
        return;
    }
    
    const localData = localStorage.getItem('missionReports');
    const reports = localData ? JSON.parse(localData) : [];
    const filteredReports = reports.filter(r => r.timestamp !== timestamp);
    localStorage.setItem('missionReports', JSON.stringify(filteredReports));
    
    await renderAdminDashboard();
    alert('報告を削除しました');
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

// ローディング表示
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.add('active');
    } else {
        overlay.classList.remove('active');
    }
}
