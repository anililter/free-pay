
        const apiBase = window.location.pathname.endsWith('/payment1234') ? 'payment1234/' : '';
        function escapeHtml(string) {
            if (string === null || string === undefined) return '';
            return String(string)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }
        const TURKISH_MONTHS = {
            '01': 'Ocak', '02': 'Şubat', '03': 'Mart', '04': 'Nisan',
            '05': 'Mayıs', '06': 'Haziran', '07': 'Temmuz', '08': 'Ağustos',
            '09': 'Eylül', '10': 'Ekim', '11': 'Kasım', '12': 'Aralık'
        };

        const DAYS_OF_WEEK = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
        const MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
        
        function populateAccountSelects() {
            let accounts = window.paymentAccountsList ? [...window.paymentAccountsList] : [];
            if (window.vaultHistoryData) {
                window.vaultHistoryData.forEach(tx => {
                    if (tx.accountName && !accounts.includes(tx.accountName)) {
                        accounts.push(tx.accountName);
                    }
                });
            }
            document.querySelectorAll('select.account-select').forEach(select => {
                // Keep the first option if it's an 'all' filter or empty placeholder
                const firstOpt = select.options.length > 0 ? select.options[0] : null;
                const firstOption = firstOpt && (firstOpt.value === "" || firstOpt.value === "all") ? firstOpt.outerHTML : "";
                
                let optionsHtml = firstOption;
                accounts.forEach(acc => {
                    if(acc.trim()) {
                        optionsHtml += `<option value="${escapeHtml(acc.trim())}">${escapeHtml(acc.trim())}</option>`;
                    }
                });
                
                // Preserve current value
                const currentVal = select.value;
                const dataVal = select.getAttribute('data-current-value');
                
                select.innerHTML = optionsHtml;
                
                if (dataVal) {
                    select.value = dataVal;
                } else if (currentVal) {
                    select.value = currentVal;
                }
            });
        }

        // App state
        let allPayments = [];
        let allClients = [];
        let selectedPeriod = '';
        let currentTab = 'payments';
        
        // Chart instances
        let chartMonthlyInstance = null;
        let chartAccountsInstance = null;

        // updateAccountDatalist is replaced by populateAccountSelects

        window.addEventListener('DOMContentLoaded', () => {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            // Default range: previous month start → current month + 6 months
            const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
            const prevYear = now.getMonth() === 0 ? year - 1 : year;
            const startPeriod = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
            
            const futureDate = new Date(year, now.getMonth() + 6, 1);
            const futureYear = futureDate.getFullYear();
            const futureMonth = String(futureDate.getMonth() + 1).padStart(2, '0');
            const endPeriod = `${futureYear}-${futureMonth}`;
            
            document.getElementById('filterPeriodStart').value = startPeriod;
            document.getElementById('filterPeriodEnd').value = endPeriod;
            selectedPeriod = endPeriod;

            loadAllData();
            loadKasa();
            
            document.getElementById('searchClient').addEventListener('input', renderTable);
        });

        // Switch Tabs
        window.switchTab = function(tabName, btnEl = null) {
            if (typeof clearSelection === 'function') {
                clearSelection();
            }
            currentTab = tabName;
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            if (btnEl) {
                btnEl.classList.add('active');
            } else if (typeof event !== 'undefined' && event && event.currentTarget) {
                event.currentTarget.classList.add('active');
            } else {
                const buttons = document.querySelectorAll('.nav-tabs .tab-btn');
                buttons.forEach(btn => {
                    const onclickAttr = btn.getAttribute('onclick') || '';
                    if (onclickAttr.includes(`'${tabName}'`)) {
                        btn.classList.add('active');
                    }
                });
            }

            document.getElementById('tabViewPayments').classList.remove('active');
            document.getElementById('tabViewReports').classList.remove('active');
            document.getElementById('tabViewClients').classList.remove('active');
            document.getElementById('tabViewSettings').classList.remove('active');
            document.getElementById('tabViewGemini').classList.remove('active');
            if (document.getElementById('tabViewKasa')) {
                document.getElementById('tabViewKasa').classList.remove('active');
            }
            if (document.getElementById('tabViewRoutine')) {
                document.getElementById('tabViewRoutine').classList.remove('active');
            }

            if (tabName === 'payments') {
                document.getElementById('tabViewPayments').classList.add('active');
                loadPaymentsList();
            } else if (tabName === 'reports') {
                document.getElementById('tabViewReports').classList.add('active');
                // Redraw charts and render delay stats immediately
                setTimeout(() => {
                    updateCharts(window.lastChartMonthly, window.lastChartAccounts);
                    renderDelayStats(window.lastDelayStats);
                    renderReportMetrics(window.lastReportMetrics);
                    renderBrandEarningsTable(window.lastClientEarnings);
                    renderAccumulatedDebts();
                }, 100);
            } else if (tabName === 'routine') {
                document.getElementById('tabViewRoutine').classList.add('active');
                renderRoutine();
            } else if (tabName === 'settings') {
                document.getElementById('tabViewSettings').classList.add('active');
                loadSettings();
            } else if (tabName === 'gemini') {
                document.getElementById('tabViewGemini').classList.add('active');
                loadGeminiTab();
            } else if (tabName === 'kasa') {
                if (document.getElementById('tabViewKasa')) {
                    document.getElementById('tabViewKasa').classList.add('active');
                    loadKasa();
                }
            } else {
                document.getElementById('tabViewClients').classList.add('active');
                renderBrands();
            }
        };

        window.loadGeminiTab = async function() {
            const select = document.getElementById('geminiReminderClient');
            if (!select) return;
            select.innerHTML = '<option value="">Müşteri Yükleniyor...</option>';
            
            try {
                const response = await fetch('/api/legacy?api=clients_list');
                const result = await response.json();
                if (result.success) {
                    select.innerHTML = '<option value="">-- Lütfen Seçin --</option>';
                    result.data.forEach(client => {
                        const option = document.createElement('option');
                        option.value = client.id;
                        option.textContent = `${client.name} (${client.project_name})`;
                        select.appendChild(option);
                    });
                } else {
                    select.innerHTML = '<option value="">Müşteriler yüklenemedi</option>';
                }
            } catch (err) {
                console.error(err);
                select.innerHTML = '<option value="">Bağlantı hatası</option>';
            }
        };

        // --- GÜNLÜK RUTİN FONKSİYONLARI ---
        window.dailyRoutinesMap = {}; // { "clientId": "green" }

        window.renderRoutine = function() {
            const tbody = document.getElementById('routineTableBody');
            if (!tbody) return;
            tbody.innerHTML = '';
            
            if (!allClients || allClients.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color:hsl(var(--text-muted));">Aktif müşteri bulunamadı.</td></tr>';
                return;
            }

            // Parse saved routines
            const savedStr = document.getElementById('settingsPaymentAccounts').getAttribute('data-routines') || '{}';
            try {
                window.dailyRoutinesMap = JSON.parse(savedStr);
            } catch(e) {
                window.dailyRoutinesMap = {};
            }

            // Sadece aktif müşteriler
            const activeClients = allClients.filter(c => c.status === 'aktif');
            
            activeClients.forEach(client => {
                const status = window.dailyRoutinesMap[client.id] || 'none';
                
                let bgColor = 'white';
                let textColor = 'hsl(var(--text-primary))';
                
                if (status === 'green') {
                    bgColor = '#22c55e'; // tailwind green-500
                    textColor = 'white';
                } else if (status === 'orange') {
                    bgColor = '#f97316'; // tailwind orange-500
                    textColor = 'white';
                } else if (status === 'red') {
                    bgColor = '#ef4444'; // tailwind red-500
                    textColor = 'white';
                }

                const tr = document.createElement('tr');
                tr.style.backgroundColor = bgColor;
                tr.style.color = textColor;
                tr.style.transition = 'all 0.3s ease';
                
                tr.innerHTML = `
                    <td style="padding:14px; font-weight:600; border-bottom: 1px solid hsla(0,0%,0%,0.05);">${escapeHtml(client.accountInfo || '')}</td>
                    <td style="padding:14px; border-bottom: 1px solid hsla(0,0%,0%,0.05);">${escapeHtml(client.status)}</td>
                    <td style="padding:14px; font-weight:800; border-bottom: 1px solid hsla(0,0%,0%,0.05);">${escapeHtml(client.projectName)}</td>
                    <td style="padding:14px; text-align:right; font-weight:700; border-bottom: 1px solid hsla(0,0%,0%,0.05);">${formatCurrency(client.agreedAmount, client.currency)}</td>
                    <td style="padding:14px; text-align:center; font-weight:700; border-bottom: 1px solid hsla(0,0%,0%,0.05);">${escapeHtml(formatDateString(client.paymentDay))}</td>
                    <td style="padding:10px; text-align:center; border-bottom: 1px solid hsla(0,0%,0%,0.05);">
                        <div style="display:flex; gap:6px; justify-content:center;">
                            <button title="Düzenlendi (Yeşil)" class="btn" style="background:#22c55e; color:white; width:28px; height:28px; padding:0; display:flex; align-items:center; justify-content:center; border-radius:4px; border:1px solid rgba(0,0,0,0.1);" onclick="updateRoutineStatus(${client.id}, 'green')">
                                <i data-lucide="check" style="width:14px;height:14px;"></i>
                            </button>
                            <button title="Yapılacak (Turuncu)" class="btn" style="background:#f97316; color:white; width:28px; height:28px; padding:0; display:flex; align-items:center; justify-content:center; border-radius:4px; border:1px solid rgba(0,0,0,0.1);" onclick="updateRoutineStatus(${client.id}, 'orange')">
                                <i data-lucide="clock" style="width:14px;height:14px;"></i>
                            </button>
                            <button title="Durduruldu (Kırmızı)" class="btn" style="background:#ef4444; color:white; width:28px; height:28px; padding:0; display:flex; align-items:center; justify-content:center; border-radius:4px; border:1px solid rgba(0,0,0,0.1);" onclick="updateRoutineStatus(${client.id}, 'red')">
                                <i data-lucide="ban" style="width:14px;height:14px;"></i>
                            </button>
                            <button title="Sıfırla" class="btn btn-secondary" style="width:28px; height:28px; padding:0; display:flex; align-items:center; justify-content:center; border-radius:4px;" onclick="updateRoutineStatus(${client.id}, 'none')">
                                <i data-lucide="x" style="width:14px;height:14px;"></i>
                            </button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            lucide.createIcons();
        };

        window.updateRoutineStatus = async function(clientId, status) {
            if (status === 'none') {
                delete window.dailyRoutinesMap[clientId];
            } else {
                window.dailyRoutinesMap[clientId] = status;
            }
            
            const routinesStr = JSON.stringify(window.dailyRoutinesMap);
            document.getElementById('settingsPaymentAccounts').setAttribute('data-routines', routinesStr);
            
            renderRoutine();
            
            // Auto save silently
            fetch('/api/legacy?api=settings_save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ daily_routines: routinesStr })
            }).catch(e => console.error(e));
        };

        window.clearAllRoutines = async function() {
            if (!confirm('Tüm müşterilerin renk durumlarını sıfırlamak (Yeni güne başlamak) istediğinize emin misiniz?')) return;
            
            window.dailyRoutinesMap = {};
            document.getElementById('settingsPaymentAccounts').setAttribute('data-routines', '{}');
            
            renderRoutine();
            
            // Auto save silently
            fetch('/api/legacy?api=settings_save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ daily_routines: '{}' })
            }).then(() => showToast('Yeni güne başlandı, tüm renkler sıfırlandı!', 'success'))
              .catch(e => console.error(e));
        };

        window.generateGeminiAnalysis = async function(btnEl) {
            const resultBox = document.getElementById('geminiAnalysisResultBox');
            const output = document.getElementById('geminiAnalysisOutput');
            if (!resultBox || !output) return;

            const originalText = btnEl.innerHTML;
            btnEl.disabled = true;
            btnEl.innerHTML = 'Analiz Ediliyor...';

            resultBox.style.display = 'none';
            output.textContent = '';

            try {
                const response = await fetch('/api/legacy?api=gemini_analyze');
                const result = await response.json();
                if (result.success) {
                    resultBox.style.display = 'block';
                    output.textContent = result.analysis;
                    showToast('Finansal analiz başarıyla oluşturuldu.', 'success');
                } else {
                    showToast('Hata: ' + result.error, 'danger');
                }
            } catch (err) {
                console.error(err);
                showToast('Bağlantı hatası oluştu.', 'danger');
            } finally {
                btnEl.disabled = false;
                btnEl.innerHTML = originalText;
            }
        };

        window.generateGeminiReminder = async function(btnEl) {
            const clientId = document.getElementById('geminiReminderClient').value;
            const tone = document.getElementById('geminiReminderTone').value;
            const resultBox = document.getElementById('geminiReminderResultBox');
            const output = document.getElementById('geminiReminderOutput');
            
            if (!clientId) {
                alert('Lütfen bir müşteri seçin.');
                return;
            }
            if (!resultBox || !output) return;

            const originalText = btnEl.innerHTML;
            btnEl.disabled = true;
            btnEl.innerHTML = 'Taslak Yazılıyor...';

            resultBox.style.display = 'none';
            output.textContent = '';

            try {
                const response = await fetch(apiBase + `index.php?api=gemini_reminder&client_id=${clientId}&tone=${tone}`);
                const result = await response.json();
                if (result.success) {
                    resultBox.style.display = 'block';
                    output.textContent = result.message;
                    showToast('Mesaj taslağı başarıyla oluşturuldu.', 'success');
                    if (window.lucide) lucide.createIcons();
                } else {
                    showToast('Hata: ' + result.error, 'danger');
                }
            } catch (err) {
                console.error(err);
                showToast('Bağlantı hatası oluştu.', 'danger');
            } finally {
                btnEl.disabled = false;
                btnEl.innerHTML = originalText;
            }
        };

        window.copyGeminiReminderText = function() {
            const output = document.getElementById('geminiReminderOutput');
            if (!output || !output.textContent) return;
            
            navigator.clipboard.writeText(output.textContent).then(() => {
                showToast('Taslak metni panoya kopyalandı.', 'success');
            }).catch(err => {
                console.error(err);
                showToast('Kopyalama başarısız oldu.', 'danger');
            });
        };

        // No longer needed — using native month inputs
        function buildPeriodDropdowns() {}

        window.shiftRange = function(direction) {
            const startInput = document.getElementById('filterPeriodStart');
            const endInput = document.getElementById('filterPeriodEnd');
            
            function shiftMonth(val, dir) {
                const [y, m] = val.split('-').map(Number);
                const d = new Date(y, m - 1 + dir, 1);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            }
            
            startInput.value = shiftMonth(startInput.value, direction);
            endInput.value = shiftMonth(endInput.value, direction);
            selectedPeriod = endInput.value;
            loadPaymentsList();
        };

        // Fetch data
        async function loadAllData() {
            try {
                await loadSettings(); // ensure settings are loaded first
                const response = await fetch('/api/legacy?api=clients_list');
                const result = await response.json();
                if (result.success) {
                    allClients = result.data;
                    window.passiveMonths = result.passive_months || 0;
                }
                
                loadPaymentsList();
                renderBrands();
            } catch (err) {
                console.error(err);
                showToast('Hizmet bağlantı hatası.', 'danger');
            }
        }

        async function loadPaymentsList() {
            if (typeof clearSelection === 'function') {
                clearSelection();
            }
            const periodStart = document.getElementById('filterPeriodStart').value;
            const periodEnd = document.getElementById('filterPeriodEnd').value;
            selectedPeriod = periodEnd;
            try {
                const response = await fetch(`/api/legacy?api=list&period_start=${periodStart}&period_end=${periodEnd}`);
                const result = await response.json();
                if (result.success) {
                    allPayments = result.data;
                    // DB'den gelen ödeme yeri seçeneklerini global'e kaydet
                    window.accountOptions = Array.isArray(result.account_options) ? result.account_options : [];
                    window.lastChartMonthly = result.monthly_stats;
                    window.lastChartAccounts = result.account_stats;
                    window.lastDelayStats = result.delay_stats;
                    window.lastReportMetrics = result.report_metrics;
                    window.lastClientEarnings = result.client_earnings;
                    window.paidThisMonthAmount = result.paid_this_month_amount || 0;
                    window.paidLateAmount = result.paid_late_amount || 0;

                    populateAccountSelects();
                    renderTable();
                    
                    if (currentTab === 'reports') {
                        updateCharts(window.lastChartMonthly, window.lastChartAccounts);
                        renderDelayStats(window.lastDelayStats);
                        renderReportMetrics(window.lastReportMetrics);
                        renderBrandEarningsTable(window.lastClientEarnings);
                        renderAccumulatedDebts();
                    }
                }
            } catch (err) {
                console.error(err);
            }
        }

        // Stats calculation and rendering
        function renderStats() {
            let totalExpected = 0;
            let totalPaid = 0;
            let totalOverdue = 0;
            let totalPending = 0;
            
            let overdueThisMonth = 0;
            let overdueLastMonth = 0;
            let overdueOlder = 0;
            
            const todayStr = new Date().toISOString().split('T')[0];
            const curPeriod = selectedPeriod || todayStr.substring(0, 7);
            
            // Calculate previous month and end of current period
            let prevPeriod = '';
            let periodEndStr = '';
            if (curPeriod) {
                const parts = curPeriod.split('-');
                if (parts.length === 2) {
                    const y = parseInt(parts[0], 10);
                    const m = parseInt(parts[1], 10);
                    const d = new Date(y, m - 2, 1);
                    const prevY = d.getFullYear();
                    const prevM = String(d.getMonth() + 1).padStart(2, '0');
                    prevPeriod = `${prevY}-${prevM}`;
                    
                    const lastDay = new Date(y, m, 0).getDate();
                    periodEndStr = `${curPeriod}-${String(lastDay).padStart(2, '0')}`;
                }
            }

            allPayments.forEach(p => {
                const amount = p.amount;
                const paid = p.paid_amount != null ? parseFloat(p.paid_amount) : 0;
                const isPaid = p.status === 'paid';
                const isPartial = p.status === 'partial';
                const isOverdue = (p.status === 'pending' || p.status === 'partial') && p.due_date < todayStr;
                
                let includeInExpected = false;
                if (p.period === curPeriod) {
                    includeInExpected = true;
                } else {
                    if (p.due_date) {
                        const dDate = new Date(p.due_date);
                        const tDate = new Date(todayStr);
                        const diffDays = (dDate - tDate) / (1000 * 60 * 60 * 24);
                        if (diffDays >= -5 && diffDays <= 5) {
                            includeInExpected = true;
                        }
                    }
                }

                if (includeInExpected) {
                    totalExpected += amount;
                }
                
                if (isPaid) {
                    // Do nothing for totalPaid, we use backend metrics for paid logic now
                } else if (isPartial) {
                    const remaining = amount - paid;
                    if (isOverdue) {
                        totalOverdue += remaining;
                        const pPeriod = p.period;
                        if (pPeriod === curPeriod) {
                            overdueThisMonth += remaining;
                        } else if (pPeriod === prevPeriod) {
                            overdueLastMonth += remaining;
                        } else {
                            overdueOlder += remaining;
                        }
                    } else {
                        // Pending logic: only show from end of this month (25th to 31st) to next month's 5th
                        const dDate = new Date(p.due_date);
                        const currentY = dDate.getFullYear();
                        const currentM = dDate.getMonth();
                        // Find the start of the "end of month" period (e.g. 25th)
                        const pendingStart = new Date(currentY, currentM, 25);
                        // Find the end of the "next month's 5th" period
                        const pendingEnd = new Date(currentY, currentM + 1, 5);
                        
                        // We should base the window on TODAY
                        const tDate = new Date();
                        const tY = tDate.getFullYear();
                        const tM = tDate.getMonth();
                        const activePendingStart = new Date(tY, tM, 25);
                        const activePendingEnd = new Date(tY, tM + 1, 5);
                        
                        if (dDate >= activePendingStart && dDate <= activePendingEnd) {
                            totalPending += remaining;
                        }
                    }
                } else {
                    // pending status
                    if (isOverdue) {
                        totalOverdue += amount;
                        const pPeriod = p.period;
                        if (pPeriod === curPeriod) {
                            overdueThisMonth += amount;
                        } else if (pPeriod === prevPeriod) {
                            overdueLastMonth += amount;
                        } else {
                            overdueOlder += amount;
                        }
                    } else {
                        // Pending logic
                        const dDate = new Date(p.due_date);
                        const tDate = new Date();
                        const tY = tDate.getFullYear();
                        const tM = tDate.getMonth();
                        const activePendingStart = new Date(tY, tM, 25);
                        const activePendingEnd = new Date(tY, tM + 1, 5);
                        
                        if (dDate >= activePendingStart && dDate <= activePendingEnd) {
                            totalPending += amount;
                        }
                    }
                }
            });

            const totalPaidThisMonth = window.paidThisMonthAmount || 0;
            const totalPaidLate = window.paidLateAmount || 0;
            totalPaid = totalPaidThisMonth + totalPaidLate;

            document.getElementById('statTotalExpected').textContent = formatCurrency(totalExpected, 'TRY');
            document.getElementById('statTotalPaid').textContent = formatCurrency(totalPaid, 'TRY');
            document.getElementById('paidThisMonthVal').textContent = formatCurrency(totalPaidThisMonth, 'TRY');
            document.getElementById('paidLateVal').textContent = formatCurrency(totalPaidLate, 'TRY');
            
            document.getElementById('statTotalOverdue').textContent = formatCurrency(totalOverdue, 'TRY');
            document.getElementById('statTotalPending').textContent = formatCurrency(totalPending, 'TRY');
            
            // Update overdue breakdown
            document.getElementById('overdueThisMonthVal').textContent = formatCurrency(overdueThisMonth, 'TRY');
            document.getElementById('overdueLastMonthVal').textContent = formatCurrency(overdueLastMonth, 'TRY');
            if (overdueOlder > 0) {
                document.getElementById('overdueOlderSpan').style.display = 'inline';
                document.getElementById('overdueOlderVal').textContent = formatCurrency(overdueOlder, 'TRY');
            } else {
                document.getElementById('overdueOlderSpan').style.display = 'none';
            }
        }

        // Relative Date badge calculation
        function getRelativeDateStr(dateStr, status, graceDays) {
            if (!dateStr) return '';
            
            // Parse date specifically as local to avoid UTC offset issues
            const parts = dateStr.split('T')[0].split('-');
            const target = new Date(parts[0], parts[1] - 1, parts[2]);
            target.setHours(0,0,0,0);
            
            const today = new Date();
            today.setHours(0,0,0,0);

            const diffTime = target.getTime() - today.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            const formattedDate = `${target.getDate()} ${MONTHS_SHORT[target.getMonth()]}`;

            if (status === 'paid') {
                return `${formattedDate} (Ödendi)`;
            }

            const effectiveGrace = graceDays || 0;

            if (diffDays < 0) {
                const absDays = Math.abs(diffDays);
                if (absDays <= effectiveGrace) {
                    return `${absDays} gün (toleransta)`;
                }
                
                if (absDays >= 30) {
                    const monthsDiff = Math.floor(absDays / 30);
                    return `${monthsDiff} ay gecikti`;
                } else if (absDays >= 7) {
                    const weeks = Math.floor(absDays / 7);
                    return `${weeks} hafta gecikti`;
                }
                return `${absDays} gün gecikti`;
            } else if (diffDays === 0) {
                return 'Bugün';
            } else if (diffDays === 1) {
                return 'Yarın';
            } else {
                return `${diffDays} gün kaldı`;
            }
        }

        function formatCurrency(amount, currency) {
            const formatter = new Intl.NumberFormat('tr-TR', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            });
            const val = formatter.format(amount);
            
            if (currency === 'TRY') return `${val} ₺`;
            if (currency === 'USD') return `$${val}`;
            if (currency === 'EUR') return `€${val}`;
            return `${val} ${currency}`;
        }

        function formatPeriodBadge(period) {
            if (!period) return '';
            const [year, month] = period.split('-');
            const monthName = TURKISH_MONTHS[month] || month;
            return `${monthName} ${year}`;
        }

        // Unified Excel-style Table Renderer
        function renderTable() {
            const tbody = document.getElementById('paymentsTableBody');
            const emptyState = document.getElementById('tableEmptyState');
            const searchVal = document.getElementById('searchClient').value.toLowerCase();
            const accountVal = document.getElementById('filterAccount').value;
            const statusVal = document.getElementById('filterStatus').value;
            const todayStr = new Date().toISOString().split('T')[0];

            tbody.innerHTML = '';
            
            let periodEndStr = '';
            if (selectedPeriod) {
                const parts = selectedPeriod.split('-');
                if (parts.length === 2) {
                    const y = parseInt(parts[0], 10);
                    const m = parseInt(parts[1], 10);
                    const lastDay = new Date(y, m, 0).getDate();
                    periodEndStr = `${selectedPeriod}-${String(lastDay).padStart(2, '0')}`;
                }
            }
            
            const filtered = allPayments.filter(p => {
                const matchesSearch = p.client_name.toLowerCase().includes(searchVal) || 
                                      p.project_name.toLowerCase().includes(searchVal) ||
                                      (p.period_notes && p.period_notes.toLowerCase().includes(searchVal));
                
                const matchesAccount = accountVal === 'all' || p.account_info === accountVal;
                
                let matchesStatus = true;
                const isOverdue = (p.status === 'pending' || p.status === 'partial') && p.due_date < todayStr;
                const isPaid = p.status === 'paid';
                const isUpcoming = p.status === 'pending' && p.due_date >= todayStr && (!periodEndStr || p.due_date <= periodEndStr);
                
                if (statusVal === 'overdue') matchesStatus = isOverdue;
                else if (statusVal === 'upcoming') matchesStatus = isUpcoming;
                else if (statusVal === 'paid') matchesStatus = isPaid;
                else if (statusVal === 'unpaid') matchesStatus = !isPaid;
                
                return matchesSearch && matchesAccount && matchesStatus;
            });

            // Sort: purely chronological (yakından uzağa) based on due date
            filtered.sort((a, b) => {
                const aIsPaid = a.status === 'paid';
                const bIsPaid = b.status === 'paid';
                
                // Ödenenler hep en altta
                if (aIsPaid && !bIsPaid) return 1;
                if (!aIsPaid && bIsPaid) return -1;
                
                // Kalan her şeyi tarih sırasına göre yakından uzağa
                const dateCompare = a.due_date.localeCompare(b.due_date);
                if (dateCompare !== 0) return dateCompare;
                return a.client_name.localeCompare(b.client_name);
            });

            renderStats();

            if (filtered.length === 0) {
                emptyState.style.display = 'flex';
                return;
            }
            emptyState.style.display = 'none';

            // Sync select all checkbox status
            const selectAllCb = document.getElementById('selectAllPayments');
            if (selectAllCb) {
                if (filtered.length > 0) {
                    const allFilteredChecked = filtered.every(p => selectedPayments.has(`${p.client_id}_${p.period}`));
                    selectAllCb.checked = allFilteredChecked;
                } else {
                    selectAllCb.checked = false;
                }
            }

            filtered.forEach(p => {
                const isOverdue = (p.status === 'pending' || p.status === 'partial') && p.due_date < todayStr;
                const isPaid = p.status === 'paid';
                const isPartial = p.status === 'partial';

                let rowClass = 'row-upcoming';
                if (isPaid) rowClass = 'row-paid';
                else if (isPartial) rowClass = 'row-overdue';
                else if (isOverdue) rowClass = 'row-overdue';

                const relativeDateBadge = getRelativeDateStr(isPaid ? p.paid_date : p.due_date, p.status, p.grace_period_days);
                let badgeClass = isPaid ? 'paid' : isPartial ? 'partial' : (isOverdue ? 'overdue' : 'upcoming');
                let badgeLabel = isPaid ? 'ÖDENDİ' : isPartial ? 'KISMİ' : (isOverdue ? 'GECİKTİ' : 'BEKLİYOR');

                const [y, m, d] = p.due_date.split('-');
                const formattedDueDate = `${d}.${m}.${y}`;

                const key = `${p.client_id}_${p.period}`;
                const isChecked = selectedPayments.has(key) ? 'checked' : '';

                // Kısmi ödeme alanı
                const remaining = isPartial && p.paid_amount != null ? (p.amount - p.paid_amount) : null;
                const partialDisplay = isPartial && p.paid_amount != null
                    ? `<div style="font-size:10px; color:hsl(38,92%,45%); margin-top:2px;">
                          ✓ ${formatCurrency(p.paid_amount, p.currency)} ödendi
                          &nbsp;·&nbsp; <span style="color:#f87171;">Kalan: ${formatCurrency(remaining, p.currency)}</span>
                       </div>`
                    : '';

                const carryBtn = (!isPaid) ? `
                    <button title="Kalanı sonraki aya devret" style="background:none;border:none;cursor:pointer;padding:2px 4px;color:hsl(var(--text-muted));font-size:10px;display:flex;align-items:center;gap:3px;"
                        onclick="carryOver(${p.client_id},'${p.period}')">
                        <i data-lucide="arrow-right-circle" style="width:12px;height:12px;"></i>
                        Devret
                    </button>` : '';

                const rowHtml = `
                    <tr class="${rowClass}">
                        <td style="text-align: center;">
                            <input type="checkbox" class="payment-row-checkbox" data-client-id="${p.client_id}" data-period="${p.period}" ${isChecked} onchange="onRowCheckboxChange(this, ${p.client_id}, '${p.period}')" style="cursor:pointer; width:15px; height:15px; vertical-align: middle;">
                        </td>
                        <td style="text-align: center;">
                            ${isPaid ? `
                                <button class="btn-status-paid" onclick="openPaymentModal(${p.client_id}, '${p.period}')" title="Ödeme detaylarını düzenle">
                                    <i data-lucide="check" style="width:12px; height:12px;"></i> Ödendi
                                </button>
                            ` : `
                                <button class="btn-status-pending" onclick="openPaymentModal(${p.client_id}, '${p.period}')" title="Tahsilat yap">
                                    Öde
                                </button>
                            `}
                        </td>
                        <td>
                            <select class="table-input account-select" data-current-value="${escapeHtml(p.account_info || '')}"
                                    onchange="onInlineEdit(${p.client_id}, '${p.period}', 'account_info', this)"></select>
                        </td>
                        <td>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <div style="font-weight: 700; color:hsl(var(--text-primary));">${escapeHtml(p.client_name)}</div>
                                ${p.period !== selectedPeriod ? `
                                    <span class="period-badge" style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: hsla(var(--primary-rgb), 0.1); color: hsl(var(--primary)); border: 1px solid hsla(var(--primary-rgb), 0.2);">
                                        ${formatPeriodBadge(p.period)}
                                    </span>
                                ` : ''}
                            </div>
                            <div style="font-size:11px; color:hsl(var(--text-secondary)); margin-top:2px;">${escapeHtml(p.project_name)}</div>
                        </td>
                        <td>
                            <div style="display:flex; flex-direction:column; gap:6px;">
                                <span class="status-badge ${badgeClass}">
                                    <i data-lucide="clock" style="width:10px;height:10px;"></i>
                                    <span style="margin-left: 4px;">${badgeLabel}: ${relativeDateBadge}</span>
                                </span>
                                <div style="display:flex; align-items:center; gap:4px;">
                                    <input type="date" class="table-input" value="${p.due_date || ''}" 
                                           title="Vade (Hedef) Tarihini Değiştir"
                                           style="font-size: 10px; padding: 2px 4px; width: 100px; color:hsl(var(--text-secondary)); border: 1px dashed transparent;"
                                           onchange="onInlineEdit(${p.client_id}, '${p.period}', 'due_date', this)">
                                </div>
                            </div>
                        </td>
                        <td>
                            <div style="display:flex; align-items:center;">
                                <input type="number" class="table-input" value="${p.amount}" 
                                       title="Beklenen Tutarı Değiştir"
                                       style="font-size: 13px; font-weight: 700; width: 80px; color:hsl(var(--text-secondary)); border: 1px dashed transparent; text-align:right;"
                                       onchange="onInlineEdit(${p.client_id}, '${p.period}', 'expected_amount', this)">
                                <span style="font-size:12px; margin-left:4px; font-weight:700; color:hsl(var(--text-secondary));">${p.currency === 'TRY' ? '₺' : '$'}</span>
                            </div>
                            ${partialDisplay}
                        </td>
                        <td>
                            <input type="text" class="table-input" value="${escapeHtml(p.period_notes || '')}" 
                                   placeholder="Not..."
                                   onblur="onInlineEdit(${p.client_id}, '${p.period}', 'period_notes', this)"
                                   onkeydown="if(event.key === 'Enter') { this.blur(); }">
                        </td>
                    </tr>
                `;
                tbody.insertAdjacentHTML('beforeend', rowHtml);
            });
            lucide.createIcons();
            populateAccountSelects();
        }

        // Inline Input Change Controller (Excel spreadsheet behavior)
        window.onInlineEdit = function(clientId, period, field, inputElement) {
            const value = inputElement.value;
            
            const p = allPayments.find(item => item.client_id === clientId && item.period === period);
            if (p) {
                if (field === 'amount') {
                    p.amount = parseFloat(value) || 0;
                } else if (field === 'expected_amount') {
                    p.amount = parseFloat(value) || 0;
                } else if (field === 'paid_amount') {
                    p.paid_amount = parseFloat(value) || null;
                } else if (field === 'period_notes') {
                    p.period_notes = value;
                } else if (field === 'account_info') {
                    p.account_info = value;
                } else if (field === 'paid_date') {
                    p.paid_date = value || null;
                } else if (field === 'due_date') {
                    p.due_date = value || null;
                }
            }
            
            renderStats();
            
            if (field === 'paid_date' || field === 'amount' || field === 'expected_amount' || field === 'paid_amount' || field === 'due_date') {
                saveInline(clientId, period, field, value);
            } else {
                saveInlineNoRender(clientId, period, field, value, inputElement);
            }
        };

        window.onClientAccountEdit = async function(clientId, selectElement) {
            const value = selectElement.value;
            const c = allClients.find(item => item.id == clientId);
            if (!c) return;

            c.account_info = value;
            
            // Highlight element to show it's saving
            selectElement.style.border = '1px solid hsl(var(--primary))';
            
            try {
                const response = await fetch('/api/legacy?api=client_update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: c.id,
                        account_info: c.account_info
                    })
                });

                const result = await response.json();
                if (result.success) {
                    selectElement.style.border = '1px solid #10b981'; // green for success
                    setTimeout(() => { selectElement.style.border = '1px solid hsl(var(--border-color))'; }, 2000);
                } else {
                    selectElement.style.border = '1px solid #ef4444'; // red for error
                    showToast('Güncelleme hatası: ' + result.error, 'danger');
                }
            } catch (err) {
                console.error(err);
                selectElement.style.border = '1px solid #ef4444';
            }
        };

        // Render client payment delay stats table
        function renderDelayStats(delayStats) {
            const tbody = document.getElementById('delayStatsTableBody');
            tbody.innerHTML = '';
            if (!delayStats || delayStats.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:hsl(var(--text-muted));">Gecikme verisi bulunmuyor.</td></tr>';
                return;
            }
            
            delayStats.forEach(stat => {
                const avgDelay = Math.round(stat.avg_delay_days);
                let badgeClass = 'paid';
                let label = '0 gün (Zamanında)';
                
                if (avgDelay > 0 && avgDelay <= 4) {
                    badgeClass = 'upcoming';
                    label = `${avgDelay} gün gecikme`;
                } else if (avgDelay > 4) {
                    badgeClass = 'overdue';
                    label = `${avgDelay} gün gecikme (Takip Gerekli)`;
                }
                
                const rowHtml = `
                    <tr>
                        <td style="padding: 12px 18px;"><div style="font-weight:700; color:hsl(var(--text-primary));">${escapeHtml(stat.client_name)}</div></td>
                        <td style="padding: 12px 18px;"><div style="color:hsl(var(--text-secondary)); font-size:12px;">${escapeHtml(stat.project_name)}</div></td>
                        <td style="padding: 12px 18px; text-align: right;">
                            <span class="status-badge ${badgeClass}">${label}</span>
                        </td>
                    </tr>
                `;
                tbody.insertAdjacentHTML('beforeend', rowHtml);
            });
        }

        function renderReportMetrics(metrics) {
            if (!metrics) return;
            document.getElementById('reportAvgMonthly').textContent = formatCurrency(metrics.avg_monthly, 'TRY');
            document.getElementById('reportAvg3Month').textContent = formatCurrency(metrics.avg_3m, 'TRY');
            document.getElementById('reportYearlyTotal').textContent = formatCurrency(metrics.yearly_total, 'TRY');
        }

        function renderBrandEarningsTable(earnings) {
            const tbody = document.getElementById('brandEarningsTableBody');
            tbody.innerHTML = '';
            if (!earnings || earnings.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:hsl(var(--text-muted));">Gelir verisi bulunmuyor.</td></tr>';
                return;
            }

            earnings.forEach(stat => {
                const totalPaid = parseFloat(stat.total_paid) || 0;

                const rowHtml = `
                    <tr>
                        <td style="padding: 12px 18px;"><div style="font-weight:700; color:hsl(var(--text-primary));">${escapeHtml(stat.client_name)}</div></td>
                        <td style="padding: 12px 18px;"><div style="color:hsl(var(--text-secondary)); font-size:12px;">${escapeHtml(stat.project_name)}</div></td>
                        <td style="padding: 12px 18px; text-align: right;"><div style="font-weight:900; font-size: 15px; color:hsl(var(--success));">${formatCurrency(totalPaid, stat.currency)}</div></td>
                    </tr>
                `;
                tbody.insertAdjacentHTML('beforeend', rowHtml);
            });
        }

        // Grup açıp kapama
        window.toggleGroup = function(groupId) {
            const header = document.getElementById(groupId);
            if (!header) return;
            const icon = document.getElementById(groupId + '_icon');
            header.classList.toggle('collapsed');
            const isCollapsed = header.classList.contains('collapsed');
            if (icon) icon.setAttribute('data-lucide', isCollapsed ? 'chevron-right' : 'chevron-down');
            lucide.createIcons();
            
            // Toggle visibility of all group members
            const members = document.querySelectorAll(`tr[data-group-id="${groupId}"]`);
            members.forEach(member => {
                member.style.display = isCollapsed ? 'none' : '';
            });
        };

        // Devret — kalan tutarı sonraki aya ekle
        window.carryOver = async function(clientId, period) {
            if (!confirm(`${period} döneminin kalan tutarı sonraki aya devredilsin mi?`)) return;
            try {
                const response = await fetch('/api/legacy?api=carry_over', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ client_id: clientId, period: period })
                });
                const result = await response.json();
                if (result.success) {
                    const nextPeriod = result.to_period;
                    const amount = result.carried_over;
                    showToast(`${formatCurrency(amount, 'TRY')} ${nextPeriod} dönemine devredildi.`, 'success');
                    await loadPaymentsList();
                } else {
                    showToast(result.error || 'Devir işlemi başarısız.', 'danger');
                }
            } catch(err) {
                showToast('Bağlantı hatası.', 'danger');
            }
        };

        // Birikmiş Borçlar Raporu
        function renderAccumulatedDebts() {
            const container = document.getElementById('accumulatedDebtsBody');
            if (!container) return;

            const todayStr = new Date().toISOString().split('T')[0];

            // Tüm ödenmemiş/kısmi ödemeleri müşteri bazında grupla
            const debtMap = {};
            allPayments.forEach(p => {
                if (p.status === 'paid') return;
                if (!debtMap[p.client_id]) {
                    debtMap[p.client_id] = {
                        name: p.client_name,
                        project: p.project_name,
                        currency: p.currency,
                        periods: [],
                        totalDebt: 0,
                        oldestDue: p.due_date
                    };
                }
                const remaining = (p.status === 'partial' && p.paid_amount != null)
                    ? p.amount - p.paid_amount
                    : p.amount;
                debtMap[p.client_id].totalDebt += remaining;
                debtMap[p.client_id].periods.push(p.period);
                if (p.due_date < debtMap[p.client_id].oldestDue) {
                    debtMap[p.client_id].oldestDue = p.due_date;
                }
            });

            const debts = Object.values(debtMap).sort((a, b) => b.totalDebt - a.totalDebt);

            if (debts.length === 0) {
                container.innerHTML = `<tr><td colspan="5" style="text-align:center; color:hsl(var(--text-muted)); padding:20px;">
                    <i data-lucide="check-circle" style="width:18px;height:18px;display:inline-block;margin-right:6px;"></i>
                    Birikmiş borçlu müşteri yok. 🎉
                </td></tr>`;
                lucide.createIcons();
                return;
            }

            container.innerHTML = debts.map(debt => {
                const months = debt.periods.length;
                const urgency = months >= 3 ? 'overdue' : months >= 2 ? 'partial' : 'upcoming';
                const [oy, om, od] = debt.oldestDue.split('-');
                return `
                    <tr>
                        <td style="padding:12px 18px;">
                            <div style="font-weight:800; color:hsl(var(--text-primary));">${escapeHtml(debt.name)}</div>
                            <div style="font-size:11px; color:hsl(var(--text-secondary));">${escapeHtml(debt.project)}</div>
                        </td>
                        <td style="padding:12px 18px; text-align:center;">
                            <span class="status-badge ${urgency}" style="font-size:13px; font-weight:900;">${months} ay</span>
                        </td>
                        <td style="padding:12px 18px; text-align:right;">
                            <div style="font-weight:900; font-size:15px; color:#f87171;">${formatCurrency(debt.totalDebt, debt.currency)}</div>
                        </td>
                        <td style="padding:12px 18px; text-align:center; font-size:12px; color:hsl(var(--text-secondary));">
                            ${od}.${om}.${oy}
                        </td>
                        <td style="padding:12px 18px; text-align:center; font-size:11px; color:hsl(var(--text-muted));">
                            ${debt.periods.map(per => formatPeriodBadge(per)).join(' &nbsp;·&nbsp; ')}
                        </td>
                    </tr>
                `;
            }).join('');
            lucide.createIcons();
        }

        async function loadSettings() {
            try {
                const response = await fetch('/api/legacy?api=settings_get');
                const result = await response.json();
                if (result.success) {
                    const settingsData = result.data;
                    document.getElementById('settingsSmtpHost').value = settingsData.smtp_host || '';
                    document.getElementById('settingsSmtpPort').value = settingsData.smtp_port || '';
                    document.getElementById('settingsSmtpSecure').value = settingsData.smtp_secure || 'tls';
                    document.getElementById('settingsNotificationEmail').value = settingsData.notification_email || '';
                    document.getElementById('settingsSmtpUser').value = settingsData.smtp_user || '';
                    document.getElementById('settingsSmtpPass').value = settingsData.smtp_pass || '';
                    document.getElementById('settingsTelegramBotToken').value = settingsData.telegram_bot_token || '';
                    document.getElementById('settingsTelegramChatId').value = settingsData.telegram_chat_id || '';
                    document.getElementById('settingsGeminiApiKey').value = settingsData.gemini_api_key || '';
                    document.getElementById('settingsPaymentAccounts').value = settingsData.payment_accounts || '';
                    document.getElementById('settingsPaymentAccounts').setAttribute('data-routines', settingsData.daily_routines || '{}');
                    window.paymentAccountsList = (settingsData.payment_accounts || '').split('\n').map(a => a.trim()).filter(Boolean);
                    renderSettingsAccountsList();
                    populateAccountSelects();
                }
            } catch (err) {
                console.error(err);
                showToast('Ayarlar yüklenemedi.', 'danger');
            }
        };

        function renderSettingsAccountsList() {
            const listDiv = document.getElementById('settingsAccountsList');
            const hiddenInput = document.getElementById('settingsPaymentAccounts');
            const accounts = window.paymentAccountsList || [];
            
            // Sync to hidden input
            hiddenInput.value = accounts.join('\n');
            
            listDiv.innerHTML = '';
            if (accounts.length === 0) {
                listDiv.innerHTML = '<div style="color:hsl(var(--text-muted)); font-size:13px; text-align:center; padding: 12px; background:hsla(0,0%,50%,0.05); border-radius:6px;">Hiç hesap eklenmedi.</div>';
                return;
            }
            
            accounts.forEach((acc, index) => {
                const itemHtml = `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:white; padding: 10px 14px; border-radius: 6px; border: 1px solid hsl(var(--border-color));">
                        <span style="font-weight:600; font-size:13px; color:hsl(var(--text-primary));">${escapeHtml(acc)}</span>
                        <button type="button" class="icon-btn delete" onclick="removePaymentAccount(${index})" title="Sil" style="background:none; border:none; color:hsl(var(--danger)); cursor:pointer; padding:4px;">
                            <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
                        </button>
                    </div>
                `;
                listDiv.insertAdjacentHTML('beforeend', itemHtml);
            });
            lucide.createIcons();
        }

        window.addPaymentAccount = async function() {
            const input = document.getElementById('newAccountInput');
            const val = input.value.trim();
            if (!val) return;
            
            if (!window.paymentAccountsList) window.paymentAccountsList = [];
            if (window.paymentAccountsList.includes(val)) {
                showToast('Bu hesap zaten ekli!', 'warning');
                return;
            }
            
            window.paymentAccountsList.push(val);
            input.value = '';
            renderSettingsAccountsList();
            
            // Auto save
            await fetch('/api/legacy?api=settings_save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payment_accounts: document.getElementById('settingsPaymentAccounts').value })
            });
            showToast('Hesap eklendi ve kaydedildi.', 'success');
            loadKasa(); // refresh kasa accounts
        };

        window.removePaymentAccount = async function(index) {
            if (!confirm('Bu hesabı listeden çıkarmak istediğinize emin misiniz? (Geçmiş işlemleri etkilemez)')) return;
            window.paymentAccountsList.splice(index, 1);
            renderSettingsAccountsList();
            
            // Auto save
            await fetch('/api/legacy?api=settings_save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payment_accounts: document.getElementById('settingsPaymentAccounts').value })
            });
            showToast('Hesap silindi ve kaydedildi.', 'success');
            loadKasa(); // refresh kasa accounts
        };

        window.saveSettingsForm = async function(e) {
            e.preventDefault();
            const config = {
                smtp_host: document.getElementById('settingsSmtpHost').value,
                smtp_port: document.getElementById('settingsSmtpPort').value,
                smtp_secure: document.getElementById('settingsSmtpSecure').value,
                notification_email: document.getElementById('settingsNotificationEmail').value,
                smtp_user: document.getElementById('settingsSmtpUser').value,
                smtp_pass: document.getElementById('settingsSmtpPass').value,
                telegram_bot_token: document.getElementById('settingsTelegramBotToken').value,
                telegram_chat_id: document.getElementById('settingsTelegramChatId').value,
                gemini_api_key: document.getElementById('settingsGeminiApiKey').value,
                payment_accounts: document.getElementById('settingsPaymentAccounts').value
            };

            try {
                const response = await fetch('/api/legacy?api=settings_save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(config)
                });
                const result = await response.json();
                if (result.success) {
                    window.paymentAccountsList = config.payment_accounts.split('\n').map(a => a.trim()).filter(Boolean);
                    populateAccountSelects();
                    showToast('Ayarlar başarıyla kaydedildi.', 'success');
                } else {
                    showToast('Hata: ' + result.error, 'danger');
                }
            } catch (err) {
                console.error(err);
                showToast('Bağlantı hatası.', 'danger');
            }
        };

        window.fetchTelegramChatId = async function() {
            const token = document.getElementById('settingsTelegramBotToken').value;
            if (!token) {
                alert('Lütfen önce Telegram Bot Token bilgisini girin ve Ayarları Kaydedin.');
                return;
            }

            try {
                showToast('Telegram üzerinden güncellemeler kontrol ediliyor...', 'info');
                const res = await fetch('/api/legacy?api=telegram_get_chat_id&token=' + encodeURIComponent(token));
                const result = await res.json();

                if (result.success && result.chat_id) {
                    document.getElementById('settingsTelegramChatId').value = result.chat_id;
                    showToast('Chat ID başarıyla bulundu! Lütfen ayarları kaydedin.', 'success');
                } else {
                    alert('Hata: ' + (result.error || 'Hiç mesaj bulunamadı. Lütfen Telegram uygulamasından botunuza "Merhaba" vb. bir mesaj gönderin ve tekrar deneyin.'));
                }
            } catch(e) {
                showToast('Bağlantı hatası.', 'danger');
            }
        };

        window.restoreDatabaseBackup = async function() {
            const fileInput = document.getElementById('restoreFile');
            if (!fileInput.files || fileInput.files.length === 0) {
                alert('Lütfen yüklenecek .json formatında bir yedek dosyası seçin.');
                return;
            }

            const file = fileInput.files[0];
            if (!file.name.endsWith('.json')) {
                alert('Sadece .json formatındaki yedek dosyaları desteklenir.');
                return;
            }

            const confirmMsg = "⚠️ DİKKAT: Bu işlem mevcut tüm müşterileri ve ödemeleri tamamen silecektir ve seçtiğiniz yedeği geri yükleyecektir.\n\nDevam etmek istediğinize emin misiniz?";
            if (!confirm(confirmMsg)) {
                return;
            }

            const formData = new FormData();
            formData.append('backup_file', file);

            try {
                const response = await fetch('/api/legacy?api=backup_restore', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                if (result.success) {
                    showToast(result.message || 'Yedek başarıyla geri yüklendi.', 'success');
                    fileInput.value = '';
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } else {
                    showToast('Geri yükleme hatası: ' + result.error, 'danger');
                }
            } catch (err) {
                console.error(err);
                showToast('Bağlantı hatası.', 'danger');
            }
        };

        window.sendBackupEmailManual = async function(btnEl) {
            const originalText = btnEl.innerHTML;
            btnEl.disabled = true;
            btnEl.textContent = 'Gönderiliyor...';

            try {
                const response = await fetch('/api/legacy?api=backup_email_manual', {
                    method: 'POST'
                });
                const result = await response.json();
                if (result.success) {
                    showToast(result.message || 'Yedek e-postası başarıyla gönderildi.', 'success');
                } else {
                    showToast('E-posta hatası: ' + result.error, 'danger');
                }
            } catch (err) {
                console.error(err);
                showToast('Bağlantı hatası.', 'danger');
            } finally {
                btnEl.disabled = false;
                btnEl.innerHTML = '<i data-lucide="mail" style="width:16px; height:16px;"></i> E-posta Yedek Gönder';
                if (window.lucide) lucide.createIcons();
            }
        };

        window.testEmailConnection = async function(btnEl = null) {
            const btn = btnEl || (typeof event !== 'undefined' && event ? event.currentTarget : null);
            if (!btn) return;
            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-icon"></span> Test Ediliyor...';

            try {
                const config = {
                    smtp_host: document.getElementById('settingsSmtpHost').value,
                    smtp_port: document.getElementById('settingsSmtpPort').value,
                    smtp_secure: document.getElementById('settingsSmtpSecure').value,
                    notification_email: document.getElementById('settingsNotificationEmail').value,
                    smtp_user: document.getElementById('settingsSmtpUser').value,
                    smtp_pass: document.getElementById('settingsSmtpPass').value
                };

                await fetch('/api/legacy?api=settings_save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(config)
                });

                const response = await fetch('/api/legacy?api=settings_test_email');
                const result = await response.json();
                if (result.success) {
                    showToast('Test e-postası başarıyla gönderildi!', 'success');
                } else {
                    const errMsg = result.error || result.message || 'Bilinmeyen hata';
                    showToast('Gönderim başarısız: ' + errMsg, 'danger');
                    console.error('SMTP Error:', errMsg);
                }
            } catch (err) {
                console.error(err);
                showToast('E-posta sunucusuna bağlanılamadı.', 'danger');
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        };

        window.triggerManualReminders = async function(btnEl = null) {
            const btn = btnEl || (typeof event !== 'undefined' && event ? event.currentTarget : null);
            if (!btn) return;
            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-icon"></span> Gönderiliyor...';

            try {
                const response = await fetch('/api/legacy?api=settings_trigger_reminders');
                const result = await response.json();
                if (result.success) {
                    if (result.sent) {
                        showToast('Rapor e-postası başarıyla gönderildi!', 'success');
                    } else {
                        showToast(result.message, 'info');
                    }
                } else {
                    showToast('Hata: ' + result.message, 'danger');
                }
            } catch (err) {
                console.error(err);
                showToast('Bağlantı hatası.', 'danger');
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        };

        // Save inline without full table redrawing
        async function saveInlineNoRender(clientId, period, field, value, element) {
            try {
                element.style.borderColor = 'hsl(var(--primary))';
                
                const response = await fetch('/api/legacy?api=save_inline', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        client_id: clientId,
                        period,
                        field,
                        value
                    })
                });
                const result = await response.json();
                if (result.success) {
                    element.style.borderColor = 'hsl(var(--success))';
                    setTimeout(() => {
                        element.style.borderColor = 'transparent';
                    }, 1000);
                } else {
                    element.style.borderColor = 'hsl(var(--danger))';
                    showToast('Veri kaydedilemedi: ' + result.error, 'danger');
                }
            } catch (err) {
                console.error(err);
                element.style.borderColor = 'hsl(var(--danger))';
                showToast('Bağlantı hatası.', 'danger');
            }
        }

        // Save inline and redraw (for checkbox toggle / date changes)
        window.saveInline = async function(clientId, period, field, value) {
            try {
                const response = await fetch('/api/legacy?api=save_inline', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        client_id: clientId,
                        period,
                        field,
                        value
                    })
                });
                const result = await response.json();
                if (result.success) {
                    showToast('Değişiklik kaydedildi.', 'success');
                    loadPaymentsList();
                } else {
                    showToast('Hata: ' + result.error, 'danger');
                }
            } catch (err) {
                console.error(err);
                showToast('Bağlantı hatası.', 'danger');
            }
        };

        // Bulk Selection and Edit Logic
        let selectedPayments = new Set();

        window.onRowCheckboxChange = function(el, clientId, period) {
            const key = `${clientId}_${period}`;
            if (el.checked) {
                selectedPayments.add(key);
            } else {
                selectedPayments.delete(key);
            }
            
            const checkboxes = document.querySelectorAll('.payment-row-checkbox');
            const selectAllCb = document.getElementById('selectAllPayments');
            if (selectAllCb) {
                const allChecked = Array.from(checkboxes).every(cb => cb.checked);
                selectAllCb.checked = allChecked;
            }
            
            updateBulkActionBar();
        };

        window.toggleSelectAll = function(headerCheckbox) {
            const checkboxes = document.querySelectorAll('.payment-row-checkbox');
            checkboxes.forEach(cb => {
                cb.checked = headerCheckbox.checked;
                const clientId = cb.getAttribute('data-client-id');
                const period = cb.getAttribute('data-period');
                const key = `${clientId}_${period}`;
                if (headerCheckbox.checked) {
                    selectedPayments.add(key);
                } else {
                    selectedPayments.delete(key);
                }
            });
            updateBulkActionBar();
        };

        window.bulkDelete = async function() {
            if (selectedPayments.size === 0) return;
            if (!confirm(`Seçili ${selectedPayments.size} adet ödemeyi silmek istediğinize emin misiniz?\nBu işlem geri alınamaz!`)) {
                return;
            }
            
            const count = selectedPayments.size;
            
            const promises = Array.from(selectedPayments).map(key => {
                const [clientId, period] = key.split('_');
                return fetch('/api/legacy?api=payment_delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        client_id: parseInt(clientId, 10),
                        period
                    })
                }).then(res => res.json());
            });
            
            try {
                showToast(`${count} ödeme siliniyor...`, 'info');
                const results = await Promise.all(promises);
                const failures = results.filter(r => !r.success);
                
                if (failures.length === 0) {
                    showToast('Seçilen ödemeler başarıyla silindi.', 'success');
                } else {
                    showToast(`${failures.length} ödeme kaydı silinemedi.`, 'danger');
                }
                
                selectedPayments.clear();
                updateBulkActionBar();
                loadPaymentsList();
            } catch (err) {
                console.error(err);
                showToast('Bağlantı hatası.', 'danger');
            }
        };

        window.clearSelection = function() {
            selectedPayments.clear();
            const selectAllCb = document.getElementById('selectAllPayments');
            if (selectAllCb) selectAllCb.checked = false;
            
            const checkboxes = document.querySelectorAll('.payment-row-checkbox');
            checkboxes.forEach(cb => cb.checked = false);
            
            updateBulkActionBar();
        };

        function updateBulkActionBar() {
            const bar = document.getElementById('bulkActionBar');
            const countSpan = document.getElementById('bulkSelectedCount');
            if (!bar || !countSpan) return;
            
            const count = selectedPayments.size;
            if (count > 0) {
                countSpan.textContent = `${count} ödeme kaydı seçildi`;
                bar.classList.add('show');
            } else {
                bar.classList.remove('show');
            }
        }

        window.bulkMarkAsPaid = async function() {
            const count = selectedPayments.size;
            if (count === 0) return;
            
            if (!confirm(`Seçilen ${count} adet ödeme kaydını "Ödendi" olarak işaretlemek istediğinize emin misiniz?`)) {
                return;
            }
            
            const todayStr = new Date().toISOString().split('T')[0];
            const promises = Array.from(selectedPayments).map(key => {
                const [clientId, period] = key.split('_');
                return fetch('/api/legacy?api=save_inline', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        client_id: parseInt(clientId, 10),
                        period,
                        field: 'status_with_date',
                        value: JSON.stringify({ status: 'paid', paid_date: todayStr })
                    })
                }).then(res => res.json());
            });
            
            try {
                showToast(`${count} ödeme güncelleniyor...`, 'info');
                const results = await Promise.all(promises);
                const failures = results.filter(r => !r.success);
                
                if (failures.length === 0) {
                    showToast('Seçilen ödemeler başarıyla tahsil edildi.', 'success');
                } else {
                    showToast(`${failures.length} ödeme kaydı güncellenemedi.`, 'danger');
                }
                
                selectedPayments.clear();
                loadPaymentsList();
            } catch (err) {
                console.error(err);
                showToast('Toplu işlem sırasında bir bağlantı hatası oluştu.', 'danger');
            }
        };

        window.bulkMarkAsPending = async function() {
            const count = selectedPayments.size;
            if (count === 0) return;
            
            if (!confirm(`Seçilen ${count} adet ödeme kaydını "Bekliyor" olarak işaretlemek istediğinize emin misiniz?`)) {
                return;
            }
            
            const promises = Array.from(selectedPayments).map(key => {
                const [clientId, period] = key.split('_');
                return fetch('/api/legacy?api=save_inline', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        client_id: parseInt(clientId, 10),
                        period,
                        field: 'status_with_date',
                        value: JSON.stringify({ status: 'pending', paid_date: null })
                    })
                }).then(res => res.json());
            });
            
            try {
                showToast(`${count} ödeme güncelleniyor...`, 'info');
                const results = await Promise.all(promises);
                const failures = results.filter(r => !r.success);
                
                if (failures.length === 0) {
                    showToast('Seçilen ödemeler "Bekliyor" olarak güncellendi.', 'success');
                } else {
                    showToast(`${failures.length} ödeme kaydı güncellenemedi.`, 'danger');
                }
                
                selectedPayments.clear();
                loadPaymentsList();
            } catch (err) {
                console.error(err);
                showToast('Toplu işlem sırasında bir bağlantı hatası oluştu.', 'danger');
            }
        };

        window.toggleStatus = async function(clientId, period, newStatus, currentPaidDate) {
            if (newStatus === 'paid') {
                if (!confirm('Ödeme kaydını "Ödendi" olarak işaretlemek istediğinize emin misiniz?')) {
                    return;
                }
            }
            let finalPaidDate = currentPaidDate;
            if (newStatus === 'paid' && (!currentPaidDate || currentPaidDate === 'null' || currentPaidDate === '')) {
                finalPaidDate = new Date().toISOString().split('T')[0];
            } else if (newStatus === 'pending') {
                // Keep the date but set status to pending as requested
            }
            
            try {
                const response = await fetch('/api/legacy?api=save_inline', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        client_id: clientId,
                        period,
                        field: 'status_with_date',
                        value: JSON.stringify({ status: newStatus, paid_date: finalPaidDate })
                    })
                });
                const result = await response.json();
                if (result.success) {
                    showToast(newStatus === 'paid' ? 'Ödeme tahsil edildi.' : 'Ödeme bekliyor olarak işaretlendi.', 'success');
                    loadPaymentsList();
                } else {
                    showToast('Hata: ' + result.error, 'danger');
                }
            } catch (err) {
                console.error(err);
                showToast('Bağlantı hatası.', 'danger');
            }
        };

        // Render charts dynamically using Chart.js
        function updateCharts(monthlyStats, accountStats) {
            if (!monthlyStats || !accountStats) return;

            // 1. Monthly expected vs paid Comparison (Bar Chart)
            const monthlyLabels = monthlyStats.map(item => item.label);
            const expectedData = monthlyStats.map(item => item.expected);
            const paidData = monthlyStats.map(item => item.paid);

            const ctxMonthly = document.getElementById('chartMonthly').getContext('2d');
            if (chartMonthlyInstance) {
                chartMonthlyInstance.destroy();
            }
            
            chartMonthlyInstance = new Chart(ctxMonthly, {
                type: 'bar',
                data: {
                    labels: monthlyLabels,
                    datasets: [
                        {
                            label: 'Beklenen Toplam Gelir',
                            data: expectedData,
                            backgroundColor: 'rgba(54, 162, 235, 0.4)',
                            borderColor: 'rgb(54, 162, 235)',
                            borderWidth: 1.5,
                            borderRadius: 4
                        },
                        {
                            label: 'Tahsil Edilen (Ödenen)',
                            data: paidData,
                            backgroundColor: 'rgba(75, 192, 192, 0.5)',
                            borderColor: 'rgb(75, 192, 192)',
                            borderWidth: 1.5,
                            borderRadius: 4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: 'hsl(222, 47%, 11%)', font: { family: 'Plus Jakarta Sans', weight: 600 } }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: 'rgba(0, 0, 0, 0.06)' },
                            ticks: { color: 'hsl(215, 16%, 47%)', font: { family: 'Plus Jakarta Sans', weight: 600 } }
                        },
                        y: {
                            grid: { color: 'rgba(0, 0, 0, 0.06)' },
                            ticks: { 
                                color: 'hsl(215, 16%, 47%)', 
                                font: { family: 'Plus Jakarta Sans', weight: 600 },
                                callback: function(value) { return value.toLocaleString('tr-TR') + ' ₺'; }
                            }
                        }
                    }
                }
            });

            // 2. Account distribution breakdown (Doughnut Chart)
            const accountLabels = accountStats.map(item => item.account);
            const accountDataPaid = accountStats.map(item => item.paid_amount);
            
            // Fallback: If no collected payments exist yet in this period, show total expected amounts as preview
            const hasPaidData = accountDataPaid.some(val => val > 0);
            const displayData = hasPaidData ? accountDataPaid : accountStats.map(item => item.total_amount);
            const chartTitleSuffix = hasPaidData ? ' (Tahsil Edilen)' : ' (Beklenen)';

            const ctxAccounts = document.getElementById('chartAccounts').getContext('2d');
            if (chartAccountsInstance) {
                chartAccountsInstance.destroy();
            }

            const colors = [
                '#6366f1', // Indigo
                '#10b981', // Emerald (elden)
                '#3b82f6', // Blue (Emirhan Erdin)
                '#f59e0b', // Amber (Şahsi iban)
                '#ec4899', // Pink (International PSY)
                '#8b5cf6', // Violet (Fatura)
                '#14b8a6'  // Teal (Admuch)
            ];

            chartAccountsInstance = new Chart(ctxAccounts, {
                type: 'doughnut',
                data: {
                    labels: accountLabels,
                    datasets: [{
                        data: displayData,
                        backgroundColor: colors.slice(0, accountLabels.length),
                        borderWidth: 1,
                        borderColor: 'hsl(214, 32%, 91%)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: 'hsl(222, 47%, 11%)', font: { family: 'Plus Jakarta Sans', weight: 600 } }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const val = context.raw;
                                    return ` ${context.label}: ${val.toLocaleString('tr-TR')} ₺${chartTitleSuffix}`;
                                }
                            }
                        }
                    }
                }
            });
        }

        // --- TAB 3: CLIENTS/BRANDS ---
        window.renderBrands = function() {
            const tbody = document.getElementById('brandsTableBody');
            const tableContainer = document.getElementById('brandsTableContainer');
            const emptyState = document.getElementById('brandsEmptyState');
            const searchVal = document.getElementById('searchBrand').value.toLowerCase();

            // Update stats
            const totalClients = allClients.length;
            const activeClients = allClients.filter(c => c.status === 'aktif').length;
            const passiveClients = allClients.filter(c => c.status === 'pasif').length;
            
            document.getElementById('statTotalClients').textContent = totalClients;
            document.getElementById('statActiveClients').textContent = activeClients;
            document.getElementById('statPassiveClients').textContent = passiveClients;
            document.getElementById('statPassiveMonths').textContent = (window.passiveMonths || 0) + ' Ay';

            tbody.innerHTML = '';
            
            const filtered = allClients.filter(c => {
                return c.name.toLowerCase().includes(searchVal) || 
                       c.project_name.toLowerCase().includes(searchVal) ||
                       (c.notes && c.notes.toLowerCase().includes(searchVal));
            });

            if (filtered.length === 0) {
                if (tableContainer) tableContainer.style.display = 'none';
                emptyState.style.display = 'flex';
                return;
            }
            if (tableContainer) tableContainer.style.display = 'block';
            emptyState.style.display = 'none';

            filtered.forEach(c => {
                const termBadge = c.payment_type === 'upfront' ? 'Önden Ödeme' : 'Dönem Sonu';
                const isAktif = c.status === 'aktif';
                const statusBadgeHtml = isAktif 
                    ? `<span class="status-badge paid" style="font-size:10px; padding:2px 8px;">AKTİF</span>`
                    : `<span class="status-badge overdue" style="font-size:10px; padding:2px 8px; background:hsla(0,0%,50%,0.15); color:hsl(var(--text-muted));">PASİF</span>`;

                const rowHtml = `
                    <tr>
                        <td style="padding: 12px 18px;">
                            <div style="font-weight:700; color:hsl(var(--text-primary));">${escapeHtml(c.name)}</div>
                        </td>
                        <td>
                            <div style="font-weight:700; color:hsl(var(--text-primary));">${formatCurrency(c.agreed_amount, c.currency)}</div>
                        </td>
                        <td>
                            <div style="font-weight:600; color:hsl(var(--text-secondary));">Her Ayın ${c.payment_day}. günü</div>
                        </td>
                        <td>
                            <div style="font-weight:600; color:hsl(var(--text-secondary));">${termBadge}</div>
                        </td>
                        <td>
                            <select class="table-input account-select" data-current-value="${escapeHtml(c.account_info || '')}"
                                    onchange="onClientAccountEdit(${c.id}, this)"
                                    style="width: 120px; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 4px; background: hsl(var(--bg-base)); border: 1px solid hsl(var(--border-color));"></select>
                        </td>
                        <td>
                            <div style="font-weight:600; color:hsl(var(--text-secondary));">${c.start_date || '-'}</div>
                        </td>
                        <td>
                            ${statusBadgeHtml}
                        </td>
                        <td style="text-align: right; padding-right: 18px;">
                            <div style="display:inline-flex; gap: 4px;">
                                <button class="icon-btn edit" onclick="openClientModal(${c.id})" title="Düzenle">
                                    <i data-lucide="edit-3" style="width:13px;height:13px;"></i>
                                </button>
                                <button class="icon-btn delete" onclick="deleteClient(${c.id})" title="Sil">
                                    <i data-lucide="trash-2" style="width:13px;height:13px;"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
                tbody.insertAdjacentHTML('beforeend', rowHtml);
            });
            lucide.createIcons();
            populateAccountSelects();
        };

        window.openManualPaymentModal = function() {
            const form = document.getElementById('manualPaymentForm');
            form.reset();
            
            const select = document.getElementById('mpClientId');
            select.innerHTML = '<option value="">-- Müşteri Seçin --</option>';
            window.allClients.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = `${c.name} (${c.project_name})`;
                select.appendChild(opt);
            });
            
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            document.getElementById('mpPeriod').value = `${y}-${m}`;
            
            document.getElementById('manualPaymentModal').classList.add('show');
            
            // Handle status change for PaidDate visibility
            document.getElementById('mpStatus').addEventListener('change', function() {
                document.getElementById('mpPaidDateGroup').style.display = this.value === 'paid' ? 'block' : 'none';
            });
            
            // Handle client change to populate currency and expected amount
            select.addEventListener('change', function() {
                const clientId = parseInt(this.value);
                const client = window.allClients.find(c => c.id === clientId);
                if (client) {
                    document.getElementById('mpCurrencyLabel').textContent = client.currency === 'TRY' ? '₺' : '$';
                    document.getElementById('mpExpectedAmount').value = client.agreed_amount;
                } else {
                    document.getElementById('mpCurrencyLabel').textContent = '₺';
                    document.getElementById('mpExpectedAmount').value = '';
                }
            });
        };

        window.closeManualPaymentModal = function() {
            document.getElementById('manualPaymentModal').classList.remove('show');
        };

        window.submitManualPayment = async function(e) {
            e.preventDefault();
            const clientId = document.getElementById('mpClientId').value;
            const period = document.getElementById('mpPeriod').value;
            const expectedAmount = document.getElementById('mpExpectedAmount').value;
            const dueDate = document.getElementById('mpDueDate').value;
            const status = document.getElementById('mpStatus').value;
            const paidDate = document.getElementById('mpPaidDate').value;
            const notes = document.getElementById('mpNotes').value;
            
            try {
                // First initialize/create the inline payment
                const res = await fetch('/api/legacy?api=save_inline', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        client_id: clientId,
                        period: period,
                        field: 'expected_amount',
                        value: expectedAmount
                    })
                });
                const result = await res.json();
                if (!result.success) throw new Error(result.error);
                
                // Set due date
                await fetch('/api/legacy?api=save_inline', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ client_id: clientId, period, field: 'due_date', value: dueDate })
                });
                
                // Set notes
                if (notes) {
                    await fetch('/api/legacy?api=save_inline', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ client_id: clientId, period, field: 'period_notes', value: notes })
                    });
                }
                
                // Set status / paid date
                if (status === 'paid') {
                    await fetch('/api/legacy?api=save_inline', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            client_id: clientId, period, field: 'status_with_date',
                            value: JSON.stringify({ status: 'paid', paid_date: paidDate })
                        })
                    });
                }
                
                showToast('Manuel ödeme eklendi', 'success');
                closeManualPaymentModal();
                loadPaymentsList();
                
            } catch (error) {
                console.error(error);
                showToast('Hata: ' + error.message, 'danger');
            }
        };

        window.openClientModal = function(id = null) {
            const form = document.getElementById('clientForm');
            form.reset();

            if (id) {
                const c = allClients.find(item => item.id == id);
                if (!c) return;

                document.getElementById('clientModalTitle').textContent = 'Müşteri Sözleşmesini Düzenle';
                document.getElementById('fieldClientId').value = c.id;
                document.getElementById('fieldClientName').value = c.name;
                document.getElementById('fieldProjectName').value = c.project_name;
                document.getElementById('fieldAgreedAmount').value = c.agreed_amount;
                document.getElementById('fieldCurrency').value = c.currency;
                document.getElementById('fieldPaymentDay').value = c.payment_day;
                document.getElementById('fieldPaymentType').value = c.payment_type;
                document.getElementById('fieldAccountInfo').value = c.account_info;
                document.getElementById('fieldAgreementDate').value = c.agreement_date;
                document.getElementById('fieldStartDate').value = c.start_date;
                document.getElementById('fieldClientStatus').value = c.status;
                document.getElementById('fieldClientNotes').value = c.notes || '';
                document.getElementById('fieldGracePeriod').value = c.grace_period_days || 5;
            } else {
                document.getElementById('clientModalTitle').textContent = 'Yeni Müşteri Anlaşması Ekle';
                document.getElementById('fieldClientId').value = '';
                document.getElementById('fieldProjectName').value = 'Reklam Hizmeti';
                document.getElementById('fieldPaymentType').value = 'net30';
                const today = new Date().toISOString().split('T')[0];
                document.getElementById('fieldAgreementDate').value = today;
                document.getElementById('fieldStartDate').value = today;
                document.getElementById('fieldClientStatus').value = 'aktif';
                document.getElementById('fieldGracePeriod').value = 5;
            }

            document.getElementById('clientModal').classList.add('show');
        };

        window.closeClientModal = function() {
            document.getElementById('clientModal').classList.remove('show');
        };

        // Handle Client Form Submit
        window.handleClientFormSubmit = async function(e) {
            e.preventDefault();

            const id = document.getElementById('fieldClientId').value;
            const name = document.getElementById('fieldClientName').value.trim();
            const project_name = document.getElementById('fieldProjectName').value.trim();
            const agreed_amount = parseFloat(document.getElementById('fieldAgreedAmount').value);
            const currency = document.getElementById('fieldCurrency').value;
            const payment_day = parseInt(document.getElementById('fieldPaymentDay').value);
            const payment_type = document.getElementById('fieldPaymentType').value;
            const account_info = document.getElementById('fieldAccountInfo').value;
            const status = document.getElementById('fieldClientStatus').value;
            const agreement_date = document.getElementById('fieldAgreementDate').value;
            const start_date = document.getElementById('fieldStartDate').value;
            const notes = document.getElementById('fieldClientNotes').value.trim();
            const grace_period_days = parseInt(document.getElementById('fieldGracePeriod').value) || 5;

            const payload = {
                id: id ? parseInt(id) : null,
                name, project_name, agreed_amount, currency, payment_day,
                payment_type, account_info, status, agreement_date, start_date, notes, grace_period_days
            };

            const isEdit = !!id;
            const endpoint = isEdit ? '/api/legacy?api=client_update' : '/api/legacy?api=client_create';

            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();
                if (result.success) {
                    showToast(isEdit ? 'Müşteri başarıyla güncellendi.' : 'Yeni müşteri anlaşması başarıyla eklendi.', 'success');
                    closeClientModal();
                    loadAllData();
                } else {
                    showToast('Veritabanı kayıt hatası: ' + result.error, 'danger');
                }
            } catch (err) {
                console.error(err);
            }
        };

        // Delete Client
        window.deleteClient = async function(id) {
            const c = allClients.find(item => item.id == id);
            if (!c) return;

            if (!confirm(`"${c.name}" müşterisini silmek istediğinizden emin misiniz?`)) return;

            try {
                const response = await fetch('/api/legacy?api=client_delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });

                const result = await response.json();
                if (result.success) {
                    showToast('Müşteri kaydı veritabanından silindi.', 'success');
                    loadAllData();
                }
            } catch (err) {
                console.error(err);
            }
        };

        // ==========================================
        // PAYMENT MODAL LOGIC
        // ==========================================
        window.openPaymentModal = function(clientId, period) {
            try {
                console.log('openPaymentModal called:', clientId, period);
                const p = allPayments.find(item => item.client_id == clientId && item.period == period);
                if (!p) {
                    console.error('Payment record not found for', clientId, period);
                    showToast('Ödeme kaydı bulunamadı', 'danger');
                    return;
                }

                document.getElementById('pmClientId').value = clientId;
                document.getElementById('pmPeriod').value = period;
                
                document.getElementById('paymentModalTitle').textContent = `${p.client_name} - ${formatPeriodBadge(period)}`;
                document.getElementById('pmAgreedAmount').textContent = formatCurrency(p.amount, p.currency);
                document.getElementById('pmCurrency').textContent = p.currency === 'TRY' ? '₺' : (p.currency === 'USD' ? '$' : '€');

                // Set default amount
                let defaultAmount = p.amount;
                if (p.paid_amount > 0 && p.status === 'partial') {
                    defaultAmount = p.amount - p.paid_amount; // Suggest remaining
                } else if (p.status === 'paid' && p.paid_amount > 0) {
                    defaultAmount = p.paid_amount;
                }
                document.getElementById('pmPaidAmount').value = defaultAmount;

                // Set default date
                if (p.paid_date) {
                    document.getElementById('pmPaidDate').value = p.paid_date;
                } else {
                    document.getElementById('pmPaidDate').value = new Date().toISOString().split('T')[0];
                }

                // Carry over button visibility
                const carryBtn = document.getElementById('pmCarryOverBtn');
                if (carryBtn) {
                    if (p.status === 'paid') {
                        carryBtn.style.display = 'none';
                    } else {
                        carryBtn.style.display = 'inline-flex';
                    }
                }

                const modal = document.getElementById('paymentModal');
                if (modal) {
                    modal.classList.add('show');
                } else {
                    console.error('paymentModal element not found');
                }
            } catch (err) {
                console.error('Error in openPaymentModal:', err);
                alert('Modal açılırken hata oluştu: ' + err.message);
            }
        };

        window.closePaymentModal = function() {
            document.getElementById('paymentModal').classList.remove('show');
        };

        window.submitPaymentModal = async function(e) {
            e.preventDefault();
            const btn = document.getElementById('pmSaveBtn');
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<span class="spinner-icon"></span>...';
            btn.disabled = true;

            const clientId = parseInt(document.getElementById('pmClientId').value, 10);
            const period = document.getElementById('pmPeriod').value;
            const paidAmount = parseFloat(document.getElementById('pmPaidAmount').value);
            const paidDate = document.getElementById('pmPaidDate').value;

            try {
                // Save Amount
                await fetch('/api/legacy?api=save_inline', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ client_id: clientId, period, field: 'paid_amount', value: paidAmount })
                });

                // Save Date
                await fetch('/api/legacy?api=save_inline', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ client_id: clientId, period, field: 'paid_date', value: paidDate })
                });

                showToast('Ödeme tahsil edildi.', 'success');
                closePaymentModal();
                loadPaymentsList();
            } catch (err) {
                console.error(err);
                showToast('Hata oluştu.', 'danger');
            } finally {
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }
        };

        window.handleCarryOverFromModal = function() {
            const clientId = parseInt(document.getElementById('pmClientId').value, 10);
            const period = document.getElementById('pmPeriod').value;
            closePaymentModal();
            carryOver(clientId, period);
        };

        // Kasa Functions
        window.loadKasa = async function() {
            try {
                const res = await fetch('/api/legacy?api=vault_stats');
                const result = await res.json();
                if (result.success) {
                    window.vaultHistoryData = result.data.history || [];
                    renderKasaGrid(result.data.accounts || []);
                    renderKasaHistory(window.vaultHistoryData);
                }
            } catch(e) {
                console.error(e);
            }
        };

        window.filterVaultHistory = function(accountName) {
            if (!window.vaultHistoryData) return;
            const filtered = window.vaultHistoryData.filter(t => t.accountName === accountName);
            renderKasaHistory(filtered);
            document.getElementById('btnResetVaultFilter').style.display = 'inline-block';
        };

        window.resetVaultFilter = function() {
            if (!window.vaultHistoryData) return;
            renderKasaHistory(window.vaultHistoryData);
            document.getElementById('btnResetVaultFilter').style.display = 'none';
        };

        function renderKasaGrid(accounts) {
            const grid = document.getElementById('kasaGrid');
            grid.innerHTML = '';
            
            // Calculate Total Balance
            let grandTotalTry = 0;
            accounts.forEach(acc => {
                if (acc.currency === 'TRY' || !acc.currency) {
                    grandTotalTry += acc.balance;
                }
            });
            document.getElementById('vaultGrandTotal').textContent = formatCurrency(grandTotalTry, 'TRY');

            if (accounts.length === 0) {
                grid.innerHTML = '<div style="padding: 40px; text-align: center; background: #f9f9f9; border-radius: 12px; border: 2px dashed #ddd; color: #888;">Henüz tanımlı kasa hesabı bulunmuyor. Yeni bir işlem ekleyerek başlayın.</div>';
                return;
            }

            accounts.forEach(acc => {
                const cardHtml = `
                    <div style="background: white; padding: 20px; border-radius: 12px; border: 1px solid hsl(var(--border-color)); box-shadow: 0 4px 12px rgba(0,0,0,0.02); display: flex; flex-direction: column;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                            <div>
                                <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: hsl(var(--text-primary));">${escapeHtml(acc.name)}</h3>
                                <span style="font-size: 12px; color: hsl(var(--text-secondary));">Kasa Hesabı</span>
                            </div>
                            <div style="background: hsla(var(--primary-rgb), 0.1); width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: hsl(var(--primary));">
                                <i data-lucide="wallet" style="width: 18px; height: 18px;"></i>
                            </div>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 8px; flex: 1;">
                            <div style="display: flex; justify-content: space-between; font-size: 13px;">
                                <span style="color: hsl(var(--text-secondary));">Toplam Gelen:</span>
                                <span style="font-weight: 700; color: hsl(var(--success));">+${formatCurrency(acc.income, acc.currency)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 13px;">
                                <span style="color: hsl(var(--text-secondary));">Toplam Çekilen:</span>
                                <span style="font-weight: 700; color: hsl(var(--danger));">-${formatCurrency(acc.withdrawn, acc.currency)}</span>
                            </div>
                        </div>
                        <div style="margin-top: auto; padding-top: 16px; border-top: 1px dashed hsl(var(--border-color)); display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 12px;">
                            <div style="display: flex; flex-direction: column;">
                                <span style="font-size: 11px; color: hsl(var(--text-muted)); font-weight: 600;">MEVCUT BAKİYE</span>
                                <span style="font-size: 20px; font-weight: 900; color: hsl(var(--text-primary));">${formatCurrency(acc.balance, acc.currency)}</span>
                            </div>
                            <div style="display: flex; gap: 4px;">
                                <button class="btn" style="padding: 6px 10px; font-size: 12px; background: hsl(var(--bg-card)); color: hsl(var(--text-primary)); border: 1px solid hsl(var(--border-color));" onclick="filterVaultHistory('${escapeHtml(acc.name)}')">Geçmiş</button>
                                <button class="btn" style="padding: 6px 10px; font-size: 12px; background: hsl(var(--bg-card)); color: hsl(var(--text-primary)); border: 1px solid hsl(var(--border-color));" onclick="adjustKasaBalance('${escapeHtml(acc.name)}', ${acc.balance})">Eşitle</button>
                                <button class="btn" style="padding: 6px 10px; font-size: 12px; background: hsl(var(--success)); color: white;" onclick="openKasaTransactionModal('${escapeHtml(acc.name)}', 'income')">+ Giriş</button>
                                <button class="btn btn-primary" style="padding: 6px 10px; font-size: 12px;" onclick="openKasaTransactionModal('${escapeHtml(acc.name)}', 'expense')">- Çıkış</button>
                            </div>
                        </div>
                    </div>
                `;
                grid.insertAdjacentHTML('beforeend', cardHtml);
            });
            lucide.createIcons();
        }

        function renderKasaHistory(historyParam) {
            const tbody = document.getElementById('kasaHistoryTableBody');
            tbody.innerHTML = '';
            
            let dataToRender = window.vaultHistoryData || [];

            // Apply filters
            const fDate = document.getElementById('filterKasaDate')?.value;
            const fAccount = document.getElementById('filterKasaAccount')?.value;
            const fType = document.getElementById('filterKasaType')?.value;
            const fAmount = document.getElementById('filterKasaAmount')?.value;

            if (fDate) dataToRender = dataToRender.filter(t => t.date === fDate);
            if (fAccount) dataToRender = dataToRender.filter(t => t.accountName === fAccount);
            if (fType) dataToRender = dataToRender.filter(t => t.type === fType);
            if (fAmount) dataToRender = dataToRender.filter(t => t.amount.toString().includes(fAmount));

            if (dataToRender.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: hsl(var(--text-muted)); padding: 24px;">Filtrelere uygun işlem bulunamadı.</td></tr>';
                return;
            }

            dataToRender.forEach(item => {
                const [y, m, d] = item.date.split('-');
                const isIncome = item.type === 'income';
                const sign = isIncome ? '+' : '-';
                const color = isIncome ? 'hsl(var(--success))' : 'hsl(var(--danger))';
                const typeLabel = isIncome ? 'Giriş' : 'Çıkış';
                
                const itemData = encodeURIComponent(JSON.stringify(item));
                
                const html = `
                    <tr>
                        <td style="padding: 10px 14px; font-weight: 600; color: hsl(var(--text-primary)); text-align: center; white-space: nowrap;">${d}.${m}.${y}</td>
                        <td style="padding: 10px 14px; text-align: center;">
                            <span style="background: hsla(var(--primary-rgb), 0.1); color: hsl(var(--primary)); padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: 700; white-space: nowrap;">
                                ${escapeHtml(item.accountName)}
                            </span>
                        </td>
                        <td style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: ${color}; text-align: center;">${typeLabel}</td>
                        <td style="padding: 10px 14px; color: hsl(var(--text-secondary)); font-size: 13px; text-align: center;">${escapeHtml(item.description || item.clientName || '-')}</td>
                        <td style="padding: 10px 14px; text-align: right; font-weight: 800; color: ${color}; white-space: nowrap;">
                            ${sign}${formatCurrency(item.amount, item.currency)}
                        </td>
                        <td style="padding: 10px 14px;">
                            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 2px;">
                                ${item.attachmentUrl ? `<button class="icon-btn" style="color: hsl(var(--primary));" onclick="viewInvoiceImage('${item.attachmentUrl}')" title="Faturayı Gör"><i data-lucide="image" style="width:15px;height:15px;"></i></button>` : ''}
                                <button class="icon-btn edit" onclick="editKasaTransaction('${itemData}')" title="Düzenle">
                                    <i data-lucide="edit-2" style="width:15px;height:15px;"></i>
                                </button>
                                <button class="icon-btn delete" onclick="deleteKasaTransaction(${item.id})" title="Sil">
                                    <i data-lucide="trash-2" style="width:15px;height:15px;"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
                tbody.insertAdjacentHTML('beforeend', html);
            });
            lucide.createIcons();
        }

        window.openKasaTransactionModal = function(accountName = '', defaultType = 'expense') {
            document.getElementById('ktId').value = '';
            document.getElementById('ktAccountName').value = accountName;
            document.getElementById('ktType').value = defaultType;
            document.getElementById('ktAmount').value = '';
            document.getElementById('ktDate').value = new Date().toISOString().split('T')[0];
            document.getElementById('ktNotes').value = '';
            document.getElementById('ktImage').value = ''; // Reset file input
            document.getElementById('ktImageBase64').value = ''; // Reset base64
            document.getElementById('ktType').disabled = false;
            document.getElementById('ktAccountName').disabled = (accountName !== '');

            
            // Populate clients dropdown
            const clientSelect = document.getElementById('ktClientName');
            clientSelect.innerHTML = '<option value="">-- Müşteri Yok / Manuel İşlem --</option>';
            allClients.forEach(c => {
                clientSelect.innerHTML += `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`;
            });
            clientSelect.value = '';
            
            document.getElementById('kasaTransactionModal').classList.add('show');
        };

        window.editKasaTransaction = function(dataStr) {
            const item = JSON.parse(decodeURIComponent(dataStr));
            document.getElementById('ktId').value = item.id;
            document.getElementById('ktAccountName').value = item.accountName;
            document.getElementById('ktType').value = item.type;
            document.getElementById('ktAmount').value = item.amount;
            document.getElementById('ktDate').value = item.date;
            document.getElementById('ktNotes').value = item.description || '';
            document.getElementById('ktType').disabled = true;
            document.getElementById('ktAccountName').disabled = false;

            const clientSelect = document.getElementById('ktClientName');
            clientSelect.innerHTML = '<option value="">-- Müşteri Yok / Manuel İşlem --</option>';
            allClients.forEach(c => {
                clientSelect.innerHTML += `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`;
            });
            clientSelect.value = item.clientName || '';
            
            document.getElementById('kasaTransactionModal').classList.add('show');
        };

        window.closeKasaTransactionModal = function() {
            document.getElementById('kasaTransactionModal').classList.remove('show');
        };

        window.submitKasaTransaction = async function(e) {
            e.preventDefault();
            const btn = document.getElementById('ktSaveBtn');
            const orig = btn.innerHTML;
            btn.innerHTML = '...';
            btn.disabled = true;

            const id = document.getElementById('ktId').value;
            const apiEndpoint = id ? 'vault_transaction_update' : 'vault_transaction_create';

            const payload = {
                account_name: document.getElementById('ktAccountName').value,
                type: document.getElementById('ktType').value,
                amount: document.getElementById('ktAmount').value,
                date: document.getElementById('ktDate').value,
                description: document.getElementById('ktNotes').value,
                client_name: document.getElementById('ktClientName').value,
                attachment_url: document.getElementById('ktImageBase64').value || undefined
            };

        window.handleVaultImageSelect = function(e) {
            const file = e.target.files[0];
            if (!file) {
                document.getElementById('ktImageBase64').value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = function(event) {
                const img = new Image();
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const max_size = 1200;
                    if (width > height) {
                        if (width > max_size) {
                            height *= max_size / width;
                            width = max_size;
                        }
                    } else {
                        if (height > max_size) {
                            width *= max_size / height;
                            height = max_size;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    document.getElementById('ktImageBase64').value = dataUrl;
                }
                img.src = event.target.result;
            }
            reader.readAsDataURL(file);
        };

        window.viewInvoiceImage = function(url) {
            document.getElementById('imageViewPreview').src = url;
            document.getElementById('imageViewModal').classList.add('active');
        };

        window.closeInvoiceImage = function() {
            document.getElementById('imageViewModal').classList.remove('active');
            document.getElementById('imageViewPreview').src = '';
        };
            
            if (id) payload.id = id;

            try {
                const res = await fetch('/api/legacy?api=' + apiEndpoint, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(payload)
                });
                const result = await res.json();
                if (result.success) {
                    showToast('İşlem kaydedildi.', 'success');
                    closeKasaTransactionModal();
                    loadKasa();
                } else {
                    showToast('Hata: ' + result.error, 'danger');
                }
            } catch(err) {
                showToast('Bağlantı hatası.', 'danger');
            } finally {
                btn.innerHTML = orig;
                btn.disabled = false;
            }
        };

        window.deleteKasaTransaction = async function(id) {
            if (!confirm('Bu işlemi tamamen silmek istediğinize emin misiniz?')) return;
            try {
                const res = await fetch('/api/legacy?api=vault_transaction_delete', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ id })
                });
                const result = await res.json();
                if (result.success) {
                    showToast('İşlem silindi.', 'success');
                    loadKasa();
                } else {
                    showToast('Hata: ' + result.error, 'danger');
                }
            } catch(e) {
                showToast('Bağlantı hatası.', 'danger');
            }
        };

        window.adjustKasaBalance = async function(accountName, currentBalance) {
            const val = prompt(`'${accountName}' hesabı için mevcut bakiye: ${currentBalance}\n\nLütfen olmasını istediğiniz net bakiye tutarını yazın:`, currentBalance);
            if (val === null || val.trim() === '') return;
            const targetBalance = parseFloat(val);
            if (isNaN(targetBalance)) {
                alert('Geçersiz bir tutar girdiniz.');
                return;
            }

            try {
                const res = await fetch('/api/legacy?api=vault_balance_adjust', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ account_name: accountName, target_balance: targetBalance })
                });
                const result = await res.json();
                if (result.success) {
                    showToast('Bakiye başarıyla eşitlendi.', 'success');
                    loadKasa();
                } else {
                    showToast('Hata: ' + result.error, 'danger');
                }
            } catch(e) {
                showToast('Bağlantı hatası.', 'danger');
            }
        };


        // Note: loadAllData() and loadKasa() are called via DOMContentLoaded event

        // Helper to show notifications
        function showToast(message, type = 'success') {
            const toast = document.getElementById('notificationToast');
            const msgEl = document.getElementById('toastMessage');
            const iconEl = toast.querySelector('.toast-icon');

            msgEl.textContent = message;
            
            toast.style.borderLeftColor = type === 'success' ? 'hsl(var(--success))' : 'hsl(var(--danger))';
            iconEl.style.color = type === 'success' ? 'hsl(var(--success))' : 'hsl(var(--danger))';
            
            if (type === 'success') {
                iconEl.setAttribute('data-lucide', 'check-circle-2');
            } else {
                iconEl.setAttribute('data-lucide', 'x-circle');
            }
            
            lucide.createIcons();
            toast.classList.add('show');
            
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }
    