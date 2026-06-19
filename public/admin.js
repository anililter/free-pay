// Admin Panel JavaScript
let contentData = {
    pages: {},
    texts: {},
    logos: {},
    icons: {},
    images: {}
};

// Site data (prices, references, blog, websiteReferences) - used by Fiyatlar, Referanslar, Bloglar, Web Siteleri
let siteData = {
    prices: { webPackages: [{ id: 'baslangic', name: 'Başlangıç', price: 35000 }, { id: 'profesyonel', name: 'Profesyonel', price: 55000 }] },
    references: [],
    blog: [],
    websiteReferences: []
};

// Initialize Admin Panel
document.addEventListener('DOMContentLoaded', function() {
    loadSavedData();
    loadSiteData(); // from localStorage or fetch data/site-data.json
    setupNavigation();
    setupTabs();
    updateStats();
});

// Navigation Setup
function setupNavigation() {
    const navLinks = document.querySelectorAll('.admin-nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            showSection(section);
            
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

// Show Section (sadece ana section'ları gizle; içteki div.admin-section form kutuları kalır)
function showSection(sectionName) {
    const sections = document.querySelectorAll('section.admin-section');
    sections.forEach(s => s.classList.add('hidden'));
    
    const targetSection = document.getElementById(sectionName + '-section');
    if (targetSection) {
        targetSection.classList.remove('hidden');
    }
    if (sectionName === 'prices') displayPrices();
    else if (sectionName === 'references') displayReferences();
    else if (sectionName === 'blog') displayBlogList();
    else if (sectionName === 'websites') displayWebsiteRefs();
}

// Tabs Setup
function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Handle tab content switching
            if (tabName === 'all-pages') {
                displayPages('all');
            } else if (tabName === 'main-pages') {
                displayPages('main');
            } else if (tabName === 'service-pages') {
                displayPages('service');
            }
        });
    });
}

// All page paths (extensionless URLs)
const ALL_PAGE_FILES = [
    'index',
    'hakkinda',
    'referanslar',
    'blog',
    'iletisim',
    'psikologlar-google-ads',
    'gizlilik-politikasi',
    'kullanim-sartlari',
    'cerezlerin-kullanimi',
    'yasal-bilgiler',
    'satis-para-iadesi',
    'bilgi-toplumu-hizmetleri',
    'site-haritasi',
    'hizmetler/dijital-reklam',
    'hizmetler/sosyal-medya',
    'hizmetler/seo',
    'hizmetler/google-ads',
    'hizmetler/medya-planlama',
    'hizmetler/produksiyon',
    'hizmetler/kreatif',
    'hizmetler/yazilim',
    'hizmetler/arama-motoru-optimizasyonu',
    'hizmetler/facebook-reklamlari',
    'hizmetler/instagram-reklamlari',
    'hizmetler/youtube-reklamlari',
    'hizmetler/linkedin-reklamlari',
    'hizmetler/tiktok-reklamlari',
    'hizmetler/snapchat-reklamlari',
    'hizmetler/x-reklamlari',
    'hizmetler/gmail-reklamlari',
    'hizmetler/google-haritalar',
    'hizmetler/web-site-tasarimi',
    'hizmetler/e-ticaret-web-sitesi',
    'hizmetler/kurumsal-web-sitesi',
    'hizmetler/landing-page-tasarimi',
    'hizmetler/mobil-app-tasarim',
    'hizmetler/mobil-app-gelistirme',
    'hizmetler/ui-ux-tasarim',
    'hizmetler/logo-kurumsal-kimlik',
    'hizmetler/banner-tasarimi',
    'hizmetler/video-tasarimi',
    'hizmetler/video-kurgu-montaj',
    'hizmetler/motion-grafik',
    'hizmetler/reklam-filmi',
    'hizmetler/tanitim-filmi',
    'hizmetler/etkinlik-cekimi',
    'hizmetler/drone-cekimi',
    'hizmetler/sosyal-medya-video',
    'hizmetler/sosyal-medya-yonetimi',
    'hizmetler/influencer-marketing',
    'hizmetler/moderasyon-hizmeti',
    'hizmetler/icerik-pazarlamasi',
    'hizmetler/programatik-reklamlar',
    'hizmetler/tv-medya-planlama',
    'hizmetler/radyo-reklamlari',
    'hizmetler/sinema-reklamlari',
    'hizmetler/acik-hava-reklamciligi',
    'hizmetler/dijital-medya-planlama',
    'hizmetler/youtube-seo',
    'hizmetler/mobil-uygulama-reklamlari',
    'hizmetler/ozel-yazilim-proje',
    'blog/google-ads-2026'
];

// Scan All Pages
async function scanAllPages() {
    const pagesList = document.getElementById('pages-list');
    pagesList.innerHTML = '<div class="loading">Sayfalar taranıyor... Bu işlem biraz zaman alabilir.</div>';
    
    let scanned = 0;
    const total = ALL_PAGE_FILES.length;
    
    try {
        for (const pageFile of ALL_PAGE_FILES) {
            try {
                const pageResponse = await fetch(pageFile);
                if (!pageResponse.ok) {
                    console.warn(`Could not load ${pageFile}`);
                    continue;
                }
                
                const pageHtml = await pageResponse.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(pageHtml, 'text/html');
                
                const pageData = {
                    file: pageFile,
                    title: doc.querySelector('title')?.textContent || 'Başlıksız',
                    texts: extractTexts(doc),
                    logos: extractLogos(doc),
                    icons: extractIcons(doc),
                    images: extractImages(doc)
                };
                
                contentData.pages[pageFile] = pageData;
                scanned++;
                
                // Update progress
                pagesList.innerHTML = `<div class="loading">Taranıyor: ${scanned}/${total} - ${pageFile}</div>`;
            } catch (error) {
                console.error(`Error loading ${pageFile}:`, error);
            }
        }
        
        displayPages('all');
        updateStats();
        
        // Show success message
        showAlert(`${scanned} sayfa başarıyla tarandı!`, 'success');
    } catch (error) {
        console.error('Error scanning pages:', error);
        showAlert('Sayfalar taranırken bir hata oluştu.', 'error');
    }
}

// Extract Texts from Document
function extractTexts(doc) {
    const texts = [];
    const textElements = doc.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, a, li, td, th, .section-title, .section-subtitle, .hero-title, .hero-subtitle');
    
    textElements.forEach((el, index) => {
        const text = el.textContent.trim();
        if (text && text.length > 0 && !el.querySelector('svg')) {
            const id = el.id || `text-${index}`;
            texts.push({
                id: id,
                selector: generateSelector(el),
                text: text,
                tag: el.tagName.toLowerCase(),
                className: el.className
            });
        }
    });
    
    return texts;
}

// Extract Logos from Document
function extractLogos(doc) {
    const logos = [];
    const logoElements = doc.querySelectorAll('img[src*="logo"], .logo img, .footer-logo-img');
    
    logoElements.forEach((el, index) => {
        const id = el.id || `logo-${index}`;
        logos.push({
            id: id,
            selector: generateSelector(el),
            src: el.src || el.getAttribute('src'),
            alt: el.alt || ''
        });
    });
    
    return logos;
}

// Extract Icons from Document
function extractIcons(doc) {
    const icons = [];
    const iconElements = doc.querySelectorAll('svg, .icon, [class*="icon"]');
    
    iconElements.forEach((el, index) => {
        if (el.tagName.toLowerCase() === 'svg' || el.querySelector('svg')) {
            const id = el.id || `icon-${index}`;
            icons.push({
                id: id,
                selector: generateSelector(el),
                html: el.outerHTML
            });
        }
    });
    
    return icons;
}

// Extract Images from Document
function extractImages(doc) {
    const images = [];
    const imageElements = doc.querySelectorAll('img:not([src*="logo"])');
    
    imageElements.forEach((el, index) => {
        const id = el.id || `image-${index}`;
        images.push({
            id: id,
            selector: generateSelector(el),
            src: el.src || el.getAttribute('src'),
            alt: el.alt || ''
        });
    });
    
    return images;
}

// Generate CSS Selector
function generateSelector(element) {
    if (element.id) {
        return `#${element.id}`;
    }
    
    let selector = element.tagName.toLowerCase();
    if (element.className) {
        const classes = element.className.split(' ').filter(c => c).join('.');
        if (classes) {
            selector += '.' + classes;
        }
    }
    
    // Add parent context
    const parent = element.parentElement;
    if (parent) {
        const parentSelector = generateSelector(parent);
        return `${parentSelector} > ${selector}`;
    }
    
    return selector;
}

// Display Pages
function displayPages(filter = 'all') {
    const pagesList = document.getElementById('pages-list');
    pagesList.innerHTML = '';
    
    const pages = Object.values(contentData.pages);
    let filteredPages = pages;
    
    if (filter === 'main') {
        filteredPages = pages.filter(p => !p.file.includes('hizmetler/'));
    } else if (filter === 'service') {
        filteredPages = pages.filter(p => p.file.includes('hizmetler/'));
    }
    
    if (filteredPages.length === 0) {
        pagesList.innerHTML = '<div class="loading">Henüz sayfa taranmadı. "Tüm Sayfaları Tara" butonuna tıklayın.</div>';
        return;
    }
    
    filteredPages.forEach(page => {
        const pageItem = document.createElement('div');
        pageItem.className = 'content-item';
        pageItem.innerHTML = `
            <div class="content-item-header">
                <div>
                    <div class="content-item-title">${page.title}</div>
                    <div class="content-item-path">${page.file}</div>
                </div>
                <div class="content-item-actions">
                    <button class="btn btn-primary btn-small" onclick="editPage('${page.file}')">Düzenle</button>
                    <button class="btn btn-secondary btn-small" onclick="viewPage('${page.file}')">Görüntüle</button>
                </div>
            </div>
            <div class="content-item-preview">
                <strong>Metinler:</strong> ${page.texts.length} | 
                <strong>Logolar:</strong> ${page.logos.length} | 
                <strong>İkonlar:</strong> ${page.icons.length} | 
                <strong>Görseller:</strong> ${page.images.length}
            </div>
        `;
        pagesList.appendChild(pageItem);
    });
}

// Display Texts
function displayTexts() {
    const textsList = document.getElementById('texts-list');
    textsList.innerHTML = '';
    
    const allTexts = [];
    Object.values(contentData.pages).forEach(page => {
        if (page.texts) {
            page.texts.forEach(text => {
                allTexts.push({
                    ...text,
                    page: page.file
                });
            });
        }
    });
    
    if (allTexts.length === 0) {
        textsList.innerHTML = '<div class="loading">Henüz metin bulunamadı. "Tüm Sayfaları Tara" butonuna tıklayın.</div>';
        return;
    }
    
    // Group by page
    const textsByPage = {};
    allTexts.forEach(text => {
        if (!textsByPage[text.page]) {
            textsByPage[text.page] = [];
        }
        textsByPage[text.page].push(text);
    });
    
    Object.keys(textsByPage).forEach(pageFile => {
        const pageHeader = document.createElement('div');
        pageHeader.style.cssText = 'font-size: 18px; font-weight: 600; margin: 24px 0 12px 0; padding-bottom: 8px; border-bottom: 2px solid #0071e3;';
        pageHeader.textContent = pageFile;
        textsList.appendChild(pageHeader);
        
        textsByPage[pageFile].forEach(text => {
            const textItem = document.createElement('div');
            textItem.className = 'content-item';
            const escapedPage = pageFile.replace(/'/g, "\\'");
            const escapedId = text.id.replace(/'/g, "\\'");
            textItem.innerHTML = `
                <div class="content-item-header">
                    <div>
                        <div class="content-item-title">${text.tag.toUpperCase()}</div>
                        <div class="content-item-path">${text.selector || 'N/A'}</div>
                    </div>
                    <div class="content-item-actions">
                        <button class="btn btn-primary btn-small" onclick="editText('${escapedPage}', '${escapedId}')">Düzenle</button>
                    </div>
                </div>
                <div class="content-item-preview">${escapeHtml(text.text.substring(0, 200))}${text.text.length > 200 ? '...' : ''}</div>
            `;
            textsList.appendChild(textItem);
        });
    });
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Edit Text
function editText(pageFile, textId) {
    const page = contentData.pages[pageFile];
    if (!page) {
        showAlert('Sayfa bulunamadı!', 'error');
        return;
    }
    
    const text = page.texts.find(t => t.id === textId);
    if (!text) {
        showAlert('Metin bulunamadı!', 'error');
        return;
    }
    
    // Create modal for editing
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;';
    modal.innerHTML = `
        <div style="background: white; border-radius: 16px; padding: 32px; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto;">
            <h2 style="margin-bottom: 16px; font-size: 22px;">Metin Düzenle</h2>
            <div style="margin-bottom: 16px; font-size: 13px; color: #86868b;">
                <div><strong>Sayfa:</strong> ${pageFile}</div>
                <div><strong>Selector:</strong> ${text.selector || 'N/A'}</div>
                <div><strong>Tag:</strong> ${text.tag}</div>
            </div>
            <div class="form-group" style="margin-bottom: 24px;">
                <label class="form-label">Metin İçeriği</label>
                <textarea id="edit-text-area" class="form-textarea" style="min-height: 150px;">${escapeHtml(text.text)}</textarea>
            </div>
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button class="btn btn-secondary" onclick="this.closest('div[style*=\"position: fixed\"]').remove()">İptal</button>
                <button class="btn btn-primary" onclick="saveTextEdit('${pageFile.replace(/'/g, "\\'")}', '${textId.replace(/'/g, "\\'")}')">Kaydet</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Focus on textarea
    setTimeout(() => {
        document.getElementById('edit-text-area').focus();
    }, 100);
}

// Save Text Edit
function saveTextEdit(pageFile, textId) {
    const page = contentData.pages[pageFile];
    if (!page) return;
    
    const text = page.texts.find(t => t.id === textId);
    if (!text) return;
    
    const textarea = document.getElementById('edit-text-area');
    const newText = textarea.value.trim();
    
    if (newText !== text.text) {
        text.text = newText;
        text.updated = true;
        text.updatedAt = new Date().toISOString();
        
        // Save to localStorage
        saveToLocalStorage();
        
        showAlert('Metin güncellendi!', 'success');
        document.querySelector('div[style*="position: fixed"]').remove();
        displayTexts();
    } else {
        document.querySelector('div[style*="position: fixed"]').remove();
    }
}

// Edit Page
function editPage(pageFile) {
    const page = contentData.pages[pageFile];
    if (!page) return;
    
    // Create edit modal
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;';
    modal.innerHTML = `
        <div style="background: white; border-radius: 16px; padding: 32px; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto;">
            <h2 style="margin-bottom: 24px;">${page.title} - Düzenle</h2>
            <div id="page-edit-content"></div>
            <div style="margin-top: 24px; display: flex; gap: 12px; justify-content: flex-end;">
                <button class="btn btn-secondary" onclick="this.closest('div[style*=\"position: fixed\"]').remove()">İptal</button>
                <button class="btn btn-primary" onclick="savePageEdit('${pageFile}')">Kaydet</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    const content = document.getElementById('page-edit-content');
    
    // Add text editors
    page.texts.forEach(text => {
        const textGroup = document.createElement('div');
        textGroup.className = 'form-group';
        textGroup.innerHTML = `
            <label class="form-label">${text.tag.toUpperCase()} - ${text.selector}</label>
            <textarea class="form-textarea" data-text-id="${text.id}">${text.text}</textarea>
        `;
        content.appendChild(textGroup);
    });
}

// Save Page Edit
function savePageEdit(pageFile) {
    const page = contentData.pages[pageFile];
    if (!page) return;
    
    const textareas = document.querySelectorAll(`#page-edit-content textarea`);
    textareas.forEach(textarea => {
        const textId = textarea.getAttribute('data-text-id');
        const text = page.texts.find(t => t.id === textId);
        if (text && textarea.value !== text.text) {
            text.text = textarea.value;
            text.updated = true;
        }
    });
    
    saveToLocalStorage();
    showAlert('Sayfa güncellendi!', 'success');
    document.querySelector('div[style*="position: fixed"]').remove();
    displayPages();
}

// Handle Logo Upload
function handleLogoUpload(type, input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const previewId = type === 'main' ? 'main-logo-preview' : 'footer-logo-preview';
        const preview = document.getElementById(previewId);
        preview.src = e.target.result;
        preview.classList.remove('hidden');
        
        // Save logo data
        if (!contentData.logos[type]) {
            contentData.logos[type] = {};
        }
        contentData.logos[type].src = e.target.result;
        contentData.logos[type].file = file.name;
        contentData.logos[type].updated = true;
        
        saveToLocalStorage();
        showAlert('Logo yüklendi!', 'success');
    };
    reader.readAsDataURL(file);
}

// Filter Functions
function filterPages() {
    const search = document.getElementById('page-search').value.toLowerCase();
    const items = document.querySelectorAll('#pages-list .content-item');
    
    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(search) ? 'block' : 'none';
    });
}

function filterTexts() {
    const search = document.getElementById('text-search').value.toLowerCase();
    const items = document.querySelectorAll('#texts-list .content-item');
    
    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(search) ? 'block' : 'none';
    });
}

function filterIcons() {
    const search = document.getElementById('icon-search').value.toLowerCase();
    const items = document.querySelectorAll('#icons-list .content-item');
    
    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(search) ? 'block' : 'none';
    });
}

function filterImages() {
    const search = document.getElementById('image-search').value.toLowerCase();
    const items = document.querySelectorAll('#images-list .content-item');
    
    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(search) ? 'block' : 'none';
    });
}

// Update Stats
function updateStats() {
    const pages = Object.keys(contentData.pages).length;
    const texts = Object.values(contentData.pages).reduce((sum, page) => sum + page.texts.length, 0);
    const logos = Object.keys(contentData.logos).length;
    const icons = Object.values(contentData.pages).reduce((sum, page) => sum + page.icons.length, 0);
    
    document.getElementById('total-pages').textContent = pages;
    document.getElementById('total-texts').textContent = texts;
    document.getElementById('total-logos').textContent = logos;
    document.getElementById('total-icons').textContent = icons;
}

// Save to LocalStorage
function saveToLocalStorage() {
    try {
        localStorage.setItem('adminContentData', JSON.stringify(contentData));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
}

// Load from LocalStorage
function loadSavedData() {
    try {
        const saved = localStorage.getItem('adminContentData');
        if (saved) {
            contentData = JSON.parse(saved);
        }
    } catch (error) {
        console.error('Error loading from localStorage:', error);
    }
}

// --- Site Data (Fiyatlar, Referanslar, Bloglar) ---

function loadSiteData() {
    const fromStorage = localStorage.getItem('adminSiteData');
    if (fromStorage) {
        try {
            const parsed = JSON.parse(fromStorage);
            if (parsed.prices && parsed.prices.webPackages) siteData.prices = parsed.prices;
            if (Array.isArray(parsed.references)) siteData.references = parsed.references;
            if (Array.isArray(parsed.blog)) siteData.blog = parsed.blog;
            if (Array.isArray(parsed.websiteReferences)) siteData.websiteReferences = parsed.websiteReferences;
        } catch (e) { console.warn('adminSiteData parse error', e); }
    }
    loadSiteDataFromServer();
}

function loadSiteDataFromServer() {
    const statusEl = document.getElementById('site-data-load-status');
    if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.className = 'alert';
        statusEl.textContent = 'Yükleniyor...';
    }
    fetch((window.location.pathname || '').replace(/\/[^/]*$/, '') + '/data/site-data.json')
        .then(r => r.ok ? r.json() : Promise.reject(new Error('Dosya bulunamadı')))
        .then(data => {
            if (data.prices && data.prices.webPackages) siteData.prices = data.prices;
            if (Array.isArray(data.references)) siteData.references = data.references;
            if (Array.isArray(data.blog)) siteData.blog = data.blog;
            if (Array.isArray(data.websiteReferences)) siteData.websiteReferences = data.websiteReferences;
            if (statusEl) {
                statusEl.textContent = 'Sunucudan site-data.json yüklendi.';
                statusEl.className = 'alert alert-success';
            }
            displayPrices();
            displayReferences();
            displayBlogList();
            displayWebsiteRefs();
        })
        .catch(() => {
            if (statusEl) {
                statusEl.textContent = 'data/site-data.json yüklenemedi (yerel veri veya sunucu yok). Yerel kayıt kullanılıyor.';
                statusEl.className = 'alert alert-error';
            }
            displayPrices();
            displayReferences();
            displayBlogList();
            displayWebsiteRefs();
        });
}

function saveSiteData() {
    const payload = {
        prices: siteData.prices,
        references: siteData.references,
        blog: siteData.blog,
        websiteReferences: siteData.websiteReferences || []
    };
    localStorage.setItem('adminSiteData', JSON.stringify(payload));
    showAlert('Site verisi yerel olarak kaydedildi.', 'success');
}

function exportSiteDataJson() {
    const payload = {
        prices: siteData.prices,
        references: siteData.references,
        blog: siteData.blog,
        websiteReferences: siteData.websiteReferences || []
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'site-data.json';
    a.click();
    URL.revokeObjectURL(a.href);
    showAlert('site-data.json indirildi. data/site-data.json olarak yükleyip deploy edin.', 'success');
}

function displayPrices() {
    const list = document.getElementById('prices-list');
    if (!list) return;
    if (!siteData.prices) siteData.prices = {};
    if (!Array.isArray(siteData.prices.webPackages) || siteData.prices.webPackages.length === 0) {
        siteData.prices.webPackages = [
            { id: 'baslangic', name: 'Başlangıç', price: 35000 },
            { id: 'profesyonel', name: 'Profesyonel', price: 55000 }
        ];
    }
    const packages = siteData.prices.webPackages;
    list.innerHTML = packages.map((pkg, i) => {
        var name = (pkg.name || '').toString();
        var price = pkg.price != null ? Number(pkg.price) : '';
        var id = (pkg.id || '').toString();
        return '<div class="content-item" style="margin-bottom:16px;">' +
            '<div class="form-group">' +
            '<label class="form-label">Paket adı</label>' +
            '<input type="text" class="form-input" data-prices-idx="' + i + '" data-field="name" value="' + escapeHtml(name) + '" onchange="updatePriceField(' + i + ', \'name\', this.value)">' +
            '</div>' +
            '<div class="form-group">' +
            '<label class="form-label">Fiyat (TL, sayı)</label>' +
            '<input type="number" class="form-input" data-prices-idx="' + i + '" data-field="price" value="' + price + '" onchange="updatePriceField(' + i + ', \'price\', this.value)">' +
            '</div>' +
            '<small style="color:#86868b;">ID: ' + escapeHtml(id) + ' (değiştirmeyin)</small>' +
            '</div>';
    }).join('');
}

function updatePriceField(idx, field, value) {
    const packages = siteData.prices.webPackages || [];
    if (packages[idx]) {
        if (field === 'price') packages[idx].price = parseInt(value, 10) || 0;
        else packages[idx].name = String(value).trim();
    }
}

function displayReferences() {
    const list = document.getElementById('references-list');
    if (!list) return;
    if (!Array.isArray(siteData.references)) siteData.references = [];
    const refs = siteData.references;
    list.innerHTML = refs.map((r, i) => `
        <div class="content-item" style="margin-bottom:16px;">
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                <div class="form-group">
                    <label class="form-label">Görsel yolu (Referanslar/xxx.avif) veya boş (sadece metin)</label>
                    <input type="text" class="form-input" value="${escapeHtml((r.src || '') + '')}" onchange="updateReference(${i}, 'src', this.value)">
                </div>
                <div class="form-group">
                    <label class="form-label">Alt metin</label>
                    <input type="text" class="form-input" value="${escapeHtml((r.alt || '') + '')}" onchange="updateReference(${i}, 'alt', this.value)">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Kategori (boşlukla ayrılmış: saglik psikoloji)</label>
                <input type="text" class="form-input" value="${escapeHtml((r.category || '') + '')}" onchange="updateReference(${i}, 'category', this.value)">
            </div>
            <div class="form-group">
                <label class="form-label">Sadece metin referans (logo yoksa buraya yaz)</label>
                <input type="text" class="form-input" value="${escapeHtml((r.text || '') + '')}" onchange="updateReference(${i}, 'text', this.value)">
            </div>
            <button type="button" class="btn btn-danger btn-small" onclick="removeReference(${i})">Sil</button>
        </div>
    `).join('') || '<p class="loading">Referans yok. Sunucudan Yükle veya + Yeni Referans.</p>';
}

function updateReference(idx, field, value) {
    if (!siteData.references[idx]) siteData.references[idx] = { src: null, alt: null, category: '', text: null };
    siteData.references[idx][field] = value === '' ? null : value;
}

function addReference() {
    siteData.references = siteData.references || [];
    siteData.references.push({ src: '', alt: '', category: 'diger', text: null });
    displayReferences();
}

function removeReference(idx) {
    siteData.references.splice(idx, 1);
    displayReferences();
}

function displayBlogList() {
    const list = document.getElementById('blog-list');
    if (!list) return;
    if (!Array.isArray(siteData.blog)) siteData.blog = [];
    const posts = siteData.blog;
    list.innerHTML = posts.map((p, i) => `
        <div class="content-item" style="margin-bottom:20px;">
            <div class="form-group">
                <label class="form-label">Başlık</label>
                <input type="text" class="form-input" value="${escapeHtml((p.title || '') + '')}" onchange="updateBlogPost(${i}, 'title', this.value)">
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                <div class="form-group">
                    <label class="form-label">Slug (URL: blog/slug)</label>
                    <input type="text" class="form-input" value="${escapeHtml((p.slug || '') + '')}" onchange="updateBlogPost(${i}, 'slug', this.value)">
                </div>
                <div class="form-group">
                    <label class="form-label">Kategori</label>
                    <input type="text" class="form-input" value="${escapeHtml((p.category || '') + '')}" onchange="updateBlogPost(${i}, 'category', this.value)">
                </div>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                <div class="form-group">
                    <label class="form-label">Tarih</label>
                    <input type="text" class="form-input" value="${escapeHtml((p.date || '') + '')}" onchange="updateBlogPost(${i}, 'date', this.value)">
                </div>
                <div class="form-group">
                    <label class="form-label">Görsel URL</label>
                    <input type="text" class="form-input" value="${escapeHtml((p.imageUrl || '') + '')}" onchange="updateBlogPost(${i}, 'imageUrl', this.value)">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Özet</label>
                <textarea class="form-textarea" style="min-height:80px" onchange="updateBlogPost(${i}, 'excerpt', this.value)">${escapeHtml((p.excerpt || '') + '')}</textarea>
            </div>
            <button type="button" class="btn btn-danger btn-small" onclick="removeBlogPost(${i})">Sil</button>
        </div>
    `).join('') || '<p class="loading">Blog yok. Sunucudan Yükle veya + Yeni Yazı.</p>';
}

function updateBlogPost(idx, field, value) {
    if (!siteData.blog[idx]) siteData.blog[idx] = {};
    siteData.blog[idx][field] = value;
}

function addBlogPost() {
    siteData.blog = siteData.blog || [];
    siteData.blog.push({
        title: '', slug: '', category: '', date: '',
        excerpt: '', imageUrl: '', href: ''
    });
    displayBlogList();
}

function removeBlogPost(idx) {
    siteData.blog.splice(idx, 1);
    displayBlogList();
}

function displayWebsiteRefs() {
    const list = document.getElementById('websites-list');
    if (!list) return;
    if (!Array.isArray(siteData.websiteReferences)) siteData.websiteReferences = [];
    const items = siteData.websiteReferences;
    list.innerHTML = items.map((w, i) => `
        <div class="content-item" style="margin-bottom:20px;">
            <div class="form-group">
                <label class="form-label">Proje / Site başlığı</label>
                <input type="text" class="form-input" value="${escapeHtml((w.title || '') + '')}" onchange="updateWebsiteRef(${i}, 'title', this.value)">
            </div>
            <div class="form-group">
                <label class="form-label">Müşteri / etiket (üstte küçük yazı)</label>
                <input type="text" class="form-input" value="${escapeHtml((w.client || '') + '')}" onchange="updateWebsiteRef(${i}, 'client', this.value)">
            </div>
            <div class="form-group">
                <label class="form-label">Kısa açıklama</label>
                <textarea class="form-textarea" style="min-height:80px" onchange="updateWebsiteRef(${i}, 'description', this.value)">${escapeHtml((w.description || '') + '')}</textarea>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                <div class="form-group">
                    <label class="form-label">Görsel URL</label>
                    <input type="text" class="form-input" value="${escapeHtml((w.imageUrl || '') + '')}" onchange="updateWebsiteRef(${i}, 'imageUrl', this.value)">
                </div>
                <div class="form-group">
                    <label class="form-label">Site linki (https://...)</label>
                    <input type="url" class="form-input" value="${escapeHtml((w.link || '') + '')}" onchange="updateWebsiteRef(${i}, 'link', this.value)">
                </div>
            </div>
            <button type="button" class="btn btn-danger btn-small" onclick="removeWebsiteRef(${i})">Sil</button>
        </div>
    `).join('') || '<p class="loading">Henüz site eklenmedi. + Yeni Site ile ekleyin.</p>';
}

function updateWebsiteRef(idx, field, value) {
    if (!siteData.websiteReferences[idx]) siteData.websiteReferences[idx] = {};
    siteData.websiteReferences[idx][field] = value;
}

function addWebsiteRef() {
    siteData.websiteReferences = siteData.websiteReferences || [];
    siteData.websiteReferences.push({
        title: '',
        client: '',
        description: '',
        imageUrl: '',
        link: ''
    });
    displayWebsiteRefs();
}

function removeWebsiteRef(idx) {
    siteData.websiteReferences.splice(idx, 1);
    displayWebsiteRefs();
}

// Export Data
function exportData() {
    const dataStr = JSON.stringify(contentData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'site-content-' + new Date().toISOString().split('T')[0] + '.json';
    link.click();
    URL.revokeObjectURL(url);
    showAlert('Veriler dışa aktarıldı!', 'success');
}

// Import Data
function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                contentData = JSON.parse(e.target.result);
                saveToLocalStorage();
                showAlert('Veriler içe aktarıldı!', 'success');
                location.reload();
            } catch (error) {
                showAlert('Dosya okunamadı!', 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// Save All Changes
function saveAllChanges() {
    // This would typically save to server
    // For now, we'll just save to localStorage
    saveToLocalStorage();
    showAlert('Tüm değişiklikler kaydedildi!', 'success');
}

// Reset All Changes
function resetAllChanges() {
    if (confirm('Tüm değişiklikleri sıfırlamak istediğinizden emin misiniz?')) {
        localStorage.removeItem('adminContentData');
        contentData = {
            pages: {},
            texts: {},
            logos: {},
            icons: {},
            images: {}
        };
        showAlert('Tüm değişiklikler sıfırlandı!', 'success');
        location.reload();
    }
}

// View Page
function viewPage(pageFile) {
    window.open(pageFile, '_blank');
}

// Save Settings
function saveSettings() {
    const autoSave = document.getElementById('auto-save').value;
    const backupInterval = document.getElementById('backup-interval').value;
    
    localStorage.setItem('adminSettings', JSON.stringify({
        autoSave: autoSave === 'true',
        backupInterval: parseInt(backupInterval)
    }));
    
    showAlert('Ayarlar kaydedildi!', 'success');
}

// Show Alert
function showAlert(message, type = 'success') {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    alert.style.position = 'fixed';
    alert.style.top = '20px';
    alert.style.right = '20px';
    alert.style.zIndex = '10001';
    alert.style.minWidth = '300px';
    
    document.body.appendChild(alert);
    
    setTimeout(() => {
        alert.remove();
    }, 3000);
}

// Show section content when clicked
document.querySelector('[data-section="texts"]')?.addEventListener('click', function() {
    setTimeout(() => {
        displayTexts();
    }, 100);
});

document.querySelector('[data-section="logos"]')?.addEventListener('click', function() {
    setTimeout(() => {
        displayLogos();
    }, 100);
});

document.querySelector('[data-section="icons"]')?.addEventListener('click', function() {
    setTimeout(() => {
        displayIcons();
    }, 100);
});

document.querySelector('[data-section="images"]')?.addEventListener('click', function() {
    setTimeout(() => {
        displayImages();
    }, 100);
});

document.querySelector('[data-section="prices"]')?.addEventListener('click', function() {
    setTimeout(() => displayPrices(), 100);
});
document.querySelector('[data-section="references"]')?.addEventListener('click', function() {
    setTimeout(() => displayReferences(), 100);
});
document.querySelector('[data-section="blog"]')?.addEventListener('click', function() {
    setTimeout(() => displayBlogList(), 100);
});
document.querySelector('[data-section="websites"]')?.addEventListener('click', function() {
    setTimeout(() => displayWebsiteRefs(), 100);
});

// Display Logos
function displayLogos() {
    const logosList = document.getElementById('logos-list');
    logosList.innerHTML = '';
    
    const allLogos = [];
    Object.values(contentData.pages).forEach(page => {
        if (page.logos) {
            page.logos.forEach(logo => {
                allLogos.push({
                    ...logo,
                    page: page.file
                });
            });
        }
    });
    
    if (allLogos.length === 0) {
        logosList.innerHTML = '<div class="loading">Henüz logo bulunamadı. "Tüm Sayfaları Tara" butonuna tıklayın.</div>';
        return;
    }
    
    allLogos.forEach(logo => {
        const logoItem = document.createElement('div');
        logoItem.className = 'content-item';
        logoItem.innerHTML = `
            <div class="content-item-header">
                <div>
                    <div class="content-item-title">${logo.page}</div>
                    <div class="content-item-path">${logo.selector || 'N/A'}</div>
                </div>
                <div class="content-item-actions">
                    <button class="btn btn-primary btn-small" onclick="editLogo('${logo.page.replace(/'/g, "\\'")}', '${logo.id.replace(/'/g, "\\'")}')">Düzenle</button>
                </div>
            </div>
            <div class="content-item-preview">
                <img src="${logo.src}" alt="${logo.alt}" style="max-width: 200px; max-height: 100px; object-fit: contain; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; padding: 8px; background: #f5f5f7;">
            </div>
        `;
        logosList.appendChild(logoItem);
    });
}

// Edit Logo
function editLogo(pageFile, logoId) {
    const page = contentData.pages[pageFile];
    if (!page) return;
    
    const logo = page.logos.find(l => l.id === logoId);
    if (!logo) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.svg';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            logo.src = e.target.result;
            logo.updated = true;
            logo.updatedAt = new Date().toISOString();
            
            saveToLocalStorage();
            showAlert('Logo güncellendi!', 'success');
            displayLogos();
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

// Display Icons
function displayIcons() {
    const iconsList = document.getElementById('icons-list');
    iconsList.innerHTML = '';
    
    const allIcons = [];
    Object.values(contentData.pages).forEach(page => {
        if (page.icons) {
            page.icons.forEach(icon => {
                allIcons.push({
                    ...icon,
                    page: page.file
                });
            });
        }
    });
    
    if (allIcons.length === 0) {
        iconsList.innerHTML = '<div class="loading">Henüz ikon bulunamadı. "Tüm Sayfaları Tara" butonuna tıklayın.</div>';
        return;
    }
    
    allIcons.forEach(icon => {
        const iconItem = document.createElement('div');
        iconItem.className = 'content-item';
        iconItem.innerHTML = `
            <div class="content-item-header">
                <div>
                    <div class="content-item-title">${icon.page}</div>
                    <div class="content-item-path">${icon.selector || 'N/A'}</div>
                </div>
                <div class="content-item-actions">
                    <button class="btn btn-primary btn-small" onclick="editIcon('${icon.page.replace(/'/g, "\\'")}', '${icon.id.replace(/'/g, "\\'")}')">Düzenle</button>
                </div>
            </div>
            <div class="content-item-preview">
                <div style="max-width: 100px; max-height: 100px; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; padding: 16px; background: #f5f5f7; display: inline-block;">
                    ${icon.html || 'SVG İkon'}
                </div>
            </div>
        `;
        iconsList.appendChild(iconItem);
    });
}

// Edit Icon
function editIcon(pageFile, iconId) {
    const page = contentData.pages[pageFile];
    if (!page) return;
    
    const icon = page.icons.find(i => i.id === iconId);
    if (!icon) return;
    
    const newSvg = prompt('Yeni SVG kodunu girin:', icon.html);
    if (newSvg !== null && newSvg !== icon.html) {
        icon.html = newSvg;
        icon.updated = true;
        icon.updatedAt = new Date().toISOString();
        
        saveToLocalStorage();
        showAlert('İkon güncellendi!', 'success');
        displayIcons();
    }
}

// Display Images
function displayImages() {
    const imagesList = document.getElementById('images-list');
    imagesList.innerHTML = '';
    
    const allImages = [];
    Object.values(contentData.pages).forEach(page => {
        if (page.images) {
            page.images.forEach(image => {
                allImages.push({
                    ...image,
                    page: page.file
                });
            });
        }
    });
    
    if (allImages.length === 0) {
        imagesList.innerHTML = '<div class="loading">Henüz görsel bulunamadı. "Tüm Sayfaları Tara" butonuna tıklayın.</div>';
        return;
    }
    
    allImages.forEach(image => {
        const imageItem = document.createElement('div');
        imageItem.className = 'content-item';
        imageItem.innerHTML = `
            <div class="content-item-header">
                <div>
                    <div class="content-item-title">${image.page}</div>
                    <div class="content-item-path">${image.selector || 'N/A'}</div>
                </div>
                <div class="content-item-actions">
                    <button class="btn btn-primary btn-small" onclick="editImage('${image.page.replace(/'/g, "\\'")}', '${image.id.replace(/'/g, "\\'")}')">Düzenle</button>
                </div>
            </div>
            <div class="content-item-preview">
                <img src="${image.src}" alt="${image.alt}" style="max-width: 300px; max-height: 200px; object-fit: contain; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; padding: 8px; background: #f5f5f7;">
            </div>
        `;
        imagesList.appendChild(imageItem);
    });
}

// Edit Image
function editImage(pageFile, imageId) {
    const page = contentData.pages[pageFile];
    if (!page) return;
    
    const image = page.images.find(img => img.id === imageId);
    if (!image) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            image.src = e.target.result;
            image.updated = true;
            image.updatedAt = new Date().toISOString();
            
            saveToLocalStorage();
            showAlert('Görsel güncellendi!', 'success');
            displayImages();
        };
        reader.readAsDataURL(file);
    };
    input.click();
}
